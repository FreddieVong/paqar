import { notFound }             from 'next/navigation'
export const dynamic = 'force-dynamic'
import { Nav }                  from '@/components/layout/Nav'
import { Shell }                from '@/components/layout/Shell'
import { getCheck }             from '@/lib/db/checks'
import { getBuyerReport, setVehicleApiData } from '@/lib/db/buyer-reports'
import { BuyerReportContent }   from '@/components/report/BuyerReportContent'
import { PaymentForm }          from '@/components/report/PaymentForm'
import { LockedReportPreview }  from '@/components/report/LockedReportPreview'
import { CollapsibleSampleReport } from '@/components/report/CollapsibleSampleReport'
import { BuyerReportPitch }     from '@/components/report/BuyerReportPitch'
import { decrypt }              from '@/lib/crypto'
import { createClient }         from '@/lib/supabase/server'
import { lookupVehicle }              from '@/lib/vehicleapi'
import { getValuationByNvic }         from '@/lib/db/vehicle-valuations'
import { getCachedMarketPrices,
         fetchAndCacheMarketPrices }  from '@/lib/db/market-prices'
import type { CachedMarketPrices }    from '@/lib/db/market-prices'
import { buildMarketModelKeyword }    from '@/lib/market-keyword'
import { AnalyticsEvent }             from '@/components/layout/AnalyticsEvent'
import { AskingPriceForm }            from '@/components/report/AskingPriceForm'
import { MarketPricePoller }          from '@/components/report/MarketPricePoller'
import { ReportFeedback }             from '@/components/report/ReportFeedback'

interface Props {
  params:       { checkId: string }
  searchParams: { claim_token?: string; asking_price?: string; source?: string }
}

export default async function BuyerReportPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token

  type CheckRow = NonNullable<Awaited<ReturnType<typeof getCheck>>>
  let row: CheckRow | null = null

  if (claimToken) {
    row = await getCheck(params.checkId, claimToken)
  }
  // Fallback: if claim_token lookup failed, try auth ownership check
  if (!row) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const candidate = await getCheck(params.checkId)
        if (candidate?.check.user_id === user.id) row = candidate
      }
    } catch {
      // non-fatal
    }
  }

  if (!row || row.check.status !== 'complete') notFound()

  const report = await getBuyerReport(params.checkId)
  const isPaid = report?.status === 'paid'
  const plate  = decrypt(row.check.plate_encrypted as string).toUpperCase()

  // ── Paid — full report ─────────────────────────────────────────────────────
  if (isPaid && report) {
    // Lazy fetch: call VehicleAPI once, store in DB, serve from cache on subsequent views
    let vehicleData = report.vehicleapi_data as Record<string, unknown> | null ?? null
    if (!vehicleData) {
      const apiResult = await lookupVehicle(plate)
      if (apiResult) {
        const valuation = await getValuationByNvic(
          apiResult.nvic,
          { make: apiResult.make, year: apiResult.registrationYear, model: apiResult.model }
        ).catch(() => null)
        vehicleData = { ...apiResult, valuation: valuation ?? null }
        setVehicleApiData(report.id, vehicleData).catch(() => {}) // non-blocking
      }
    }

    // Market prices — serve from cache, refresh in background if stale
    let marketPrices: CachedMarketPrices | null = null
    if (vehicleData?.make && vehicleData?.model && vehicleData?.registrationYear) {
      const mk      = vehicleData.make as string
      const rawModel = vehicleData.model as string
      const yr      = vehicleData.registrationYear as string
      const desc    = (vehicleData.description as string) ?? ''

      const mo = buildMarketModelKeyword(rawModel, desc)

      marketPrices = await getCachedMarketPrices(mk, mo, yr).catch(() => null)
      if (!marketPrices) {
        const scrape = fetchAndCacheMarketPrices(mk, mo, yr).catch(() => {})
        await Promise.race([scrape, new Promise(r => setTimeout(r, 8_000))])
        marketPrices = await getCachedMarketPrices(mk, mo, yr).catch(() => null)
      }
    }

    return (
      <>
        <Nav />
        <Shell>
          <div className="pt-5 pb-6 space-y-5">
            <AnalyticsEvent event="report_page_viewed" properties={{ is_paid: true }} />
            <div>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#064E4A] mb-1">
                Laporan untuk
              </p>
              <h1 className="font-heading font-extrabold text-[38px] tracking-tight text-[#111827] leading-none">
                {plate}
              </h1>
            </div>
            {report.asking_price_rm == null && vehicleData && claimToken && (
              <AskingPriceForm checkId={params.checkId} claimToken={claimToken} />
            )}
            {!!vehicleData?.make && !marketPrices && (
              <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] px-4 py-3">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#BBF7D0] border-t-[#064E4A] animate-spin flex-shrink-0" />
                <p className="font-body text-[13px] text-[#374151]">Sedang mencari harga pasaran…</p>
              </div>
            )}
            <MarketPricePoller active={!!vehicleData?.make && !marketPrices} />
            <BuyerReportContent
              plate={plate}
              askingPriceRm={report.asking_price_rm ?? null}
              vehicleData={vehicleData}
              marketPrices={marketPrices}
            />
            <ReportFeedback checkId={params.checkId} plate={plate} />
          </div>
        </Shell>
      </>
    )
  }

  // ── Unpaid — locked preview + payment form ────────────────────────────────
  // Require claim_token to pay (session-only users without claim_token can't pay)
  if (!claimToken) notFound()

  const isPlateFlow = searchParams.source === 'plate'

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-5 pb-6 space-y-5">
          <AnalyticsEvent event="report_page_viewed" properties={{ is_paid: false }} />
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#064E4A] mb-1">
              Laporan untuk
            </p>
            <h1 className="font-heading font-extrabold text-[38px] tracking-tight text-[#111827] leading-none">
              {plate}
            </h1>
          </div>

          {isPlateFlow ? (
            <>
              <BuyerReportPitch plate={plate} />
              <PaymentForm
                checkId={params.checkId}
                claimToken={claimToken}
                defaultAskingPrice={searchParams.asking_price ? parseInt(searchParams.asking_price, 10) : undefined}
              />
              <CollapsibleSampleReport />
            </>
          ) : (
            <>
              <LockedReportPreview />
              <PaymentForm
                checkId={params.checkId}
                claimToken={claimToken}
                defaultAskingPrice={searchParams.asking_price ? parseInt(searchParams.asking_price, 10) : undefined}
              />
            </>
          )}
        </div>
      </Shell>
    </>
  )
}
