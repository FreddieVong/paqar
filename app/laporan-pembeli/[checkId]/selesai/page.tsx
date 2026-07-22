import { redirect }                                  from 'next/navigation'
import Image                                         from 'next/image'
import { Nav }                                       from '@/components/layout/Nav'
import { Shell }                                     from '@/components/layout/Shell'
import { getCheck }                                  from '@/lib/db/checks'
import { markReportPaid, getBuyerReportByBillId,
         markUpgradePaid, getBuyerReportByUpgradeBillId,
         getBuyerReport } from '@/lib/db/buyer-reports'
import { decrypt }                                   from '@/lib/crypto'
import { sendReceiptEmail }                          from '@/lib/email/receipt'
import { sendPurchaseEvent }                         from '@/lib/meta-capi'
import { verifyRedirectSignature }                   from '@/lib/billplz'
import { resolvePaymentDisplayState }                from '@/lib/payment-display-state'
import { AnalyticsEvent }                            from '@/components/layout/AnalyticsEvent'
import { GoogleAdsConversion }                       from '@/components/layout/GoogleAdsConversion'
import { WhatsAppShareButton }                       from '@/components/report/WhatsAppShareButton'

interface Props {
  params:       { checkId: string }
  searchParams: Record<string, string | undefined>
}

export default async function LaporanSelesaiPage({ params, searchParams }: Props) {
  const claimToken   = searchParams['claim_token']

  if (!claimToken) redirect('/')

  const reportUrl = `https://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${claimToken}`

  // Verify redirect signature first — if missing/invalid/tampered, displayState will be 'invalid'
  const verifiedParams = verifyRedirectSignature(searchParams)

  let displayState = resolvePaymentDisplayState({
    checkId:         params.checkId,
    billId:          verifiedParams?.['billplzid'] ?? '',
    signedPaid:      verifiedParams?.['billplzpaid'] === 'true' || false,
    report:          null,
    upgradeReport:   null,
    wasJustPaid:     false,
    wasJustUpgraded: false,
  })

  // Only attempt mutations if signature is valid and we have a billId
  if (verifiedParams) {
    const billId = verifiedParams['billplzid']
    const signedPaid = verifiedParams['billplzpaid'] === 'true'

    if (billId) {
      // Read-only first — determine which transaction (if any) this billId resolves to,
      // and whether it belongs to this route's checkId.
      const [report, upgradeReport] = await Promise.all([
        getBuyerReportByBillId(billId).catch(() => null),
        getBuyerReportByUpgradeBillId(billId).catch(() => null),
      ])

      // Check if match is valid and transaction is for this checkId
      // Only proceed with mutation if signature is valid, transaction is found, and signed=paid=true
      const isNormalMatch = report && report.check_id === params.checkId
      const isUpgradeMatch = upgradeReport && upgradeReport.check_id === params.checkId
      const hasValidMatch = isNormalMatch || isUpgradeMatch

      if (hasValidMatch && signedPaid) {
        // Attempt mutation only if signature verified, match found, and signedPaid=true
        let wasJustPaid = false
        let wasJustUpgraded = false

        if (isNormalMatch && report) {
          wasJustPaid = await markReportPaid(billId).catch(() => false)
          if (wasJustPaid) {
            sendReceiptEmail({
              product:     'buyer_report',
              toEmail:     report.buyer_email,
              amountCents: report.amount_cents,
              paidAt:      new Date().toISOString(),
              plate:       null,
              reportUrl,
            }).catch(() => {})
            void sendPurchaseEvent({ email: report.buyer_email, amountCents: report.amount_cents, billId })
          }
        }

        if (isUpgradeMatch && upgradeReport) {
          wasJustUpgraded = await markUpgradePaid(billId).catch(() => false)
          if (wasJustUpgraded) {
            sendReceiptEmail({
              product:     'buyer_report',
              toEmail:     upgradeReport.buyer_email,
              amountCents: 8800,
              paidAt:      new Date().toISOString(),
              plate:       null,
              reportUrl,
            }).catch(() => {})
            void sendPurchaseEvent({ email: upgradeReport.buyer_email, amountCents: 8800, billId })
          }
        }

        // Determine final display state with mutation results
        displayState = resolvePaymentDisplayState({
          checkId:         params.checkId,
          billId,
          signedPaid,
          report:          report && report.check_id === params.checkId ? report : null,
          upgradeReport:   upgradeReport && upgradeReport.check_id === params.checkId ? upgradeReport : null,
          wasJustPaid,
          wasJustUpgraded,
        })
      } else {
        // Transaction not found or checkId doesn't match, determine state without mutation
        displayState = resolvePaymentDisplayState({
          checkId:         params.checkId,
          billId,
          signedPaid,
          report:          report && report.check_id === params.checkId ? report : null,
          upgradeReport:   upgradeReport && upgradeReport.check_id === params.checkId ? upgradeReport : null,
          wasJustPaid:     false,
          wasJustUpgraded: false,
        })
      }
    }
  }

  const row   = await getCheck(params.checkId, claimToken)
  const plate = row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : null

  // RM88 add-on nudge — only for RM12 buyers when JomCheck is live
  // Only show if we're in verified_paid state and it's the normal (non-upgrade) path
  const paidReport = displayState.state === 'verified_paid' ? await getBuyerReport(params.checkId).catch(() => null) : null
  const showJomCheckNudge =
    process.env.JOMCHECK_ENABLED === 'true' &&
    displayState.state === 'verified_paid' &&
    paidReport?.status === 'paid' &&
    !paidReport.add_jomcheck

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 max-w-sm mx-auto space-y-5 text-center">
          {displayState.state === 'verified_paid' && <AnalyticsEvent event="payment_completed" />}
          {displayState.state === 'verified_paid' && (
            <GoogleAdsConversion
              email={displayState.buyerEmail}
              transactionId={displayState.purchaseInfo.transactionId}
              value={displayState.purchaseInfo.valueRm}
            />
          )}

          {displayState.state === 'verified_paid' && (
            <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-[16px] p-6">
              <Image
                src="/paqar-logo.png"
                alt="Paqar"
                width={80}
                height={46}
                className="mx-auto mb-3 object-contain"
              />
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
                Laporan Pembeli
              </p>
              <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
                Pembayaran Berjaya
              </p>
              {plate && (
                <p className="font-heading font-extrabold text-[28px] tracking-[.1em] text-[#064E4A] mb-2">
                  {plate}
                </p>
              )}
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                Laporan anda sedia untuk dilihat. Simpan link ini — anda boleh akses semula pada bila-bila masa.
              </p>
            </div>
          )}

          {displayState.state === 'pending_verification' && (
            <div className="bg-[#FEF3C7] border border-[#FBBF24] rounded-[16px] p-6">
              <Image
                src="/paqar-logo.png"
                alt="Paqar"
                width={80}
                height={46}
                className="mx-auto mb-3 object-contain"
              />
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#92400E] mb-2">
                Pembayaran
              </p>
              <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
                Pembayaran sedang disahkan
              </p>
              <p className="font-body text-[13px] text-[#78350F] leading-relaxed">
                Sila cuba semula sebentar lagi.
              </p>
            </div>
          )}

          {displayState.state === 'invalid' && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[16px] p-6">
              <Image
                src="/paqar-logo.png"
                alt="Paqar"
                width={80}
                height={46}
                className="mx-auto mb-3 object-contain"
              />
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#7F1D1D] mb-2">
                Ralat
              </p>
              <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
                Pembayaran tidak dapat disahkan
              </p>
              <p className="font-body text-[13px] text-[#991B1B] leading-relaxed">
                Sila hubungi sokongan atau cuba semula.
              </p>
            </div>
          )}

          <a
            href={`/laporan-pembeli/${params.checkId}?claim_token=${claimToken}`}
            className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#053D3A] transition-colors"
          >
            Lihat Laporan Saya →
          </a>

          {showJomCheckNudge && (
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
              Kereta ini pernah accident atau banjir? Tambah{' '}
              <span className="font-semibold text-[#064E4A]">Semakan Accident/Claim Insurans (+RM88)</span>{' '}
              terus dalam laporan anda.
            </p>
          )}

          {plate && displayState.state === 'verified_paid' && (
            <WhatsAppShareButton
              href={`https://wa.me/?text=${encodeURIComponent(`Laporan Paqar untuk ${plate} sedia!\n\nLihat laporan di sini:\nhttps://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${claimToken}\n\nJuga boleh tempah inspection sebelum bayar deposit.`)}`}
            />
          )}

          {displayState.state === 'verified_paid' && (
            <p className="font-body text-[11px] text-[#9CA3AF]">
              Resit akan dihantar ke e-mel anda.
            </p>
          )}
        </div>
      </Shell>
    </>
  )
}
