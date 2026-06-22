const STACK = [
  { title: 'Skrip rundingan harga',        desc: 'Bantu anda bincang harga berdasarkan data.' },
  { title: 'Harga pasaran sebenar',        desc: 'Tahu sama ada harga kereta itu mahal, wajar atau berbaloi.' },
  { title: 'Maklumat kenderaan (JPJ)',       desc: 'Tahun daftar, enjin, jenis badan dan nombor rangka.' },
  { title: 'Soalan penting untuk seller', desc: 'Tanya soalan yang boleh dedahkan masalah tersembunyi.' },
]

export function BuyerReportPitch({ plate }: { plate: string }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[18px] overflow-hidden shadow-sm">

      {/* Hero block */}
      <div className="bg-[#14453d] px-[18px] py-[18px] relative overflow-hidden">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] flex-shrink-0" />
          <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45">
            Skrip Rundingan Harga Paqar
          </span>
        </div>
        <p className="font-heading font-extrabold text-[15px] leading-snug text-white mb-2 tracking-tight">
          Masuk rundingan dengan data.<br />Bukan agak-agak.
        </p>
        <p className="font-body text-[11px] text-white/55 leading-relaxed">
          Guna skrip siap untuk tanya soalan penting dan runding harga sebelum bayar booking atau deposit.
        </p>
        {plate && (
          <div className="mt-3">
            <p className="font-heading font-bold text-[9px] text-white/40 uppercase tracking-widest mb-0.5">Untuk</p>
            <p className="font-heading font-extrabold text-[28px] text-white leading-none tracking-tight">{plate}</p>
          </div>
        )}
      </div>

      {/* Value stack */}
      <div className="px-[18px] py-0 border-b border-[#F3F4F6]">
        {STACK.map((item, i) => (
          <div key={item.title} className={`flex gap-2.5 items-start py-2.5 ${i < STACK.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
            <span className="w-[17px] h-[17px] rounded-full bg-[#14453d] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="font-heading font-bold text-[12px] text-[#111827] leading-snug">{item.title}</p>
              <p className="font-body text-[11px] text-[#9CA3AF] leading-snug mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Price anchor */}
      <div className="px-[18px] py-[11px] bg-[#F8FAF7]">
        <p className="font-body text-[11px] text-[#6B7280] leading-relaxed">
          Untuk pembelian kereta <span className="font-bold text-[#14453d]">bernilai ribuan ringgit</span>,
          Laporan Pembeli hanya <span className="font-extrabold text-[13px] text-[#14453d]">RM12</span>.
        </p>
      </div>

    </div>
  )
}
