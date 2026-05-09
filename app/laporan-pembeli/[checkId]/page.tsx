import { notFound }           from 'next/navigation'
import { Nav }                from '@/components/layout/Nav'
import { Shell }              from '@/components/layout/Shell'
import { getCheck }           from '@/lib/db/checks'
import { getBuyerReport }     from '@/lib/db/buyer-reports'
import { BuyerReportContent }   from '@/components/report/BuyerReportContent'
import { PaymentForm }          from '@/components/report/PaymentForm'
import { LockedReportPreview }  from '@/components/report/LockedReportPreview'
import { decrypt }            from '@/lib/crypto'
import { createClient }       from '@/lib/supabase/server'

interface Props {
  params:       { checkId: string }
  searchParams: { claim_token?: string }
}

export default async function BuyerReportPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token

  type CheckRow = NonNullable<Awaited<ReturnType<typeof getCheck>>>
  let row: CheckRow | null = null

  if (claimToken) {
    row = await getCheck(params.checkId, claimToken)
  } else {
    // Authenticated access: check belongs to the logged-in user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const candidate = await getCheck(params.checkId)
      if (candidate?.check.user_id === user.id) row = candidate
    }
  }

  if (!row || row.check.status !== 'complete') notFound()

  const report = await getBuyerReport(params.checkId)
  const isPaid = report?.status === 'paid'
  const plate  = decrypt(row.check.plate_encrypted as string).toUpperCase()

  // ── Paid — full report ─────────────────────────────────────────────────────
  if (isPaid) {
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
              <p className="font-body text-[13px] text-[#6B7280] mt-1">Laporan penuh — dibayar</p>
            </div>
            <BuyerReportContent
              check={row.check}
              results={row.results}
              plate={plate}
              askingPriceRm={report?.asking_price_rm ?? null}
              claimedMileageKm={report?.claimed_mileage_km ?? null}
            />
          </div>
        </Shell>
      </>
    )
  }

  // ── Unpaid — locked preview + payment form ────────────────────────────────
  // Require claim_token to pay (session-only users without claim_token can't pay)
  if (!claimToken) notFound()

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
          </div>

          <LockedReportPreview />

          <PaymentForm checkId={params.checkId} claimToken={claimToken} />
        </div>
      </Shell>
    </>
  )
}
