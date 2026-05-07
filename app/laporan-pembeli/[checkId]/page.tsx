import { notFound }           from 'next/navigation'
import { Nav }                from '@/components/layout/Nav'
import { Shell }              from '@/components/layout/Shell'
import { getCheck }           from '@/lib/db/checks'
import { getBuyerReport }     from '@/lib/db/buyer-reports'
import { BuyerReportContent } from '@/components/report/BuyerReportContent'
import { PaymentForm }        from '@/components/report/PaymentForm'
import { decrypt }            from '@/lib/crypto'

interface Props {
  params:       { checkId: string }
  searchParams: { claim_token?: string; status?: string }
}

export default async function BuyerReportPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) notFound()

  const row = await getCheck(params.checkId, claimToken)
  if (!row || row.check.status !== 'complete') notFound()

  const report = await getBuyerReport(params.checkId)
  const isPaid = report?.status === 'paid'
  const plate  = decrypt(row.check.plate_encrypted as string).toUpperCase()

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-5 pb-6 space-y-5">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#DC2626] mb-1">
              Laporan Pembeli
            </p>
            <h1 className="font-heading font-extrabold text-[24px] tracking-tight text-[#111827]">
              {plate}
            </h1>
            <p className="font-body text-[13px] text-[#6B7280] mt-1">
              {isPaid ? 'Laporan penuh — dibayar' : 'Bayar RM29 untuk akses laporan penuh'}
            </p>
          </div>

          {isPaid ? (
            <BuyerReportContent
              check={row.check}
              results={row.results}
              plate={plate}
              askingPriceRm={report?.asking_price_rm ?? null}
              claimedMileageKm={report?.claimed_mileage_km ?? null}
            />
          ) : (
            <>
              <div className="relative rounded-[14px] overflow-hidden">
                <div className="opacity-30 pointer-events-none select-none">
                  <BuyerReportContent
                    check={row.check}
                    results={row.results}
                    plate={plate}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white flex flex-col items-center justify-end pb-6 px-5">
                  <div className="text-center mb-4">
                    <span className="text-2xl">🔒</span>
                    <p className="font-heading font-bold text-[15px] text-[#111827] mt-2">
                      Buka Laporan Risiko Pembeli — RM29
                    </p>
                    <p className="font-body text-[12px] text-[#6B7280] mt-1">
                      Semak harga · Saman · Soalan penjual · Tips rundingan
                    </p>
                  </div>
                </div>
              </div>
              <PaymentForm checkId={params.checkId} claimToken={claimToken} />
            </>
          )}
        </div>
      </Shell>
    </>
  )
}
