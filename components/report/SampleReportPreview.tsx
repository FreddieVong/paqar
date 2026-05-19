const VEHICLE_FIELDS = [
  { label: 'Jenama', value: 'Perodua' },
  { label: 'Model',  value: 'Myvi' },
  { label: 'Tahun',  value: '2019' },
  { label: 'Enjin',  value: '1,000cc' },
]

const LOCKED_SECTIONS = ['Skrip Rundingan', 'Soalan untuk Penjual', 'Checklist Deposit']

export function SampleReportPreview() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[#F3F4F6] flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-0.5">
            Contoh Laporan
          </p>
          <p className="font-heading font-extrabold text-[18px] text-[#111827]">WXY 1234</p>
        </div>
        <span className="font-body text-[10px] text-[#15803D] bg-[#DCFCE7] border border-[#BBF7D0] px-2.5 py-1 rounded-full font-bold">
          Contoh Sahaja
        </span>
      </div>

      {/* Vehicle details */}
      <div className="px-5 py-4 border-b border-[#F3F4F6]">
        <p className="font-heading font-bold text-[11px] text-[#064E4A] uppercase tracking-[.06em] mb-3">
          Maklumat Kenderaan
        </p>
        <div className="grid grid-cols-2 gap-2">
          {VEHICLE_FIELDS.map(item => (
            <div key={item.label} className="bg-[#F9FAFB] rounded-[10px] px-3 py-2.5">
              <p className="font-body text-[10px] text-[#9CA3AF] mb-0.5">{item.label}</p>
              <p className="font-heading font-bold text-[13px] text-[#111827]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Price verdict */}
      <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#FFFBEB]">
        <div className="flex items-start gap-3">
          <span className="inline-block font-heading font-bold text-[10px] bg-[#B45309] text-white rounded-[4px] px-2.5 py-1 flex-shrink-0 mt-0.5">
            Sedikit Tinggi
          </span>
          <div>
            <p className="font-body text-[12px] text-[#374151] leading-relaxed">
              Harga penjual sedikit di atas julat pasaran.
            </p>
            <p className="font-body text-[10px] text-[#9CA3AF] mt-1">
              Harga pasaran: RM 35,000 – RM 42,000
            </p>
          </div>
        </div>
      </div>

      {/* Locked sections */}
      {LOCKED_SECTIONS.map(title => (
        <div key={title} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#F3F4F6] last:border-0 bg-[#F9FAFB]">
          <span className="text-[14px] flex-shrink-0">🔒</span>
          <p className="font-heading font-bold text-[13px] text-[#9CA3AF]">{title}</p>
        </div>
      ))}
    </div>
  )
}
