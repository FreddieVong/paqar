import { NextRequest, NextResponse }              from 'next/server'
import { verifyWebhookSignature }                 from '@/lib/billplz'
import { markReportPaid, getBuyerReportByBillId,
         markUpgradePaid, getBuyerReportByUpgradeBillId,
         setVehicleApiData } from '@/lib/db/buyer-reports'
import { sendReceiptEmail }                       from '@/lib/email/receipt'
import { sendJomCheckPendingEmail }               from '@/lib/email/jomcheck-pending'
import { recordPurchase }                         from '@/lib/purchase-attribution'
import { isJomCheckManual }                       from '@/lib/jomcheck'
import { sendTelegramMessage }                    from '@/lib/notify/telegram'
import { getCheck }                              from '@/lib/db/checks'
import { decrypt }                               from '@/lib/crypto'
import { getOrFetchVehicleData }                 from '@/lib/db/plate-lookups'
import { getValuationByNvic }                    from '@/lib/db/vehicle-valuations'
import { getCachedMarketPrices,
         fetchAndCacheMarketPrices }             from '@/lib/db/market-prices'
import { buildMarketModelKeyword }               from '@/lib/market-keyword'

// A paid JomCheck add-on in manual mode → alert the owner to fulfil it, and set
// the buyer's expectation with an interim email. Best-effort: swallows its own
// errors so a failed ping/email never breaks the payment webhook.
async function notifyManualJomCheckOrder(o: {
  plate: string; email: string; amountCents: number; reportUrl: string
}): Promise<void> {
  if (!isJomCheckManual()) return
  await sendTelegramMessage(
    `Order JomCheck baru\nPlat: ${o.plate}\nEmail: ${o.email}\nRM${(o.amountCents / 100).toFixed(0)}\nFulfil → https://paqar.my/admin/jomcheck`,
  ).catch(() => {})
  await sendJomCheckPendingEmail({ toEmail: o.email, plate: o.plate, reportUrl: o.reportUrl })
    .catch(err => console.error('[jomcheck-pending-email]', err))
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })

  const signature = params['x_signature'] ?? ''
  const { x_signature: _sig, ...verifyParams } = params

  if (!verifyWebhookSignature(verifyParams, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const billId = params['id']
  const paid   = params['paid'] === 'true'
  const paidAt = params['paid_at'] ?? new Date().toISOString()

  if (!billId || !paid) {
    return NextResponse.json({ ok: true })
  }

  try {
    const buyerReport = await getBuyerReportByBillId(billId)

    // Not a primary report bill — check if it's a JomCheck add-on upgrade bill
    if (!buyerReport) {
      const upgradeReport = await getBuyerReportByUpgradeBillId(billId)
      if (upgradeReport) {
        const wasJustUpgraded = await markUpgradePaid(billId)
        if (wasJustUpgraded) {
          sendReceiptEmail({
            product:     'buyer_report',
            toEmail:     upgradeReport.buyer_email,
            amountCents: 8800,
            paidAt,
            plate:       null,
            reportUrl:   `https://paqar.my/laporan-pembeli/${upgradeReport.check_id}`,
          }).catch(err => console.error('[receipt-email:jomcheck-upgrade]', err))
          void recordPurchase({
            billId,
            email:         upgradeReport.buyer_email,
            amountCents:   8800,
            checkId:       upgradeReport.check_id,
            buyerReportId: upgradeReport.id,
          })

          // Manual JomCheck fulfilment: alert the owner + set buyer expectation
          try {
            const checkRow = await getCheck(upgradeReport.check_id)
            const plate = checkRow ? decrypt(checkRow.check.plate_encrypted as string).toUpperCase() : '(plat)'
            const token = checkRow?.check.claim_token
            const reportUrl = token
              ? `https://paqar.my/laporan-pembeli/${upgradeReport.check_id}?claim_token=${token}`
              : `https://paqar.my/laporan-pembeli/${upgradeReport.check_id}`
            await notifyManualJomCheckOrder({ plate, email: upgradeReport.buyer_email, amountCents: 8800, reportUrl })
          } catch (err) { console.error('[jomcheck-notify:upgrade]', err) }
        }
      }
      return NextResponse.json({ ok: true })
    }

    const wasJustPaid = await markReportPaid(billId)
    if (wasJustPaid) {
      let reportUrl: string | undefined
      let plate: string | null = null
      try {
        const checkRow = await getCheck(buyerReport.check_id)
        if (checkRow) {
          plate = decrypt(checkRow.check.plate_encrypted as string).toUpperCase()
          const token = checkRow.check.claim_token
          reportUrl = token
            ? `https://paqar.my/laporan-pembeli/${buyerReport.check_id}?claim_token=${token}`
            : `https://paqar.my/laporan-pembeli/${buyerReport.check_id}`
        }
      } catch { /* non-fatal */ }

      sendReceiptEmail({
        product:     'buyer_report',
        toEmail:     buyerReport.buyer_email,
        amountCents: buyerReport.amount_cents,
        paidAt,
        plate,
        reportUrl,
      }).catch(err => console.error('[receipt-email:buyer_report]', err))
      void recordPurchase({
        billId,
        email:         buyerReport.buyer_email,
        amountCents:   buyerReport.amount_cents,
        checkId:       buyerReport.check_id,
        buyerReportId: buyerReport.id,
      })

      // Combined RM100 purchase → same manual-fulfilment alert + interim email
      if (buyerReport.add_jomcheck && plate) {
        await notifyManualJomCheckOrder({
          plate,
          email:       buyerReport.buyer_email,
          amountCents: buyerReport.amount_cents,
          reportUrl:   reportUrl ?? `https://paqar.my/laporan-pembeli/${buyerReport.check_id}`,
        }).catch(err => console.error('[jomcheck-notify:combined]', err))
      }

      // Pre-warm vehicle + market price caches so the report loads fully on first view
      if (plate) {
        ;(async () => {
          try {
            const apiResult = await getOrFetchVehicleData(plate)
            if (!apiResult) return
            const valuation = await getValuationByNvic(
              apiResult.nvic,
              { make: apiResult.make, year: apiResult.registrationYear, model: apiResult.model }
            ).catch(() => null)
            await setVehicleApiData(buyerReport.id, { ...apiResult, valuation: valuation ?? null })
            const mo = buildMarketModelKeyword(apiResult.model, apiResult.description ?? '')
            const cached = await getCachedMarketPrices(apiResult.make, mo, apiResult.registrationYear).catch(() => null)
            if (!cached) {
              await fetchAndCacheMarketPrices(apiResult.make, mo, apiResult.registrationYear).catch(() => {})
            }
          } catch (err) {
            console.error('[post-payment:cache-warmup]', err)
          }
        })()
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billplz-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
