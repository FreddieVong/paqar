import type { Check, CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord } from '@/types/api'
import type { CachedMarketPrices } from '@/lib/db/market-prices'
import { InspectionCTA } from './InspectionCTA'
import { InsuranceCTA }  from './InsuranceCTA'
import { CopyButton }    from './CopyButton'

const VEHICLE_SOURCES = ['pdrm', 'jpj', 'aes', 'local_councils'] as const
type VehicleSource = typeof VEHICLE_SOURCES[number]

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')



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


function getVerdict(vehicleResults: CheckResult[]): 'low' | 'caution' | 'high' | 'incomplete' {
  const hits = vehicleResults.filter(r => r.status === 'hit')
  const unverifiedCritical = vehicleResults.filter(r =>
    ['pdrm', 'jpj', 'aes'].includes(r.source) && r.status === 'requires_user_action'
  )
  if (hits.length > 0) {
    const total = getSamanTotal(hits)
    return hits.length >= 2 || total >= 500 ? 'high' : 'caution'
  }
  if (unverifiedCritical.length > 0) return 'incomplete'
  return 'low'
}

const SELLER_QUESTIONS: { q: string; script?: string }[] = [
  {
    q: 'Boleh tunjukkan geran asal kenderaan ini?',
    script: 'Hi, boleh tunjukkan geran asal kenderaan ini? Nak pastikan nama pemilik betul sebelum bayar deposit.',
  },
  {
    q: 'Ada pinjaman bank yang masih aktif? Boleh tunjukkan surat penyelesaian?',
    script: 'Hi, ada loan bank yang masih aktif untuk kereta ini? Kalau ada, boleh tunjukkan surat settlement?',
  },
  { q: 'Kenapa kereta ini dijual?' },
  { q: 'Ada rekod servis atau resit bengkel?' },
  {
    q: 'Pernah terlibat dalam kemalangan atau ada tuntutan insurans?',
    script: 'Hi, kereta ini pernah terlibat dalam accident atau ada tuntutan insurans? Tolong confirmkan.',
  },
  { q: 'Boleh bawa ke bengkel untuk pemeriksaan sebelum saya buat keputusan?' },
]

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

export function BuyerReportContent({ check: _check, results, plate, askingPriceRm, claimedMileageKm, vehicleData: rawVehicleData, marketPrices }: Props) {
  const vehicleData = rawVehicleData as VehicleData | null | undefined
  const vehicleResults      = results.filter(r => VEHICLE_SOURCES.includes(r.source as VehicleSource))
  const samanTotal          = getSamanTotal(vehicleResults)
  const samanCount          = getSamanCount(vehicleResults)
  const verdict             = getVerdict(vehicleResults)


  const hasPdrmJpjUnverified = vehicleResults.some(r =>
    ['pdrm', 'jpj'].includes(r.source) && r.status === 'requires_user_action'
  )

  const ins = vehicleData?.insurance

  // Market price calculations — used by price section, summary box, and nego script
  const mPrices      = marketPrices?.listings.map(l => l.price) ?? []
  const marketMin    = mPrices.length ? Math.min(...mPrices) : null
  const marketMax    = mPrices.length ? Math.max(...mPrices) : null
  const hasMarketData = askingPriceRm != null && marketMin != null && marketMax != null
  const priceVerdict = !hasMarketData ? null
    : askingPriceRm! < marketMin! ? 'good_deal'    as const
    : askingPriceRm! <= marketMax! ? 'fair_price'  as const
    : askingPriceRm! <= marketMax! * 1.08 ? 'slightly_high' as const
    : 'overpriced' as const

  return (
    <div className="space-y-5">

      {/* Section 1: Perbandingan Harga — HERO (price is buyer's #1 question) */}
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
          good_deal:     { text: 'Harga Bagus — boleh terus buat keputusan',           color: 'text-[#064E4A]', sub: null },
          fair_price:    { text: 'Harga Wajar — boleh cuba tawar sedikit',             color: 'text-[#064E4A]', sub: null },
          slightly_high: { text: 'Sedikit Tinggi — ada ruang untuk tawar',             color: 'text-[#B45309]', sub: null },
          overpriced:    { text: 'Harga Terlalu Tinggi — jangan bayar deposit dulu',   color: 'text-[#DC2626]', sub: 'Harga seller lebih tinggi daripada kereta serupa. Gunakan skrip tawar sebelum jumpa seller.' },
        } as const)[priceVerdict] : null

        const summaryBox = hasMarketData && priceVerdict ? ({
          good_deal:     { bg: 'bg-[#F0FAFA]', border: 'border-l-[#0891B2]', line2: 'Harga di bawah julat pasaran — nampak berbaloi.',   action: 'Tapi semak rekod JPJ dulu — kereta murah ada sebab.' },
          fair_price:    { bg: 'bg-[#F0FDF4]', border: 'border-l-[#064E4A]', line2: 'Harga dalam julat pasaran — wajar.',                action: 'Semak rekod JPJ dan bawa ke bengkel sebelum deposit.' },
          slightly_high: { bg: 'bg-[#FFFBEB]', border: 'border-l-[#B45309]', line2: 'Harga sedikit di atas julat pasaran.',             action: `Ada ruang untuk tawar — cuba offer RM${fmt(marketMax!)}.` },
          overpriced:    { bg: 'bg-[#FEF2F2]', border: 'border-l-[#DC2626]', line2: `Harga lebih tinggi RM${fmt(askingPriceRm! - marketMax!)} dari julat pasaran.`, action: `Jangan bayar deposit dulu — tawar bawah RM${fmt(marketMax!)} atau cari unit lain.` },
        } as const)[priceVerdict] : null

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Perbandingan Harga
            </p>

            {/* Summary box */}
            {summaryBox && (
              <div className={`border-l-4 ${summaryBox.border} ${summaryBox.bg} rounded-r-lg px-4 py-3 mb-4`}>
                <p className="font-body text-[13px] text-[#374151] mb-1">
                  Seller minta RM{fmt(askingPriceRm!)}. Harga pasaran semasa RM{fmt(marketMin!)}–RM{fmt(marketMax!)}.
                </p>
                <p className="font-body text-[12px] text-[#374151] mb-1">{summaryBox.line2}</p>
                <p className="font-heading font-bold text-[13px] text-[#111827]">{summaryBox.action}</p>
              </div>
            )}

            {/* Asking price row */}
            {askingPriceRm != null && (
              <div className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5 mb-3">
                <p className="font-body text-[12px] text-[#6B7280]">Harga diminta penjual</p>
                <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
              </div>
            )}

            {/* Market listings */}
            {marketPrices && marketPrices.listings.length > 0 && (() => {
              const prices  = marketPrices.listings.map(l => l.price)
              const daysAgo = Math.floor((Date.now() - new Date(marketPrices.fetchedAt).getTime()) / 86_400_000)
              return (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-[12px] text-[#111827]">Harga pasaran semasa</p>
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
                  <a href={marketPrices.searchUrl} target="_blank" rel="noopener noreferrer"
                    className="font-body text-[11px] text-[#064E4A] hover:underline block">
                    Lihat semua listing di Mudah →
                  </a>
                </div>
              )
            })()}

            {/* Verdict — after both prices for context */}
            {verdictDisplay ? (
              <div className="mb-3 space-y-1">
                <p className={`font-heading font-bold text-[13px] ${verdictDisplay.color}`}>{verdictDisplay.text}</p>
                {verdictDisplay.sub && <p className="font-body text-[11px] text-[#6B7280]">{verdictDisplay.sub}</p>}
              </div>
            ) : pct != null ? (
              <p className={`font-body text-[12px] mb-3 ${pct >= 0 ? 'text-[#064E4A]' : 'text-[#B45309]'}`}>
                {pct >= 0
                  ? `${pct}% di bawah harga baru — wajar untuk kenderaan ini`
                  : `${Math.abs(pct)}% melebihi harga baru — semak perbandingan sebelum setuju`}
              </p>
            ) : null}

            {/* New car price — moved to bottom as reference anchor */}
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

            {/* No asking price entered */}
            {askingPriceRm == null && wmNewPrice != null && (
              <p className="font-body text-[11px] text-[#9CA3AF] mt-1">
                Masukkan harga yang penjual minta untuk perbandingan lebih tepat.
              </p>
            )}

            {/* Market search links — shown when no cached listings */}
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

      {/* Negotiation script — shown when market data and vehicle info available */}
      {hasMarketData && priceVerdict && vehicleData?.make && (() => {
        const make     = String(vehicleData.make ?? '')
        const model    = String(vehicleData.model ?? '')
        const year     = String(vehicleData.registrationYear ?? '')
        const carName  = [make, model, year].filter(Boolean).join(' ')
        const scripts = {
          overpriced:    `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah buat semakan harga pasaran — unit serupa dijual dalam julat RM${fmt(marketMin!)}–RM${fmt(marketMax!)}.\n\nBoleh kita buat harga RM${fmt(marketMax!)} atau kurang? Saya serius nak beli kalau harga okay.`,
          slightly_high: `Salam, saya berminat dengan ${carName} tuan/puan.\n\nSaya dah semak harga pasaran — boleh kita bincang harga sikit?\n\nSaya target dalam RM${fmt(marketMax!)}. Boleh consider?`,
          fair_price:    `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga nampak okay. Apa harga terbaik yang boleh tuan/puan offer?`,
          good_deal:     `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga nampak menarik. Bila boleh saya datang tengok kereta?`,
        }
        const script = scripts[priceVerdict]
        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Skrip Tawar Harga
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

      {/* Section 2: Data Kenderaan Rasmi (if available) */}
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
              { label: 'Tahun Daftar', value: vehicleData.registrationYear },
              { label: 'Enjin',        value: vehicleData.engineCc ? `${vehicleData.engineCc}cc` : null },
              { label: 'Jenis Badan',  value: vehicleData.body },
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

      {/* Section 0b: Status Insurans (if available) */}
      {ins && (
        <div className={`border rounded-[14px] p-5 ${
          ins.policyStatus?.toLowerCase().includes('active') ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
        }`}>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
            Status Insurans
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`font-heading font-extrabold text-[15px] ${
                ins.policyStatus?.toLowerCase().includes('active') ? 'text-[#15803D]' : 'text-[#DC2626]'
              }`}>
                {ins.policyStatus?.toLowerCase().includes('active') ? '✓ Aktif' : '✕ Tamat Tempoh'}
              </span>
            </div>
            <p className="font-body text-[13px] text-[#374151]">{ins.insurer}</p>
            <p className="font-body text-[12px] text-[#6B7280]">{translateCoverType(ins.coverType)}</p>
          </div>
        </div>
      )}

      {/* Section 1: Overall Verdict — only shown when samans are confirmed */}
      {samanCount > 0 && <div className={`rounded-[16px] p-5 border ${
        verdict === 'low'        ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
        verdict === 'incomplete' ? 'bg-[#FFFBEB] border-[#FDE68A]' :
        verdict === 'caution'    ? 'bg-[#FFFBEB] border-[#FDE68A]' :
                                   'bg-[#FEF2F2] border-[#FECACA]'
      }`}>
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
          Apa yang kami jumpa
        </p>
        <p className={`font-heading font-extrabold text-[20px] mb-1 ${
          verdict === 'low'        ? 'text-[#15803D]' :
          verdict === 'incomplete' ? 'text-[#B45309]' :
          verdict === 'caution'    ? 'text-[#B45309]' :
                                     'text-[#DC2626]'
        }`}>
          {verdict === 'low'        ? 'Tiada isu dijumpai' :
           verdict === 'incomplete' ? 'Ada yang perlu anda semak sendiri' :
           verdict === 'caution'    ? 'Ada saman — tanya penjual dulu' :
                                      'Berhati-hati — ada isu serius'}
        </p>
        <p className="font-body text-[13px] text-[#374151] leading-relaxed">
          {verdict === 'low'
            ? 'Tiada saman atau isu yang kami temui. Gunakan maklumat di bawah untuk buat keputusan.'
            : verdict === 'incomplete'
            ? 'Tiada isu yang kami jumpa. Saman PDRM/JPJ perlu disemak sendiri di portal rasmi — klik pautan di atas.'
            : verdict === 'caution'
            ? `Ada ${samanCount} saman berjumlah RM${fmt(samanTotal)}. Minta penjual selesaikan atau tolak dari harga.`
            : 'Ada beberapa isu serius. Jangan bayar deposit sebelum penjual beri penjelasan.'}
        </p>
        {samanTotal > 0 && (
          <p className={`font-heading font-extrabold text-[22px] mt-3 ${
            verdict === 'caution' ? 'text-[#B45309]' : 'text-[#DC2626]'
          }`}>
            RM{fmt(samanTotal)} saman dijumpai
          </p>
        )}
        {verdict === 'incomplete' && (
          <p className="font-body text-[11px] text-[#6B7280] mt-2 leading-relaxed">
            Gunakan maklumat di bawah untuk bantu keputusan anda sebelum bayar deposit.
          </p>
        )}
      </div>}

      {/* Section 4: Soalan untuk Penjual */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
          Soalan untuk Penjual
        </p>
        <div className="space-y-3">
          {hasPdrmJpjUnverified && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">1.</span>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Boleh tunjuk bukti semakan saman PDRM/JPJ untuk kereta ini sebelum saya bayar deposit?
                </p>
              </div>
              <div className="ml-6 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                <p className="font-body text-[10px] text-[#9CA3AF] uppercase tracking-[.05em] mb-1">Mesej untuk penjual — salin dan hantar</p>
                <p className="font-body text-[12px] text-[#374151] italic leading-relaxed">
                  &ldquo;Hi, sebelum saya bayar deposit, boleh tunjuk bukti semakan saman PDRM/JPJ untuk kereta ini?&rdquo;
                </p>
              </div>
            </div>
          )}
          {SELLER_QUESTIONS.map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-3">
                <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">
                  {hasPdrmJpjUnverified ? i + 2 : i + 1}.
                </span>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">{item.q}</p>
              </div>
              {item.script && (
                <div className="ml-6 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                  <p className="font-body text-[10px] text-[#9CA3AF] uppercase tracking-[.05em] mb-1">Mesej untuk penjual — salin dan hantar</p>
                  <p className="font-body text-[12px] text-[#374151] italic leading-relaxed">
                    &ldquo;{item.script}&rdquo;
                  </p>
                </div>
              )}
            </div>
          ))}
          {samanCount > 0 && (
            <div className="flex gap-3">
              <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">
                {(hasPdrmJpjUnverified ? 1 : 0) + SELLER_QUESTIONS.length + 1}.
              </span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Boleh selesaikan saman ini dahulu, atau tolak RM{fmt(samanTotal)} dari harga jual?
              </p>
            </div>
          )}
          {(claimedMileageKm ?? 0) > 150_000 && (
            <div className="flex gap-3">
              <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">
                {(hasPdrmJpjUnverified ? 1 : 0) + SELLER_QUESTIONS.length + (samanCount > 0 ? 1 : 0) + 1}.
              </span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Jarak tempuh nampak tinggi untuk tahun kereta ini. Boleh tunjukkan rekod servis atau buku servis?
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Action Block */}
      <div className="bg-[#064E4A] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-white/60 mb-3">
          {samanCount > 0 ? 'Cadangan & Langkah Seterusnya' : 'Langkah Seterusnya'}
        </p>

        {samanCount > 0 ? (
          <>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.06em] text-white/50 mb-2">
              Skrip rundingan
            </p>
            <div className="bg-white/10 rounded-[10px] px-4 py-3 mb-4">
              <p className="font-body text-[13px] text-white leading-relaxed italic">
                &ldquo;Kerana ada saman RM{fmt(samanTotal)} yang masih belum dijelaskan, boleh awak selesaikan dahulu sebelum tukar milik, atau tolak RM{fmt(samanTotal)} dari harga jual?&rdquo;
              </p>
            </div>
            <div className="space-y-2.5">
              {[
                'Minta penjual jelaskan saman tersebut.',
                'Minta bukti pembayaran jika penjual kata sudah selesai.',
                'Jangan bayar deposit sebelum mendapat penjelasan.',
                'Jika penjual enggan, anggap sebagai tanda amaran.',
              ].map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="font-heading font-bold text-[12px] text-white/50 flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-white/90 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </>
        ) : verdict === 'incomplete' ? (
          <>
            <p className="font-body text-[13px] text-white/80 leading-relaxed mb-4">
              Tiada isu yang kami jumpa setakat ini. Selesaikan langkah di bawah sebelum setuju.
            </p>
            <div className="space-y-2.5">
              {[
                'Tanya penjual semak saman di MyBayar PDRM dan Portal JPJ — minta bukti screenshot.',
                'Bawa ke bengkel untuk pemeriksaan fizikal sebelum bayar deposit.',
                'Semak geran, insurans, dan cukai jalan sebelum tanda tangan.',
                'Pastikan tiada pinjaman aktif sebelum tukar milik.',
              ].map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="font-heading font-bold text-[12px] text-white/50 flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-white/90 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-body text-[13px] text-white/80 leading-relaxed mb-4">
              Tiada saman yang kami jumpa. Gunakan kondisi fizikal dan harga pasaran untuk rundingan.
            </p>
            <div className="space-y-2.5">
              {[
                'Bawa ke bengkel untuk pemeriksaan sebelum bayar deposit.',
                'Semak geran, insurans, dan cukai jalan sebelum tanda tangan.',
                'Pastikan tiada pinjaman aktif sebelum tukar milik.',
              ].map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="font-heading font-bold text-[12px] text-white/50 flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-white/90 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <InspectionCTA plate={plate} />
      <InsuranceCTA />

      {/* Brand footnote — visible in screenshots and shares */}
      <p className="font-body text-[11px] text-[#D1D5DB] text-center pt-2">
        Disediakan oleh Paqar · paqar.my
      </p>

    </div>
  )
}
