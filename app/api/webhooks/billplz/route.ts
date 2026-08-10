import { NextRequest, NextResponse }              from 'next/server'
import { waitUntil }                              from '@vercel/functions'
import { verifyWebhookSignature }                 from '@/lib/billplz'
import { markReportPaid, getBuyerReportByBillId,
         markUpgradePaid, getBuyerReportByUpgradeBillId,
         setVehicleApiData } from '@/lib/db/buyer-reports'
import { deliverBuyerReportReceipt }              from '@/lib/receipt-delivery'
import { buildBuyerReportAccessUrl }              from '@/lib/report-access'
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
import { reportMoneyPathFailure }                from '@/lib/observability'
import { getCheckoutAttribution }                from '@/lib/db/ad-attribution'
import { markUpgradePaidByReportId }             from '@/lib/db/buyer-reports'

// A paid JomCheck add-on in manual mode → alert the owner to fulfil it, and set
// the buyer's expectation with an interim email. Best-effort: swallows its own
// errors so a failed ping/email never breaks the payment webhook.
async function notifyManualJomCheckOrder(o: {
  plate: string; email: string; amountCents: number; reportUrl: string | null
}): Promise<void> {
  if (!isJomCheckManual()) return
  await sendTelegramMessage(
    `Order JomCheck baru\nPlat: ${o.plate}\nEmail: ${o.email}\nRM${(o.amountCents / 100).toFixed(0)}\nFulfil → https://paqar.my/admin/jomcheck`,
  ).catch(() => {})
  // The owner alert always fires. The buyer email is skipped when no valid
  // access URL exists, because its whole purpose is to hand over that link —
  // a tokenless one 404s.
  if (!o.reportUrl) {
    console.error('[jomcheck-pending-email] skipped: no valid access URL')
    return
  }
  await sendJomCheckPendingEmail({ toEmail: o.email, plate: o.plate, reportUrl: o.reportUrl })
    .catch(err => console.error('[jomcheck-pending-email]', err))
}

/**
 * Last-resort reconciliation for a paid bill no column points at any more.
 *
 * upgrade_bill_id holds ONE bill. Before migration 028 a retry overwrote it, so
 * an earlier bill could stay payable at Billplz while Paqar forgot it — pay it
 * and the lookup finds nothing. Reuse now prevents new instances, but bills
 * created before the fix still exist and are still payable.
 *
 * checkout_attributions is the durable record: billplz_bill_id is UNIQUE and a
 * row is written at bill creation, so a superseded bill keeps its own row
 * naming the report and the product. That is enough to finish the job.
 *
 * Deliberately narrow. It grants ONLY the +RM88 upgrade, only when the
 * attribution row names that exact product AND a buyer_report_id — it must
 * never be able to invent an entitlement from a bill of some other kind, and it
 * must never grant the base report, which markReportPaid alone may do.
 *
 * Idempotent: markUpgradePaidByReportId flips add_jomcheck false->true
 * atomically, so a duplicate or out-of-order webhook grants once.
 *
 * Returns true only when this call actually granted the entitlement.
 */
async function reconcileOrphanedUpgrade(billId: string, paidAt: string): Promise<boolean> {
  let attribution
  try {
    attribution = await getCheckoutAttribution(billId)
  } catch (err) {
    reportMoneyPathFailure('upgrade_reconcile_lookup_failed', {
      billId, reason: String(err).slice(0, 120),
    })
    return false
  }

  if (!attribution) return false
  if (attribution.product !== 'claim_check_upgrade') return false
  const reportId = attribution.buyer_report_id
  if (!reportId) return false

  const granted = await markUpgradePaidByReportId(reportId).catch(err => {
    reportMoneyPathFailure('upgrade_reconcile_write_failed', {
      billId, buyerReportId: reportId, reason: String(err).slice(0, 120),
    })
    return false
  })

  // Reported either way. Granting is the right outcome, but a bill reaching
  // this path at all means a superseded bill was paid, which is worth knowing.
  //
  // Warning, not error, when it grants: the customer has what they paid for and
  // nobody needs to act tonight — though a superseded bill being paid at all is
  // worth a look. Info when it was already granted: that is a pure no-op.
  reportMoneyPathFailure('upgrade_reconciled_from_attribution', {
    billId, buyerReportId: reportId, amountCents: 8800,
    reason: granted ? 'entitlement granted from checkout_attributions' : 'already granted',
  }, granted ? 'warning' : 'info')

  if (granted) {
    waitUntil(
      recordPurchase({
        billId, email: '', amountCents: 8800,
        checkId: attribution.check_id ?? null, buyerReportId: reportId,
      }).catch(err => console.error('[post-payment:attribution] reconciled upgrade', {
        billId, error: String(err),
      })),
    )
    void paidAt
  }
  return true
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
          // Same rule as the primary purchase: this used to send a receipt
          // pointing at a tokenless URL, which 404s for an anonymous buyer.
          waitUntil(
            deliverBuyerReportReceipt({ ...upgradeReport, amount_cents: 8800 }, { paidAt })
              .then(r => { if (!r.ok) console.error('[post-payment:receipt] upgrade delivery failed', {
                op: 'receipt_upgrade', billId, buyerReportId: upgradeReport.id,
                checkId: upgradeReport.check_id, reason: r.reason,
              }) })
              .catch(err => console.error('[post-payment:receipt] upgrade threw', {
                op: 'receipt_upgrade', billId, buyerReportId: upgradeReport.id, error: String(err),
              })),
          )
          waitUntil(
            recordPurchase({
              billId,
              email:         upgradeReport.buyer_email,
              amountCents:   8800,
              checkId:       upgradeReport.check_id,
              buyerReportId: upgradeReport.id,
            }).catch(err => console.error('[post-payment:attribution] upgrade failed', {
              op: 'attribution_upgrade', billId, buyerReportId: upgradeReport.id, error: String(err),
            })),
          )

          // Manual JomCheck fulfilment: alert the owner + set buyer expectation
          try {
            const checkRow = await getCheck(upgradeReport.check_id)
            const plate = checkRow ? decrypt(checkRow.check.plate_encrypted as string).toUpperCase() : '(plat)'
            const reportUrl = buildBuyerReportAccessUrl({
              checkId:    upgradeReport.check_id,
              claimToken: checkRow?.check.claim_token,
            })
            // No usable URL → skip the buyer-facing interim email rather than
            // send one whose only link 404s. The owner alert still fires.
            await notifyManualJomCheckOrder({
              plate, email: upgradeReport.buyer_email, amountCents: 8800, reportUrl,
            })
          } catch (err) { console.error('[jomcheck-notify:upgrade]', err) }
        }
      } else if (await reconcileOrphanedUpgrade(billId, paidAt)) {
        // Recovered through checkout_attributions — see the helper.
      } else {
        // A PAID bill matching neither table. Money has been taken and no
        // entitlement exists anywhere in the database.
        //
        // This branch returned ok with no log at all, which made it the one
        // money-losing outcome that was invisible in every system: nothing in
        // Vercel, nothing in Sentry, and a 200 that tells Billplz to stop
        // retrying. Reachable if a bill is created and the buyer_reports insert
        // then fails, if a row is deleted (scripts/delete-report.ts exists), or
        // if a bill is raised outside this flow.
        //
        // Still returns 200 deliberately: there is nothing for Billplz to
        // retry into, and a 500 would loop forever against a row that will
        // never appear. The alert is what makes it actionable.
        reportMoneyPathFailure('paid_bill_no_report', {
          billId,
          reason: 'billplz reported paid but no buyer_report or upgrade row matches',
        })
      }
      return NextResponse.json({ ok: true })
    }

    const wasJustPaid = await markReportPaid(billId)
    if (wasJustPaid) {
      let plate: string | null = null
      let reportUrl: string | undefined
      try {
        const checkRow = await getCheck(buyerReport.check_id)
        if (checkRow) {
          plate = decrypt(checkRow.check.plate_encrypted as string).toUpperCase()
          reportUrl = buildBuyerReportAccessUrl({
            checkId:    buyerReport.check_id,
            claimToken: checkRow.check.claim_token,
          }) ?? undefined
        }
      } catch { /* non-fatal — deliverBuyerReportReceipt resolves this itself */ }

      // ── CRITICAL: receipt delivery ──────────────────────────────────────
      // Held by waitUntil so the runtime cannot freeze the instance before the
      // send resolves, and tracked in the DB so a loss is visible and
      // retryable rather than silent. Deliberately NOT bundled with the
      // best-effort work below: a cache-warm failure must never be able to
      // mark a receipt failed, and a failed receipt must never be hidden
      // inside an aggregate that looks successful.
      waitUntil(
        deliverBuyerReportReceipt(buyerReport, { paidAt })
          .then(result => {
            if (!result.ok) {
              console.error('[post-payment:receipt] delivery failed', {
                op: 'receipt', billId, buyerReportId: buyerReport.id,
                checkId: buyerReport.check_id, reason: result.reason,
              })
            }
          })
          .catch(err => console.error('[post-payment:receipt] threw', {
            op: 'receipt', billId, buyerReportId: buyerReport.id,
            checkId: buyerReport.check_id, error: String(err),
          })),
      )

      // ── Best-effort: attribution ────────────────────────────────────────
      waitUntil(
        recordPurchase({
          billId,
          email:         buyerReport.buyer_email,
          amountCents:   buyerReport.amount_cents,
          checkId:       buyerReport.check_id,
          buyerReportId: buyerReport.id,
        }).catch(err => console.error('[post-payment:attribution] failed', {
          op: 'attribution', billId, buyerReportId: buyerReport.id,
          checkId: buyerReport.check_id, error: String(err),
        })),
      )

      // Combined RM100 purchase → same manual-fulfilment alert + interim email
      if (buyerReport.add_jomcheck && plate) {
        await notifyManualJomCheckOrder({
          plate,
          email:       buyerReport.buyer_email,
          amountCents: buyerReport.amount_cents,
          reportUrl:   reportUrl ?? null,
        }).catch(err => console.error('[jomcheck-notify:combined]', err))
      }

      // ── Best-effort: cache warm-up ──────────────────────────────────────
      // Purely a latency optimisation; the report page re-fetches vehicle data
      // on view if it is missing, so losing this costs a slower first load and
      // nothing else. Still held by waitUntil rather than left floating.
      if (plate) {
        waitUntil((async () => {
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
            console.error('[post-payment:cache-warmup] failed', {
              op: 'cache_warmup', billId, buyerReportId: buyerReport.id,
              checkId: buyerReport.check_id, error: String(err),
            })
          }
        })())
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billplz-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
