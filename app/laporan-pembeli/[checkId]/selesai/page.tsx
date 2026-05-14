import { redirect }                                  from 'next/navigation'
import { Nav }                                       from '@/components/layout/Nav'
import { Shell }                                     from '@/components/layout/Shell'
import { getCheck }                                  from '@/lib/db/checks'
import { markReportPaid, getBuyerReportByBillId }    from '@/lib/db/buyer-reports'
import { decrypt }                                   from '@/lib/crypto'
import { sendReceiptEmail }                          from '@/lib/email/receipt'
import { AnalyticsEvent }                            from '@/components/layout/AnalyticsEvent'
import { WhatsAppShareButton }                       from '@/components/report/WhatsAppShareButton'

interface Props {
  params:       { checkId: string }
  searchParams: Record<string, string | undefined>
}

export default async function LaporanSelesaiPage({ params, searchParams }: Props) {
  const claimToken   = searchParams['claim_token']
  const billId       = searchParams['billplz[id]']
  const billplzPaid  = searchParams['billplz[paid]']

  if (!claimToken) redirect('/')

  // Mark report paid. Returns true if this page won the pending→paid race.
  // If so, send receipt here — webhook may arrive after and find status already 'paid'.
  if (billId && billplzPaid === 'true') {
    const wasJustPaid = await markReportPaid(billId).catch(() => false)
    if (wasJustPaid) {
      getBuyerReportByBillId(billId).then(report => {
        if (!report) return
        const reportUrl = claimToken
          ? `https://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${claimToken}`
          : `https://paqar.my/laporan-pembeli/${params.checkId}`
        sendReceiptEmail({
          product:     'buyer_report',
          toEmail:     report.buyer_email,
          amountCents: report.amount_cents,
          paidAt:      new Date().toISOString(),
          plate:       null,
          reportUrl,
        }).catch(() => {})
      }).catch(() => {})
    }
  }

  const row   = await getCheck(params.checkId, claimToken)
  const plate = row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : null

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 max-w-sm mx-auto space-y-5 text-center">
          {billplzPaid === 'true' && <AnalyticsEvent event="payment_completed" />}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-6">
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
