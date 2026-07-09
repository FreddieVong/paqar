import type { CachedMarketPrices } from '@/lib/db/market-prices'
import type { JomCheckResult, JomCheckStatus } from '@/lib/jomcheck'
import { filterOutlierPrices, filterListingsByYear } from '@/lib/price-stats'
import { InspectionCTA }   from './InspectionCTA'
import { InsuranceCTA }    from './InsuranceCTA'
import { CopyButton }      from './CopyButton'
import { JomCheckSection } from './JomCheckSection'
import { JomCheckUpsell }  from './JomCheckUpsell'

const fmt        = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const floorClean = (n: number) => { const u = n >= 50_000 ? 5_000 : 1_000; return Math.floor(n / u) * u }
const roundClean = (n: number) => { const u = n >= 50_000 ? 5_000 : 1_000; return Math.round(n / u) * u }

function medianOf(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

function dataConfidenceLevel(count: number): 'high' | 'medium' | 'limited' {
  if (count >= 10) return 'high'
  if (count >= 5)  return 'medium'
  return 'limited'
}

const CONFIDENCE_CONFIG = {
  high:    { label: 'Keyakinan data: Tinggi',    labelCls: 'text-[#15803D]', dot: 'bg-[#22C55E]', text: 'Cukup stabil untuk dijadikan panduan.' },
  medium:  { label: 'Keyakinan data: Sederhana', labelCls: 'text-[#B45309]', dot: 'bg-[#F59E0B]', text: 'Guna sebagai panduan awal sahaja.' },
  limited: { label: 'Data pasaran terhad',        labelCls: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]', text: 'Data terhad. Guna sebagai anggaran kasar sahaja.' },
} as const

function translateCoverType(ct: string): string {
  const lower = ct?.toLowerCase() ?? ''
  if (lower.includes('comprehensive')) return 'Komprehensif'
  if (lower.includes('third party'))   return 'Pihak Ketiga'
  if (lower.includes('fire'))          return 'Kebakaran & Kecurian'
  return ct
}

interface VehicleData {
  description?:      string
  registrationYear?: string
  make?:             string
  model?:            string
  body?:             string
  engineCc?:         string
  vin?:              string
  nvic?:             string
  insurance?: {
    insurer:      string
    coverType:    string
    policyStatus: string
  } | null
  valuation?: {
    wmNewPrice: number
    sumInsured: number | null
    family?:    string
    variant?:   string
  } | null
}

const MALAY_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']

function formatMalayDate(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

interface Props {
  plate:             string
  askingPriceRm?:    number | null
  vehicleData?:      Record<string, unknown> | null
  marketPrices?:     CachedMarketPrices | null
  addJomCheck?:      boolean
  jomcheckData?:     JomCheckResult | null
  jomcheckStatus?:   JomCheckStatus
  generatedAt?:      string | null
  upsellJomCheck?:   { checkId: string; claimToken: string } | null
  claimedMileageKm?: number | null
}

export function BuyerReportContent({ plate, askingPriceRm, vehicleData: rawVehicleData, marketPrices, addJomCheck, jomcheckData, jomcheckStatus, generatedAt, upsellJomCheck, claimedMileageKm }: Props) {
  const vehicleData = rawVehicleData as VehicleData | null | undefined
  const ins         = vehicleData?.insurance

  // Market price calculations — year-matched then outlier-trimmed (lib/price-stats.ts)
  const relevantListings = vehicleData?.registrationYear
    ? filterListingsByYear(marketPrices?.listings ?? [], vehicleData.registrationYear)
    : (marketPrices?.listings ?? [])
  const mPrices       = filterOutlierPrices(
    relevantListings
      .map(l => l.price)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0)
  )
  const marketMin     = mPrices.length ? Math.min(...mPrices) : null
  const marketMax     = mPrices.length ? Math.max(...mPrices) : null
  const marketMedian  = mPrices.length >= 2 ? medianOf(mPrices) : null
  const hasMarketData = askingPriceRm != null && marketMin != null && marketMax != null
  const priceVerdict  = !hasMarketData ? null
    : askingPriceRm! < marketMin! ? 'good_deal'    as const
    : askingPriceRm! <= marketMax! ? 'fair_price'  as const
    : askingPriceRm! <= marketMax! * 1.08 ? 'slightly_high' as const
    : 'overpriced' as const

  // Offer target anchored to median (not max) — median is the right negotiation anchor
  const offerAnchor = marketMedian ?? marketMax
  const offerHigh   = offerAnchor != null ? floorClean(offerAnchor) : 0
  const offerLow    = priceVerdict === 'overpriced'
    ? roundClean(offerHigh * 0.90)
    : roundClean(offerHigh * 0.93)

  // Depreciation-based verdict — fallback when no Mudah listings available.
  // Rates are tiered by brand segment; floored at 20% of new price.
  const wmNewPrice       = vehicleData?.valuation?.wmNewPrice ?? null
  const regYear          = vehicleData?.registrationYear ? parseInt(vehicleData.registrationYear) : null
  const hasDepreciation  = !hasMarketData && askingPriceRm != null && wmNewPrice != null && regYear != null

  const depreciationRate = (() => {
    const make = (vehicleData?.make ?? '').toLowerCase()
    if (['perodua', 'proton'].includes(make))                                           return 0.90
    if (['toyota', 'honda', 'mazda', 'nissan', 'mitsubishi', 'suzuki', 'subaru', 'kia', 'hyundai'].includes(make)) return 0.87
    if (['bmw', 'mercedes-benz', 'audi', 'volvo', 'lexus', 'porsche', 'jaguar', 'land rover'].includes(make))      return 0.78
    return 0.84
  })()

  const depreciationExpected = (hasDepreciation && regYear != null && wmNewPrice != null)
    ? wmNewPrice * Math.max(0.20, Math.pow(depreciationRate, new Date().getFullYear() - regYear))
    : null

  const depreciationVerdict = (() => {
    if (!hasDepreciation || depreciationExpected == null) return null
    if (askingPriceRm! < depreciationExpected * 0.90)  return 'good_deal'    as const
    if (askingPriceRm! <= depreciationExpected * 1.05)  return 'fair_price'  as const
    if (askingPriceRm! <= depreciationExpected * 1.15)  return 'slightly_high' as const
    return 'overpriced' as const
  })()

  const effectiveVerdict = priceVerdict ?? depreciationVerdict
  const verdictSource    = priceVerdict ? 'market' : depreciationVerdict ? 'depreciation' : null
  const vehicleNotFound  = !vehicleData?.make

  // Short identity (make + model) — the full official variant string lives in
  // the JPJ card; repeating the all-caps wall here would duplicate it
  const carIdentity = vehicleData?.make
    ? [
        `${vehicleData.make} ${vehicleData.model ?? ''}`.trim(),
        vehicleData.registrationYear ? `Didaftar ${vehicleData.registrationYear}` : null,
      ].filter(Boolean).join(' · ')
    : null
  const generatedLabel = generatedAt ? formatMalayDate(generatedAt) : ''

  return (
    <div className="space-y-5">

      {/* 0. Report header — the buyer's car, front and centre */}
      <div className="bg-[#14453d] rounded-[14px] p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.12em] text-white/45">
            Laporan Pembeli
          </p>
          {generatedLabel && (
            <p className="font-body text-[10px] text-white/40">Dijana: {generatedLabel}</p>
          )}
        </div>
        <p className="font-heading font-extrabold text-[30px] text-white leading-none tracking-tight mb-1.5">
          {plate}
        </p>
        {carIdentity && (
          <p className="font-body text-[13px] text-white/70">{carIdentity}</p>
        )}
      </div>

      {/* Vehicle not found — shown when RegCheck returns null for this plate */}
      {vehicleNotFound && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[14px] text-[#B45309] mb-2">
            Maklumat kenderaan tidak dijumpai
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed">
            Kami tidak dapat mengesahkan maklumat kenderaan untuk plat <strong>{plate}</strong>.
            Ini mungkin kerana plat tidak wujud, baru didaftarkan, atau belum dalam sistem kami.
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed mt-2">
            Soalan penjual di bawah masih berguna — gunakan ia untuk tanya penjual anda.
          </p>
          <a href="" className="font-body text-[13px] text-[#B45309] font-semibold underline underline-offset-2 mt-3 inline-block">
            Cuba muat semula →
          </a>
        </div>
      )}

      {/* 1. Keputusan Paqar — top decision card */}
      {effectiveVerdict != null && (() => {
        // A price FAR below the market floor is a scam/hidden-problem
        // signature (deposit scams, accident/flood cars), not a bargain —
        // escalate the guidance instead of celebrating
        const suspiciouslyCheap = effectiveVerdict === 'good_deal'
          && hasMarketData && askingPriceRm! < marketMin! * 0.8

        const kepConfig = ({
          good_deal:     { headline: 'BERBALOI',    sub: suspiciouslyCheap ? 'Harga jauh di bawah pasaran — berhati-hati.' : 'Tapi semak condition dan dokumen sebelum deposit.', headlineColor: 'text-[#0891B2]', bg: 'bg-[#F0FAFA]', border: 'border-[#99D4D1]' },
          fair_price:    { headline: 'WAJAR',       sub: 'Teruskan, tapi semak condition dan dokumen dulu.',  headlineColor: 'text-[#064E4A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
          slightly_high: { headline: 'AGAK MAHAL',  sub: 'Ada ruang untuk tawar sebelum setuju.',            headlineColor: 'text-[#B45309]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
          overpriced:    { headline: 'MAHAL',       sub: 'Jangan bayar deposit dulu.',                       headlineColor: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
        } as const)[effectiveVerdict]

        const cadangan = ({
          good_deal: suspiciouslyCheap
            ? 'Harga macam ni selalunya ada sebab — scam deposit, kereta accident/banjir, atau masalah dokumen. Jangan bayar apa-apa sebelum jumpa kereta, penjual dan geran sendiri.'
            : 'Harga nampak berbaloi. Fokus semak condition, dokumen dan inspection sebelum bayar deposit.',
          fair_price:    'Harga nampak wajar. Masih boleh minta sedikit kurang sebelum setuju.',
          slightly_high: hasMarketData
            ? `Target RM${fmt(offerLow)}–RM${fmt(offerHigh)}. Gunakan skrip di bawah.`
            : 'Harga sedikit tinggi berbanding anggaran. Minta harga lebih baik sebelum setuju.',
          overpriced: hasMarketData
            ? `Target RM${fmt(offerLow)}–RM${fmt(offerHigh)}. Kalau seller tak boleh turun, cari unit lain.`
            : 'Harga jauh lebih tinggi daripada anggaran. Tawar dengan yakin atau cari unit lain.',
        } as const)[effectiveVerdict]

        return (
          <div className={`${kepConfig.bg} border ${kepConfig.border} rounded-[14px] p-5`}>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
              Keputusan Paqar
            </p>
            <p className={`font-heading font-extrabold text-[22px] leading-tight mb-1 ${kepConfig.headlineColor}`}>
              {kepConfig.headline}
            </p>
            <p className="font-heading font-bold text-[15px] text-[#111827] mb-4">
              {kepConfig.sub}
            </p>
            <div className="space-y-2.5">
              {askingPriceRm != null && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
                  <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
                </div>
              )}
              {hasMarketData && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Market semasa</p>
                  <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(marketMin!)} – RM{fmt(marketMax!)}</p>
                </div>
              )}
              {hasMarketData && (effectiveVerdict === 'overpriced' || effectiveVerdict === 'slightly_high') && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Anggaran lebih tinggi</p>
                  <p className="font-heading font-bold text-[14px] text-[#DC2626]">RM{fmt(askingPriceRm! - marketMax!)}+</p>
                </div>
              )}
              <div className="pt-2 border-t border-black/10">
                <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Cadangan</p>
                <p className="font-heading font-bold text-[13px] text-[#111827]">{cadangan}</p>
              </div>
              {verdictSource === 'depreciation' && (
                <p className="font-body text-[10px] text-[#9CA3AF]">
                  Anggaran berdasarkan harga baru & umur kenderaan. Tiada data pasaran semasa untuk model ini.
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {/* JomCheck — shown only if purchased; hidden for RM12 basic reports */}
      {addJomCheck && (
        jomcheckStatus === 'success' && jomcheckData
          ? <JomCheckSection data={jomcheckData} />
          : (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Rekod tuntutan insurans belum dapat disemak buat masa ini.
                Laporan Paqar anda masih boleh digunakan.
              </p>
            </div>
          )
      )}

      {/* RM88 add-on upsell — RM12 buyers who haven't added the claim check */}
      {!addJomCheck && upsellJomCheck && (
        <JomCheckUpsell checkId={upsellJomCheck.checkId} claimToken={upsellJomCheck.claimToken} />
      )}

      {/* 2. Perbandingan Harga */}
      {!vehicleNotFound && (vehicleData?.valuation || askingPriceRm != null || (marketPrices?.listings.length ?? 0) > 0) && (() => {
        const val           = vehicleData?.valuation
        const wmNewPrice    = val?.wmNewPrice ?? null
        const valVariantRaw = val?.family && val?.variant
          ? `${val.family} ${val.variant}`.trim()
          : (val?.family ?? null)
        const valVariant = valVariantRaw
          ? valVariantRaw.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : null

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Perbandingan Harga
            </p>

            {mPrices.length > 0 && marketPrices && (() => {
              const median  = marketMedian!
              const daysAgo = Math.floor((Date.now() - new Date(marketPrices.fetchedAt).getTime()) / 86_400_000)
              const conf    = CONFIDENCE_CONFIG[dataConfidenceLevel(mPrices.length)]

              // Filtering is a feature — say it. A buyer who later browses the
              // marketplace sees MORE results than our chips (fuzzy search mixes
              // other years in); without this line, our rigor reads as gaps.
              const shownCount    = relevantListings.filter(l => mPrices.includes(l.price)).length
              const excludedCount = (marketPrices.listings.length ?? 0) - shownCount

              // Trade-in estimate (only when median is valid)
              const tradeInLow  = Math.round(median * 0.80 / 1000) * 1000
              const tradeInHigh = Math.round(median * 0.85 / 1000) * 1000


              return (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-[12px] text-[#111827]">Bukti Harga Pasaran</p>
                    <p className="font-body text-[10px] text-[#9CA3AF]">
                      {daysAgo === 0 ? 'Hari ini' : `${daysAgo} hari lalu`}
                    </p>
                  </div>

                  {/* Median — prominent anchor */}
                  <div className="flex items-center justify-between bg-[#F0FAFA] rounded-lg px-3 py-2">
                    <p className="font-body text-[12px] text-[#6B7280]">Harga tengah pasaran</p>
                    <p className="font-heading font-bold text-[14px] text-[#064E4A]">RM{fmt(median)}</p>
                  </div>

                  <p className="font-body text-[11px] text-[#6B7280]">
                    {vehicleData?.registrationYear
                      ? `Harga listing dijumpai (tahun ${vehicleData.registrationYear} sahaja):`
                      : 'Harga listing dijumpai:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {relevantListings.filter(l => mPrices.includes(l.price)).map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                        className="inline-block bg-[#F0FAFA] border border-[#99D4D1] rounded-lg px-2.5 py-1 font-heading font-bold text-[12px] text-[#064E4A] hover:bg-[#E0F2F1] transition-colors">
                        RM{fmt(l.price)}
                      </a>
                    ))}
                  </div>

                  {/* Methodology + confidence */}
                  <p className="font-body text-[11px] text-[#9CA3AF]">
                    Berdasarkan {mPrices.length} listing serupa di pasaran
                    {excludedCount > 0 ? ` · ${excludedCount} listing ditapis (tahun berbeza atau harga luar biasa)` : ''}
                  </p>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
                      <span className={`font-body text-[11px] font-semibold ${conf.labelCls}`}>{conf.label}</span>
                    </div>
                    <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">{conf.text}</p>
                  </div>

                  {/* Trade-in estimate */}
                  <div className="mt-1 pt-3 border-t border-[#F3F4F6]">
                    <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Anggaran trade-in</p>
                    <p className="font-heading font-bold text-[14px] text-[#111827]">
                      RM{fmt(tradeInLow)} – RM{fmt(tradeInHigh)}
                    </p>
                    <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">
                      Lebih kurang harga yang dealer akan bagi untuk kereta ni. Boleh guna ni bila nak tawar harga.
                    </p>
                    <p className="font-body text-[10px] text-[#9CA3AF] mt-1 leading-relaxed">
                      Anggaran sahaja. Bergantung pada kondisi, mileage dan pasaran semasa.
                    </p>
                  </div>

                  {askingPriceRm != null && (
                    <a
                      href={`/kira-ansuran-kereta?harga=${askingPriceRm}`}
                      className="font-body text-[12px] text-[#064E4A] underline underline-offset-2 mt-1 inline-block"
                    >
                      Kira ansuran bulanan untuk harga ini →
                    </a>
                  )}
                </div>
              )
            })()}

            {/* Original new price — only shown when it's the verdict's basis
                (depreciation fallback). Next to live market data it just
                makes any used price look cheap and muddies the comparison. */}
            {wmNewPrice != null && verdictSource !== 'market' && (
              <div className="bg-[#F9FAFB] rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Harga baru asal kenderaan ini</p>
                  <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(wmNewPrice)}</p>
                </div>
                {valVariant && (
                  <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5">Berdasarkan: {valVariant}</p>
                )}
              </div>
            )}

            {askingPriceRm == null && wmNewPrice != null && (
              <p className="font-body text-[11px] text-[#9CA3AF] mt-1">
                Masukkan harga yang penjual minta untuk perbandingan lebih tepat.
              </p>
            )}

            {vehicleData?.make && (() => {
              const mk           = vehicleData.make ?? ''
              const modelKeyword = vehicleData.model
                ? (vehicleData.model.match(/^\d+/)?.[0] ?? vehicleData.model.split(/[\s-]/)[0] ?? vehicleData.model)
                : ''
              const yr       = vehicleData.registrationYear ?? ''
              const searchTm = [mk, modelKeyword, yr].filter(Boolean).join(' ')
              const mudahUrl = `https://www.mudah.my/Malaysia/Cars-for-sale?q=${encodeURIComponent(searchTm)}`
              const carlistUrl = `https://www.carlist.my/used-cars-for-sale/${mk.toLowerCase().replace(/\s+/g, '-')}/${modelKeyword.toLowerCase().replace(/\s+/g, '-')}${yr ? `/year-${yr}` : ''}/malaysia`
              const hasLive  = (marketPrices?.listings.length ?? 0) > 0
              return !hasLive ? (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F3F4F6]">
                  <p className="font-body text-[12px] text-[#6B7280]">Tengok harga jualan serupa di pasaran</p>
                  <div className="flex items-center gap-3">
                    <a href={mudahUrl} target="_blank" rel="noopener noreferrer"
                      className="font-heading font-bold text-[12px] text-[#064E4A]">Mudah →</a>
                    <a href={carlistUrl} target="_blank" rel="noopener noreferrer"
                      className="font-heading font-bold text-[12px] text-[#064E4A]">Carlist →</a>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )
      })()}

      {/* 3. Skrip Rundingan */}
      {effectiveVerdict && askingPriceRm != null && vehicleData?.make && (() => {
        const make    = String(vehicleData.make ?? '')
        const model   = String(vehicleData.model ?? '')
        const year    = String(vehicleData.registrationYear ?? '')
        const carName = [make, model, year].filter(Boolean).join(' ')

        // Market-data scripts include live RM ranges; depreciation scripts use expected value as target
        const depOffer = depreciationExpected != null ? fmt(roundClean(depreciationExpected * 0.95)) : null
        const listingCount = mPrices.length
        const scripts: Record<typeof effectiveVerdict, string> = hasMarketData ? {
          overpriced:    `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah semak ${listingCount} listing serupa di pasaran — harga tengah pasaran sekarang RM${fmt(marketMedian!)}, dalam julat RM${fmt(marketMin!)}–RM${fmt(marketMax!)}.\n\nHarga RM${fmt(askingPriceRm)} agak tinggi berbanding pasaran. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM${fmt(offerLow)}–RM${fmt(offerHigh)}?`,
          slightly_high: `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah semak ${listingCount} listing serupa di pasaran — harga tengah pasaran sekarang RM${fmt(marketMedian!)}, dalam julat RM${fmt(marketMin!)}–RM${fmt(marketMax!)}.\n\nHarga RM${fmt(askingPriceRm)} sedikit di atas pasaran. Boleh consider sekitar RM${fmt(offerLow)}–RM${fmt(offerHigh)}?`,
          fair_price:    `Salam, saya berminat dengan ${carName} tuan/puan.\n\nSaya dah semak ${listingCount} listing serupa — harga tengah pasaran sekitar RM${fmt(marketMedian!)}. Harga tuan/puan nampak okay. Apa harga terbaik yang boleh offer?`,
          good_deal:     `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga ni nampak menarik berbanding pasaran. Bila boleh saya datang tengok? Saya serius nak beli.`,
        } : {
          overpriced:    `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nBerdasarkan harga baru dan umur kenderaan ini, harga RM${fmt(askingPriceRm)} nampak agak tinggi. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM${depOffer ?? '...'}?`,
          slightly_high: `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nBerdasarkan harga baru dan umur kenderaan ini, harga RM${fmt(askingPriceRm)} sedikit tinggi. Boleh consider harga yang lebih berpatutan?`,
          fair_price:    `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga nampak okay untuk kereta umur ini. Apa harga terbaik yang boleh tuan/puan offer?`,
          good_deal:     `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga nampak menarik. Bila boleh saya datang tengok kereta?`,
        }
        const script = scripts[effectiveVerdict]

        // Follow-up for when the seller pushes back — negotiations rarely end
        // after one message. Only shown when we have a concrete target price.
        const followUpTarget = (effectiveVerdict === 'overpriced' || effectiveVerdict === 'slightly_high')
          ? (hasMarketData ? fmt(offerHigh) : depOffer)
          : null
        const followUpScript = followUpTarget
          ? `Saya faham tuan/puan ada harga sendiri. Tapi berdasarkan listing yang saya semak, RM${followUpTarget} memang harga pasaran sekarang.\n\nKalau boleh buat RM${followUpTarget}, saya boleh confirm minggu ini juga. Kalau tak boleh, takpe — terima kasih, saya consider unit lain.`
          : null

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Skrip Rundingan
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
              <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                {script}
              </p>
            </div>
            <CopyButton text={script} />

            {followUpScript && (
              <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-2">
                  Kalau seller kata harga dah final:
                </p>
                <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                    {followUpScript}
                  </p>
                </div>
                <CopyButton text={followUpScript} />
              </div>
            )}
          </div>
        )
      })()}

      {/* 4. Data Kenderaan Rasmi (JPJ) */}
      {vehicleData?.make && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
              Data Kenderaan Rasmi
            </p>
            <span className="font-body text-[10px] text-[#9CA3AF]">Sumber: JPJ</span>
          </div>
          <p className="font-heading font-extrabold text-[18px] text-[#111827] mb-3 leading-tight">
            {vehicleData.description ?? `${vehicleData.make} ${vehicleData.model}`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Tahun Daftar',  value: vehicleData.registrationYear },
              { label: 'Enjin',         value: vehicleData.engineCc
                  ? `${Number.isFinite(parseFloat(vehicleData.engineCc)) ? Math.round(parseFloat(vehicleData.engineCc)) : vehicleData.engineCc}cc`
                  : null },
              { label: 'Jenis Badan',   value: vehicleData.body },
              { label: 'Nombor Rangka', value: vehicleData.vin ? `${vehicleData.vin.slice(0, -4)}****` : null },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="bg-[#F9FAFB] rounded-lg px-3 py-2">
                <p className="font-body text-[10px] text-[#9CA3AF] uppercase tracking-[.05em]">{row.label}</p>
                <p className="font-heading font-bold text-[13px] text-[#111827] mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4b. Semakan Mileage — plausibility of the seller's CLAIMED reading.
          Paqar can't verify the real odometer; this checks whether the claimed
          number is believable for the car's age (MY average ~12-20k km/yr). */}
      {claimedMileageKm != null && claimedMileageKm > 0 && vehicleData?.registrationYear && (() => {
        const carAge    = Math.max(1, new Date().getFullYear() - parseInt(vehicleData.registrationYear))
        const kmPerYear = Math.round(claimedMileageKm / carAge)
        const level     = kmPerYear < 10_000 ? 'low' : kmPerYear <= 25_000 ? 'normal' : 'high'

        const cfg = ({
          low: {
            badge:    'RENDAH untuk umur kereta',
            badgeCls: 'text-[#B45309]',
            note:     'Boleh jadi genuine — tapi boleh jadi juga meter dah diputar. Minta rekod servis penuh untuk sahkan.',
          },
          normal: {
            badge:    'MUNASABAH untuk umur kereta',
            badgeCls: 'text-[#15803D]',
            note:     'Normal untuk kegunaan biasa di Malaysia (12–20k km setahun). Tetap minta rekod servis untuk sahkan.',
          },
          high: {
            badge:    'TINGGI untuk umur kereta',
            badgeCls: 'text-[#B45309]',
            note:     'Lebih tinggi dari biasa — mungkin bekas e-hailing atau selalu outstation. Guna ini untuk tawar harga lebih rendah.',
          },
        } as const)[level]

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Semakan Mileage
            </p>
            <div className="flex items-center justify-between mb-1">
              <p className="font-heading font-extrabold text-[20px] text-[#111827]">
                {claimedMileageKm.toLocaleString()} km
              </p>
              <p className="font-body text-[12px] text-[#6B7280]">≈ {kmPerYear.toLocaleString()} km/tahun</p>
            </div>
            <p className={`font-heading font-bold text-[13px] mb-2 ${cfg.badgeCls}`}>{cfg.badge}</p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">{cfg.note}</p>
            <p className="font-body text-[10px] text-[#9CA3AF] mt-2">
              Berdasarkan mileage yang penjual bagi — Paqar tidak dapat sahkan bacaan sebenar meter.
            </p>
          </div>
        )
      })()}

      {/* 5. Status Insurans */}
      {ins && (
        <div className={`border rounded-[14px] p-5 ${
          ins.policyStatus?.toLowerCase().includes('active') ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
        }`}>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
            Status Insurans
          </p>
          <div className="space-y-1.5">
            <span className={`font-heading font-extrabold text-[15px] ${
              ins.policyStatus?.toLowerCase().includes('active') ? 'text-[#15803D]' : 'text-[#DC2626]'
            }`}>
              {ins.policyStatus?.toLowerCase().includes('active') ? '✓ Aktif' : '✕ Tamat Tempoh'}
            </span>
            <p className="font-body text-[13px] text-[#374151]">{ins.insurer}</p>
            <p className="font-body text-[12px] text-[#6B7280]">{translateCoverType(ins.coverType)}</p>
            {!ins.policyStatus?.toLowerCase().includes('active') && (
              <p className="font-body text-[12px] text-[#6B7280] leading-relaxed pt-1">
                Ini biasa untuk kereta yang nak dijual. Pastikan anda beli insurans baru
                sebelum tukar nama.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 6. Soalan Wajib Tanya Seller — base questions + conditions specific to this car */}
      {(() => {
        const carAge = vehicleData?.registrationYear
          ? new Date().getFullYear() - parseInt(vehicleData.registrationYear)
          : null
        const insuranceExpired = ins != null && !ins.policyStatus?.toLowerCase().includes('active')

        const questions = [
          'Ada accident besar sebelum ini?',
          'Ada flood damage?',
          'Kereta masih ada loan bank?',
          'Geran atas nama siapa?',
          'Boleh buat inspection sebelum bayar deposit?',
          ...(effectiveVerdict === 'overpriced' || effectiveVerdict === 'slightly_high'
            ? ['Kenapa harga ni lebih tinggi dari listing serupa di pasaran?'] : []),
          ...(carAge != null && carAge >= 8
            ? ['Timing belt dan servis besar dah buat? Ada resit?'] : []),
          ...(insuranceExpired
            ? ['Kenapa insurans dah tamat? Kereta ni lama tak diguna?'] : []),
        ].slice(0, 7)

        const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
              Soalan Wajib Tanya Seller
            </p>
            <div className="space-y-3 mb-4">
              {questions.map((q, i) => (
                <div key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
            <CopyButton text={questionsText} />
          </div>
        )
      })()}

      {/* 7. Checklist Deposit */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
          Checklist sebelum bayar deposit
        </p>
        <div className="space-y-3">
          {[
            'Nombor rangka sama dengan geran',
            'Geran atas nama penjual',
            'Semak loan / hutang bank',
            'Semak saman tertunggak',
            'Cukai jalan masih sah',
            'Dapat resit deposit bertulis',
            'Nyatakan syarat refund deposit',
            'Confirm tarikh serah geran dan kunci',
          ].map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-[18px] h-[18px] rounded border-2 border-[#D1D5DB] flex-shrink-0 mt-0.5" />
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Langkah Seterusnya — end with a plan, not a trailing CTA */}
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#15803D] mb-4">
          Langkah Seterusnya
        </p>
        <div className="space-y-3">
          {[
            'Hantar skrip rundingan ke seller melalui WhatsApp',
            'Kalau harga dah okay — buat inspection dulu, jangan bayar deposit lagi',
            'Bawa checklist di atas semasa jumpa seller',
            'Dah confirm beli? Dapatkan insurans sebelum tukar nama',
          ].map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-[20px] h-[20px] rounded-full bg-[#15803D] text-white font-heading font-bold text-[11px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 9. CTAs */}
      <InspectionCTA plate={plate} />
      <InsuranceCTA />

      <p className="font-body text-[11px] text-[#D1D5DB] text-center pt-2">
        Disediakan oleh Paqar · paqar.my
      </p>

    </div>
  )
}
