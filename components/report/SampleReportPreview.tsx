const MARKET_PRICES = ['RM37,500', 'RM38,000', 'RM39,800', 'RM41,500', 'RM42,000', 'RM43,000', 'RM44,500', 'RM45,000', 'RM46,200', 'RM47,000']
const LOCKED_SECTIONS = ['Maklumat Kenderaan', 'Skrip Rundingan', 'Soalan untuk Penjual', 'Checklist Deposit']

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

      {/* 1. Keputusan Paqar */}
      <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#FEF2F2]">
        <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
          Keputusan Paqar
        </p>
        <p className="font-heading font-extrabold text-[20px] leading-tight text-[#DC2626] mb-0.5">
          Harga Terlalu Tinggi
        </p>
        <p className="font-heading font-bold text-[13px] text-[#111827] mb-4">
          Jangan bayar deposit dulu.
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM55,000</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="font-body text-[12px] text-[#6B7280]">Market semasa</p>
            <p className="font-heading font-bold text-[13px] text-[#111827]">RM38,000 – RM46,000</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="font-body text-[12px] text-[#6B7280]">Anggaran lebih tinggi</p>
            <p className="font-heading font-bold text-[13px] text-[#DC2626]">RM9,000+</p>
          </div>
          <div className="pt-2 border-t border-[#FECACA]">
            <p className="font-body text-[11px] text-[#6B7280] mb-0.5">Cadangan</p>
            <p className="font-heading font-bold text-[12px] text-[#111827]">
              Target RM38,000–RM43,000. Kalau seller tak boleh turun, cari unit lain.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Perbandingan Harga */}
      <div className="px-5 py-4 border-b border-[#F3F4F6]">
        <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#9CA3AF] mb-3">
          Perbandingan Harga
        </p>
        <div className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5 mb-3">
          <p className="font-body text-[12px] text-[#6B7280]">Harga diminta penjual</p>
          <p className="font-heading font-bold text-[13px] text-[#111827]">RM55,000</p>
        </div>
        <p className="font-heading font-bold text-[11px] text-[#111827] mb-1.5">Bukti Harga Pasaran</p>

        {/* Median row */}
        <div className="flex items-center justify-between bg-[#F0FAFA] rounded-lg px-3 py-2 mb-2">
          <p className="font-body text-[12px] text-[#6B7280]">Median pasaran</p>
          <p className="font-heading font-bold text-[13px] text-[#064E4A]">RM42,750</p>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {MARKET_PRICES.map(price => (
            <span key={price} className="inline-block bg-[#F0FAFA] border border-[#99D4D1] rounded-lg px-2.5 py-1 font-heading font-bold text-[11px] text-[#064E4A]">
              {price}
            </span>
          ))}
        </div>

        {/* Methodology + confidence */}
        <p className="font-body text-[11px] text-[#9CA3AF] mb-1">
          Berdasarkan 10 listing serupa dari Mudah
        </p>
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#22C55E]" />
            <span className="font-body text-[11px] font-semibold text-[#15803D]">Keyakinan data: Tinggi</span>
          </div>
          <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">
            Data ini lebih stabil untuk dijadikan panduan harga.
          </p>
        </div>

        {/* Trade-in estimate */}
        <div className="pt-3 border-t border-[#F3F4F6]">
          <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Anggaran trade-in</p>
          <p className="font-heading font-bold text-[13px] text-[#111827]">RM34,000 – RM36,000</p>
          <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">
            Jual sendiri berpotensi dapat sekitar RM7,500 lebih berbanding trade-in.
          </p>
        </div>
      </div>

      {/* 3. Locked sections */}
      {LOCKED_SECTIONS.map(title => (
        <div key={title} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#F3F4F6] last:border-0 bg-[#F9FAFB]">
          <span className="text-[14px] flex-shrink-0">🔒</span>
          <p className="font-heading font-bold text-[13px] text-[#9CA3AF]">{title}</p>
        </div>
      ))}
    </div>
  )
}
