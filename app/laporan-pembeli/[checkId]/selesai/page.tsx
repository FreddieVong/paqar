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
import { AnalyticsEvent }                            from '@/components/layout/AnalyticsEvent'
import { GoogleAdsConversion }                       from '@/components/layout/GoogleAdsConversion'
import { WhatsAppShareButton }                       from '@/components/report/WhatsAppShareButton'

interface Props {
  params:       { checkId: string }
  searchParams: Record<string, string | undefined>
}

export default async function LaporanSelesaiPage({ params, searchParams }: Props) {
  const claimToken   = searchParams['claim_token']
  const billId       = searchParams['billplz[id]']      ?? searchParams['billplz%5Bid%5D']
  const billplzPaid  = searchParams['billplz[paid]']    ?? searchParams['billplz%5Bpaid%5D']

  if (!claimToken) redirect('/')

  const isUpgrade = searchParams['upgrade'] === '1'
  const reportUrl = `https://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${claimToken}`

  let buyerEmail: string | undefined
  if (billId && billplzPaid === 'true') {
    if (isUpgrade) {
      // JomCheck add-on bill — flip add_jomcheck on the existing report.
      // Same race pattern as markReportPaid: this page or the webhook wins.
      const [wasJustUpgraded, upgradeReport] = await Promise.all([
        markUpgradePaid(billId).catch(() => false),
        getBuyerReportByUpgradeBillId(billId).catch(() => null),
      ])
      buyerEmail = upgradeReport?.buyer_email ?? undefined
      if (wasJustUpgraded && upgradeReport) {
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
    } else {
      // Mark report paid. Returns true if this page won the pending→paid race.
      // If so, send receipt here — webhook may arrive after and find status already 'paid'.
      const [wasJustPaid, report] = await Promise.all([
        markReportPaid(billId).catch(() => false),
        getBuyerReportByBillId(billId).catch(() => null),
      ])
      buyerEmail = report?.buyer_email ?? undefined
      if (wasJustPaid && report) {
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
  }

  const row   = await getCheck(params.checkId, claimToken)
  const plate = row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : null

  // RM88 add-on nudge — only for RM12 buyers when JomCheck is live
  const paidReport = await getBuyerReport(params.checkId).catch(() => null)
  const showJomCheckNudge =
    process.env.JOMCHECK_ENABLED === 'true' &&
    !isUpgrade &&
    paidReport?.status === 'paid' &&
    !paidReport.add_jomcheck

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 max-w-sm mx-auto space-y-5 text-center">
          {billplzPaid === 'true' && <AnalyticsEvent event="payment_completed" />}
          {billplzPaid === 'true' && <GoogleAdsConversion email={buyerEmail} transactionId={billId} />}
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

          {plate && (
            <WhatsAppShareButton
              href={`https://wa.me/?text=${encodeURIComponent(`Laporan Paqar untuk ${plate} sedia!\n\nLihat laporan di sini:\nhttps://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${claimToken}\n\nJuga boleh tempah inspection sebelum bayar deposit.`)}`}
            />
          )}

          <p className="font-body text-[11px] text-[#9CA3AF]">
            Resit akan dihantar ke e-mel anda.
          </p>
        </div>
      </Shell>
    </>
  )
}
