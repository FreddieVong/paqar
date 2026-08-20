import { BASE_REPORT_LABEL } from '@/lib/pricing'

const LOCKED_SECTIONS = [
  {
    title: 'Perbandingan Harga',
    desc:  'Harga baru asal + harga pasaran semasa',
    badge: null,
  },
  {
    title: 'Soalan untuk Penjual',
    desc:  'Soalan tepat sebelum bayar deposit',
    badge: null,
  },
  {
    title: 'Skrip Rundingan',
    desc:  'Cara minta diskaun dengan yakin',
    badge: null,
  },
  {
    title: 'Checklist Deposit',
    desc:  'Semak 5 perkara ini sebelum transfer wang',
    badge: null,
  },
]

export function LockedReportPreview() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-1">
          Laporan Pembeli — {BASE_REPORT_LABEL}
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
          Unlock semua bahagian di bawah untuk buat keputusan sebelum bayar deposit.
        </p>
      </div>

      {/* Locked rows */}
      <div className="divide-y divide-[#F3F4F6]">
        {LOCKED_SECTIONS.map((section) => (
          <div key={section.title} className="flex items-center gap-3 px-5 py-4 bg-[#F9FAFB]">
            <span className="text-[16px] flex-shrink-0">🔒</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-heading font-bold text-[13px] text-[#374151]">
                  {section.title}
                </p>
                {section.badge && (
                  <span className="font-body text-[10px] text-[#9CA3AF] bg-[#F3F4F6] rounded-full px-2 py-0.5 flex-shrink-0">
                    {section.badge}
                  </span>
                )}
              </div>
              <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">
                {section.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
