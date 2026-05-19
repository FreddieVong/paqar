const FEATURES = [
  'Maklumat kenderaan dari nombor plat (jenama, model, tahun, enjin)',
  'Perbandingan harga pasaran — tahu sama ada mahal atau berpatutan',
  'Soalan untuk tanya penjual sebelum bayar deposit',
  'Skrip rundingan untuk minta diskaun dengan yakin',
  'Checklist deposit',
]

export function BuyerReportPitch({ plate }: { plate: string }) {
  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.06em] text-[#064E4A] mb-1">
        Laporan Pembeli
      </p>
      <p className="font-heading font-extrabold text-[17px] text-[#111827] mb-3">
        Untuk kereta {plate}
      </p>
      <div className="space-y-2 mb-4">
        {FEATURES.map(item => (
          <div key={item} className="flex items-start gap-2">
            <span className="text-[#16A34A] text-[14px] flex-shrink-0 mt-0.5">✓</span>
            <p className="font-body text-[13px] text-[#374151]">{item}</p>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-[#BBF7D0]">
        <p className="font-heading font-bold text-[13px] text-[#064E4A]">
          RM12 sekali bayar · Tiada langganan · Tiada caj tersembunyi · Hasil segera
        </p>
      </div>
    </div>
  )
}
