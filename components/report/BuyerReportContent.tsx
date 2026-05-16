import type { Check, CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord } from '@/types/api'
import type { CachedMarketPrices } from '@/lib/db/market-prices'
import { InspectionCTA } from './InspectionCTA'
import { InsuranceCTA }  from './InsuranceCTA'
import { CopyButton }    from './CopyButton'

const VEHICLE_SOURCES = ['pdrm', 'jpj', 'aes', 'local_councils'] as const
type VehicleSource = typeof VEHICLE_SOURCES[number]

const fmt        = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const floorClean = (n: number) => { const u = n >= 50_000 ? 5_000 : 1_000; return Math.floor(n / u) * u }
const roundClean = (n: number) => { const u = n >= 50_000 ? 5_000 : 1_000; return Math.round(n / u) * u }

function translateCoverType(ct: string): string {
  const lower = ct?.toLowerCase() ?? ''
  if (lower.includes('comprehensive')) return 'Komprehensif'
  if (lower.includes('third party'))   return 'Pihak Ketiga'
  if (lower.includes('fire'))          return 'Kebakaran & Kecurian'
  return ct
}

function getSamanTotal(results: CheckResult[]): number {
  return results.reduce((total, r) => {
    if (r.status !== 'hit') return total
    const data = r.data as SourceData | null
    if (!data || !('samans' in data)) return total
    return total + data.samans.reduce((s: number, x: SamanRecord) => s + x.amount, 0)
  }, 0)
}

function getSamanCount(results: CheckResult[]): number {
  return results.reduce((count, r) => {
    if (r.status !== 'hit') return count
    const data = r.data as SourceData | null
    if (!data || !('samans' in data)) return count
    return count + data.samans.length
  }, 0)
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

interface Props {
  check:             Check
  results:           CheckResult[]
  plate:             string
  askingPriceRm?:    number | null
  claimedMileageKm?: number | null
  vehicleData?:      Record<string, unknown> | null
  marketPrices?:     CachedMarketPrices | null
}

export function BuyerReportContent({ check: _check, results, plate, askingPriceRm, claimedMileageKm: _claimedMileageKm, vehicleData: rawVehicleData, marketPrices }: Props) {
  const vehicleData    = rawVehicleData as VehicleData | null | undefined
  const vehicleResults = results.filter(r => VEHICLE_SOURCES.includes(r.source as VehicleSource))
  const samanTotal     = getSamanTotal(vehicleResults)
  const samanCount     = getSamanCount(vehicleResults)
  const ins            = vehicleData?.insurance

  // Market price calculations
  const mPrices      = marketPrices?.listings.map(l => l.price) ?? []
  const marketMin    = mPrices.length ? Math.min(...mPrices) : null
  const marketMax    = mPrices.length ? Math.max(...mPrices) : null
  const hasMarketData = askingPriceRm != null && marketMin != null && marketMax != null
  const priceVerdict = !hasMarketData ? null
    : askingPriceRm! < marketMin! ? 'good_deal'    as const
    : askingPriceRm! <= marketMax! ? 'fair_price'  as const
    : askingPriceRm! <= marketMax! * 1.08 ? 'slightly_high' as const
    : 'overpriced' as const

  // Proportional rounded offer range (only used for slightly_high or overpriced)
  const offerHigh = marketMax != null ? floorClean(marketMax) : 0
  const offerLow  = priceVerdict === 'overpriced'
    ? roundClean(offerHigh * 0.93)
    : roundClean(offerHigh * 0.95)

  return (
    <div className="space-y-5">

      {/* 1. Keputusan Paqar — top decision card */}
      {(priceVerdict != null || samanCount > 0) && (() => {
        const kepConfig = priceVerdict ? ({
          good_deal:     { headline: 'Harga Bagus',          sub: 'Tapi semak condition dan dokumen sebelum deposit.', headlineColor: 'text-[#0891B2]', bg: 'bg-[#F0FAFA]', border: 'border-[#99D4D1]' },
          fair_price:    { headline: 'Harga Wajar',          sub: 'Teruskan, tapi semak condition dan dokumen dulu.',  headlineColor: 'text-[#064E4A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
          slightly_high: { headline: 'Sedikit Tinggi',       sub: 'Ada ruang untuk tawar sebelum setuju.',            headlineColor: 'text-[#B45309]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
          overpriced:    { headline: 'Harga Terlalu Tinggi', sub: 'Jangan bayar deposit dulu.',                       headlineColor: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
        } as const)[priceVerdict] : { headline: 'Semak Sebelum Deposit', sub: 'Ada saman yang perlu dijelaskan.', headlineColor: 'text-[#DC2626]' as const, bg: 'bg-[#FEF2F2]' as const, border: 'border-[#FECACA]' as const }

        const cadangan = priceVerdict ? ({
          good_deal:     'Harga nampak bagus. Fokus semak condition, dokumen dan inspection sebelum bayar deposit.',
          fair_price:    'Harga nampak wajar. Jika condition biasa, masih boleh minta sedikit kurang.',
          slightly_high: `Target RM${fmt(offerLow)}–RM${fmt(offerHigh)}. Gunakan skrip di bawah.`,
          overpriced:    `Target RM${fmt(offerLow)}–RM${fmt(offerHigh)}. Kalau seller tak boleh turun, cari unit lain.`,
        } as const)[priceVerdict] : 'Minta penjual jelaskan saman dahulu.'

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
              {hasMarketData && (priceVerdict === 'overpriced' || priceVerdict === 'slightly_high') && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Anggaran lebih tinggi</p>
                  <p className="font-heading font-bold text-[14px] text-[#DC2626]">RM{fmt(askingPriceRm! - marketMax!)}+</p>
                </div>
              )}
              {samanCount > 0 && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Saman dijumpai</p>
                  <p className="font-heading font-bold text-[14px] text-[#DC2626]">RM{fmt(samanTotal)}</p>
                </div>
              )}
              <div className="pt-2 border-t border-black/10">
                <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Cadangan</p>
                <p className="font-heading font-bold text-[13px] text-[#111827]">{cadangan}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 2. Perbandingan Harga */}
      {(vehicleData?.valuation || askingPriceRm != null || (marketPrices?.listings.length ?? 0) > 0) && (() => {
        const val           = vehicleData?.valuation
        const wmNewPrice    = val?.wmNewPrice ?? null
        const valVariantRaw = val?.family && val?.variant
          ? `${val.family} ${val.variant}`.trim()
          : (val?.family ?? null)
        const valVariant = valVariantRaw
          ? valVariantRaw.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : null
        const pct = wmNewPrice && askingPriceRm != null
          ? Math.round((1 - askingPriceRm / wmNewPrice) * 100)
          : null

        const verdictDisplay = priceVerdict ? ({
          good_deal:     { text: 'Harga Bagus — tapi semak condition dulu',          color: 'text-[#0891B2]', sub: 'Jangan bayar deposit sebelum semak dokumen, JPJ, dan condition kereta.' },
          fair_price:    { text: 'Harga Wajar — boleh teruskan, tapi semak dulu',    color: 'text-[#064E4A]', sub: 'Harga nampak dalam julat pasaran. Pastikan rekod dan condition kereta jelas.' },
          slightly_high: { text: 'Sedikit Tinggi — masih boleh tawar',               color: 'text-[#B45309]', sub: 'Harga sedikit atas pasaran. Gunakan skrip tawar untuk minta harga lebih baik.' },
          overpriced:    { text: 'Harga Terlalu Tinggi — jangan bayar deposit dulu', color: 'text-[#DC2626]', sub: 'Harga seller lebih tinggi daripada kereta serupa. Gunakan skrip tawar sebelum jumpa seller.' },
        } as const)[priceVerdict] : null

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Perbandingan Harga
            </p>

            {askingPriceRm != null && (
              <div className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5 mb-3">
                <p className="font-body text-[12px] text-[#6B7280]">Harga diminta penjual</p>
                <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
              </div>
            )}

            {marketPrices && marketPrices.listings.length > 0 && (() => {
              const prices  = marketPrices.listings.map(l => l.price)
              const minP    = Math.min(...prices)
              const maxP    = Math.max(...prices)
              const daysAgo = Math.floor((Date.now() - new Date(marketPrices.fetchedAt).getTime()) / 86_400_000)
              return (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-[12px] text-[#111827]">Bukti Harga Pasaran</p>
                    <p className="font-body text-[10px] text-[#9CA3AF]">
                      {daysAgo === 0 ? 'Hari ini' : `${daysAgo} hari lalu`}
                    </p>
                  </div>
                  <p className="font-body text-[11px] text-[#6B7280]">Harga listing dijumpai:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {marketPrices.listings.map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                        className="inline-block bg-[#F0FAFA] border border-[#99D4D1] rounded-lg px-2.5 py-1 font-heading font-bold text-[12px] text-[#064E4A] hover:bg-[#E0F2F1] transition-colors">
                        RM{fmt(l.price)}
                      </a>
                    ))}
                  </div>
                  <p className="font-body text-[11px] text-[#6B7280]">
                    Berdasarkan {prices.length} kereta serupa yang dijumpai.
                  </p>
                  {minP !== maxP && (
                    <p className="font-body text-[11px] text-[#6B7280]">
                      Julat: RM{fmt(minP)} – RM{fmt(maxP)}
                    </p>
                  )}
                  <a href={marketPrices.searchUrl} target="_blank" rel="noopener noreferrer"
                    className="font-body text-[11px] text-[#064E4A] hover:underline block">
                    Lihat semua listing di Mudah →
                  </a>
                </div>
              )
            })()}

            {verdictDisplay ? (
              <div className="mb-3 space-y-1">
                <p className={`font-heading font-bold text-[13px] ${verdictDisplay.color}`}>{verdictDisplay.text}</p>
                <p className="font-body text-[11px] text-[#6B7280]">{verdictDisplay.sub}</p>
              </div>
            ) : pct != null ? (
              <p className={`font-body text-[12px] mb-3 ${pct >= 0 ? 'text-[#064E4A]' : 'text-[#B45309]'}`}>
                {pct >= 0
                  ? `${pct}% di bawah harga baru — wajar untuk kenderaan ini`
                  : `${Math.abs(pct)}% melebihi harga baru — semak perbandingan sebelum setuju`}
              </p>
            ) : null}

            {wmNewPrice != null && (
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

      {/* 3. Skrip Tawar Seller */}
      {hasMarketData && priceVerdict && vehicleData?.make && (() => {
        const make    = String(vehicleData.make ?? '')
        const model   = String(vehicleData.model ?? '')
        const year    = String(vehicleData.registrationYear ?? '')
        const carName = [make, model, year].filter(Boolean).join(' ')
        const scripts = {
          overpriced:    `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah semak beberapa harga pasaran — kereta serupa sekarang sekitar RM${fmt(marketMin!)}–RM${fmt(marketMax!)}.\n\nHarga RM${fmt(askingPriceRm!)} agak tinggi berbanding pasaran. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM${fmt(offerLow)}–RM${fmt(offerHigh)}?`,
          slightly_high: `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah semak beberapa harga pasaran — kereta serupa sekarang sekitar RM${fmt(marketMin!)}–RM${fmt(marketMax!)}.\n\nHarga RM${fmt(askingPriceRm!)} sedikit di atas pasaran. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM${fmt(offerLow)}–RM${fmt(offerHigh)}?`,
          fair_price:    `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga nampak okay. Apa harga terbaik yang boleh tuan/puan offer?`,
          good_deal:     `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga nampak menarik. Bila boleh saya datang tengok kereta?`,
        }
        const script = scripts[priceVerdict]
        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Skrip Tawar Seller
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
              <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                {script}
              </p>
            </div>
            <CopyButton text={script} />
          </div>
        )
      })()}

      {/* 4. Soalan Wajib Tanya Seller */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
          Soalan Wajib Tanya Seller
        </p>
        <div className="space-y-3">
          {[
            'Ada accident besar sebelum ini?',
            'Ada flood damage?',
            'Kereta masih ada loan bank?',
            'Geran atas nama siapa?',
            'Boleh buat inspection sebelum bayar deposit?',
          ].map((q, i) => (
            <div key={i} className="flex gap-3">
              <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">{i + 1}.</span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Data Kenderaan Rasmi (JPJ) */}
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
              { label: 'Enjin',         value: vehicleData.engineCc ? `${vehicleData.engineCc}cc` : null },
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

      {/* 6. Status Insurans */}
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
          </div>
        </div>
      )}

      {/* 7. CTAs */}
      <InspectionCTA plate={plate} />
      <InsuranceCTA />

      <p className="font-body text-[11px] text-[#D1D5DB] text-center pt-2">
        Disediakan oleh Paqar · paqar.my
      </p>

    </div>
  )
}
