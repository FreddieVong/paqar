import type { Check, CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord } from '@/types/api'

const VEHICLE_SOURCES = ['pdrm', 'jpj', 'aes', 'local_councils'] as const
type VehicleSource = typeof VEHICLE_SOURCES[number]

const SOURCE_LABELS: Record<string, string> = {
  pdrm:          'PDRM Saman',
  jpj:           'JPJ Saman',
  aes:           'AES Saman',
  local_councils:'Majlis Tempatan',
}

const MARKET_LOW  = 35_000
const MARKET_HIGH = 55_000

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

function getSamanAmountForSource(result: CheckResult): number {
  if (result.status !== 'hit') return 0
  const data = result.data as SourceData | null
  if (!data || !('samans' in data)) return 0
  return data.samans.reduce((s: number, x: SamanRecord) => s + x.amount, 0)
}

function getVerdict(vehicleResults: CheckResult[]): 'low' | 'caution' | 'high' {
  const hits = vehicleResults.filter(r => r.status === 'hit')
  if (hits.length === 0) return 'low'
  const total = getSamanTotal(hits)
  if (hits.length >= 2 || total >= 500) return 'high'
  return 'caution'
}

const SELLER_QUESTIONS = [
  'Boleh tunjukkan geran asal / VOC kenderaan ini?',
  'Ada pinjaman bank yang masih aktif? Boleh tunjukkan surat penyelesaian?',
  'Kenapa kereta ini dijual?',
  'Ada rekod servis atau resit bengkel?',
  'Pernah terlibat dalam kemalangan atau ada tuntutan insurans?',
  'Boleh bawa ke bengkel untuk pemeriksaan sebelum saya buat keputusan?',
]

interface Props {
  check:             Check
  results:           CheckResult[]
  plate:             string
  askingPriceRm?:    number | null
  claimedMileageKm?: number | null
}

export function BuyerReportContent({ check: _check, results, plate: _plate, askingPriceRm, claimedMileageKm }: Props) {
  const vehicleResults = results.filter(r => VEHICLE_SOURCES.includes(r.source as VehicleSource))
  const samanTotal     = getSamanTotal(vehicleResults)
  const samanCount     = getSamanCount(vehicleResults)
  const verdict        = getVerdict(vehicleResults)

  return (
    <div className="space-y-5">

      {/* Section 1: Overall Verdict */}
      <div className={`rounded-[16px] p-5 border ${
        verdict === 'low'     ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
        verdict === 'caution' ? 'bg-[#FFFBEB] border-[#FDE68A]' :
                                'bg-[#FEF2F2] border-[#FECACA]'
      }`}>
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
          Keputusan Semakan
        </p>
        <p className={`font-heading font-extrabold text-[20px] mb-1 ${
          verdict === 'low'     ? 'text-[#15803D]' :
          verdict === 'caution' ? 'text-[#B45309]' :
                                  'text-[#B91C1C]'
        }`}>
          {verdict === 'low'     ? 'Risiko Rendah — Layak Diteruskan' :
           verdict === 'caution' ? 'Perlu Tanya Penjual' :
                                   'Semak Dahulu'}
        </p>
        <p className="font-body text-[13px] text-[#374151] leading-relaxed">
          {verdict === 'low'
            ? 'Tiada isu kritikal dijumpai daripada semakan ini.'
            : verdict === 'caution'
            ? `Terdapat ${samanCount} saman berjumlah RM${samanTotal.toLocaleString()}. Minta penjual jelaskan sebelum bayar deposit.`
            : 'Beberapa isu ditemui. Jangan bayar deposit sebelum mendapat penjelasan penjual.'}
        </p>
        {samanTotal > 0 && (
          <p className={`font-heading font-extrabold text-[22px] mt-3 ${
            verdict === 'caution' ? 'text-[#B45309]' : 'text-[#B91C1C]'
          }`}>
            RM{samanTotal.toLocaleString()} saman dijumpai
          </p>
        )}
      </div>

      {/* Section 2: Saman & Status Kenderaan */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Saman &amp; Status Kenderaan
          </p>
          <span className={`font-heading font-bold text-[11px] px-2.5 py-1 rounded-full ${
            samanCount === 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
          }`}>
            {samanCount === 0 ? 'Tiada Saman' : `${samanCount} Saman`}
          </span>
        </div>
        <div className="space-y-2">
          {VEHICLE_SOURCES.map(source => {
            const r      = vehicleResults.find(x => x.source === source)
            const status = r?.status ?? 'unavailable'
            const amount = r ? getSamanAmountForSource(r) : 0
            return (
              <div key={source} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                status === 'hit'   ? 'bg-[#FEF2F2] border-[#FECACA]' :
                status === 'clear' ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
                                     'bg-[#F9FAFB] border-[#E5E7EB]'
              }`}>
                <span className="font-heading font-bold text-[12px] text-[#111827]">
                  {SOURCE_LABELS[source]}
                </span>
                <span className={`font-body text-[11px] ${
                  status === 'hit'   ? 'text-[#B91C1C]' :
                  status === 'clear' ? 'text-[#15803D]' :
                                       'text-[#9CA3AF]'
                }`}>
                  {status === 'clear' ? 'Tiada Saman' :
                   status === 'hit'   ? `Ada Saman${amount > 0 ? ` — RM${amount.toLocaleString()}` : ''}` :
                                        'Tidak dapat disahkan'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Anggaran Harga Pasaran */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Anggaran Harga Pasaran
          </p>
          <span className="font-body text-[10px] text-[#9CA3AF]">Anggaran sahaja</span>
        </div>
        <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
          RM{MARKET_LOW.toLocaleString()} – RM{MARKET_HIGH.toLocaleString()}
        </p>
        <p className="font-body text-[12px] text-[#9CA3AF] mb-3">
          Berdasarkan listing Mudah, Carlist &amp; MyTukar · Anggaran umum — angka sebenar bergantung pada model dan tahun
        </p>

        {askingPriceRm != null && (
          <div className={`rounded-lg px-3 py-2.5 border ${
            askingPriceRm > MARKET_HIGH ? 'bg-[#FEF2F2] border-[#FECACA]' :
            askingPriceRm < MARKET_LOW  ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
                                          'bg-[#FFFBEB] border-[#FDE68A]'
          }`}>
            <p className={`font-heading font-bold text-[13px] ${
              askingPriceRm > MARKET_HIGH ? 'text-[#B91C1C]' :
              askingPriceRm < MARKET_LOW  ? 'text-[#15803D]' :
                                            'text-[#B45309]'
            }`}>
              {askingPriceRm > MARKET_HIGH
                ? `Harga diminta RM${askingPriceRm.toLocaleString()} melebihi anggaran pasaran — semak perbandingan sebelum setuju harga`
                : askingPriceRm < MARKET_LOW
                ? `Harga diminta RM${askingPriceRm.toLocaleString()} di bawah anggaran pasaran — boleh pertimbangkan`
                : `Harga diminta RM${askingPriceRm.toLocaleString()} — dalam lingkungan anggaran pasaran`}
            </p>
          </div>
        )}

        {claimedMileageKm != null && (
          <div className="mt-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2">
            <p className="font-body text-[12px] text-[#6B7280]">
              Jarak tempuh didakwa:{' '}
              <span className="font-heading font-bold text-[#111827]">{claimedMileageKm.toLocaleString()} km</span>
              {claimedMileageKm > 150_000 && (
                <span className="text-[#B45309]"> — tinggi, semak rekod servis dengan penjual</span>
              )}
            </p>
          </div>
        )}

        {(askingPriceRm == null || claimedMileageKm == null) && (
          <div className="mt-2 bg-[#F3F4F6] rounded-lg px-3 py-2">
            <p className="font-body text-[11px] text-[#9CA3AF]">
              Tambah harga &amp; jarak tempuh semasa beli laporan untuk analisis perbandingan yang lebih tepat.
            </p>
          </div>
        )}
      </div>

      {/* Section 4: Soalan untuk Penjual */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
          Soalan untuk Penjual
        </p>
        <div className="space-y-3">
          {SELLER_QUESTIONS.map((q, i) => (
            <div key={i} className="flex gap-3">
              <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">
                {i + 1}.
              </span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
            </div>
          ))}
          {samanCount > 0 && (
            <div className="flex gap-3">
              <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">
                {SELLER_QUESTIONS.length + 1}.
              </span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Boleh selesaikan saman ini dahulu, atau tolak RM{samanTotal.toLocaleString()} dari harga jual?
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
                &ldquo;Kerana ada saman RM{samanTotal.toLocaleString()} yang masih belum dijelaskan, boleh awak selesaikan dahulu sebelum tukar milik, atau tolak RM{samanTotal.toLocaleString()} dari harga jual?&rdquo;
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
        ) : (
          <>
            <p className="font-body text-[13px] text-white/80 leading-relaxed mb-4">
              Tiada saman dijumpai. Gunakan kondisi fizikal dan harga pasaran sebagai asas rundingan.
            </p>
            <div className="space-y-2.5">
              {[
                'Bawa ke bengkel untuk pemeriksaan sebelum bayar deposit.',
                'Semak geran, insurans, dan roadtax sebelum tanda tangan.',
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

    </div>
  )
}
