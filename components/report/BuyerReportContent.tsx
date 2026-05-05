import type { Check, CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord } from '@/types/api'

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

const SELLER_QUESTIONS = [
  'Boleh tunjukkan geran asal kenderaan ini?',
  'Ada pinjaman bank yang masih aktif? Boleh tunjukkan surat penyelesaian?',
  'Kenapa kereta ini dijual? Berapa lama dimiliki?',
  'Ada rekod servis? Boleh tunjukkan buku servis atau resit bengkel?',
  'Pernah terlibat dalam kemalangan? Ada tuntutan insurans?',
  'Boleh bawa ke bengkel untuk pemeriksaan sebelum saya buat keputusan?',
]

interface Props {
  check:   Check
  results: CheckResult[]
  plate:   string
}

export function BuyerReportContent({ check: _check, results, plate: _plate }: Props) {
  const samanTotal   = getSamanTotal(results)
  const samanCount   = getSamanCount(results)
  const hasBlacklist = results.some(r => r.status === 'hit' && r.source === 'immigration')

  return (
    <div className="space-y-5">

      {/* Section 1: Saman Results */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🚗</span>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Semakan Saman
          </p>
          <span className={`ml-auto font-heading font-bold text-[11px] px-2.5 py-1 rounded-full ${
            samanCount === 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
          }`}>
            {samanCount === 0 ? 'Tiada Saman' : `${samanCount} Saman`}
          </span>
        </div>
        <div className="space-y-2">
          {results.map(r => (
            <div key={r.source} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
              r.status === 'hit'   ? 'bg-[#FEF2F2] border-[#FECACA]' :
              r.status === 'clear' ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
              'bg-[#F9FAFB] border-[#E5E7EB]'
            }`}>
              <span className="font-heading font-bold text-[12px] text-[#111827]">{r.label}</span>
              <span className={`font-body text-[11px] ${
                r.status === 'hit'   ? 'text-[#B91C1C]' :
                r.status === 'clear' ? 'text-[#15803D]' : 'text-[#9CA3AF]'
              }`}>
                {r.status === 'clear' ? 'Tiada Saman' :
                 r.status === 'hit'   ? 'Ada Saman ⚠ (perlu pengesahan)' :
                 'Tidak dapat disemak'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Market Price (stubbed) */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">💰</span>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Anggaran Harga Pasaran
          </p>
        </div>
        <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
          RM35,000 – RM55,000
        </p>
        <p className="font-body text-[12px] text-[#9CA3AF]">
          Anggaran — berdasarkan listing Mudah, Carlist &amp; MyTukar
        </p>
        <div className="mt-3 bg-[#FEF9C3] border border-[#FDE68A] rounded-lg px-3 py-2">
          <p className="font-body text-[12px] text-[#B45309]">
            ⚠️ Anggaran umum. Harga sebenar bergantung pada model, tahun, dan kondisi.
          </p>
        </div>
      </div>

      {/* Section 3: Risk Flags */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⚠️</span>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Risiko &amp; Bendera Merah
          </p>
        </div>
        {samanCount === 0 && !hasBlacklist ? (
          <p className="font-body text-[14px] text-[#15803D]">
            ✓ Tiada risiko besar dijumpai daripada semakan ini.
          </p>
        ) : (
          <div className="space-y-2">
            {samanCount > 0 && (
              <div className="flex gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
                <span className="text-[#DC2626] flex-shrink-0">🔴</span>
                <p className="font-body text-[13px] text-[#B91C1C]">
                  Terdapat {samanCount} saman berjumlah RM{samanTotal.toLocaleString()} —
                  minta penjual jelaskan sebelum bayar deposit.
                </p>
              </div>
            )}
            {hasBlacklist && (
              <div className="flex gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
                <span className="text-[#DC2626] flex-shrink-0">🔴</span>
                <p className="font-body text-[13px] text-[#B91C1C]">
                  Blacklist imigresen dijumpai — semak butiran dengan penjual.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Seller Questions */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">💬</span>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Soalan untuk Penjual
          </p>
        </div>
        <div className="space-y-3">
          {SELLER_QUESTIONS.map((q, i) => (
            <div key={i} className="flex gap-3">
              <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">
                {i + 1}.
              </span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 5: Negotiation */}
      <div className="bg-[#064E4A] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤝</span>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-white/70">
            Cadangan Rundingan
          </p>
        </div>
        {samanTotal > 0 ? (
          <>
            <p className="font-heading font-extrabold text-[18px] text-white mb-2">
              Tawar RM{samanTotal.toLocaleString()} lebih rendah
            </p>
            <p className="font-body text-[13px] text-white/70 leading-relaxed">
              Saman RM{samanTotal.toLocaleString()} adalah tanggungan yang boleh ditolak dari harga.
              Gunakan ini sebagai asas rundingan.
            </p>
          </>
        ) : (
          <>
            <p className="font-heading font-extrabold text-[18px] text-white mb-2">
              Tiada asas rundingan dari saman
            </p>
            <p className="font-body text-[13px] text-white/70 leading-relaxed">
              Gunakan kondisi fizikal dan harga pasaran sebagai asas rundingan harga.
            </p>
          </>
        )}
      </div>

    </div>
  )
}
