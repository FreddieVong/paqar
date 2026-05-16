
interface Props {
  checkId:    string
  claimToken: string
  plate?:     string
}

export function ReportCTA({ checkId, claimToken, plate }: Props) {
  return (
    <div className="bg-[#064E4A] rounded-[16px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-white/60 mb-2">
        Laporan Pembeli
      </p>
      <p className="font-heading font-extrabold text-[20px] text-white mb-3">
        {plate
          ? `Untuk kereta ${plate}, kami boleh tunjukkan:`
          : 'Untuk kenderaan ini, kami boleh tunjukkan:'}
      </p>

      <ul className="space-y-1.5 mb-5">
        {[
          'Sama ada harga penjual berpatutan atau terlalu tinggi',
          'Berapa nilai sebenar kereta ini sekarang',
          'Soalan yang perlu tanya penjual sebelum commit',
          'Cara minta diskaun dengan yakin',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2 font-body text-[13px] text-white/90">
            <span className="text-[#FACC15] flex-shrink-0 mt-0.5">✓</span>
            {item}
          </li>
        ))}
      </ul>

      <a
        href={`/laporan-pembeli/${checkId}?claim_token=${claimToken}`}
        className="block w-full bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 text-center hover:bg-[#FDE047] transition-colors"
      >
        Dapatkan Laporan — RM12 →
      </a>

      <p className="font-body text-[11px] text-white/50 text-center mt-2">
        Bayar sekali · Akses terus
      </p>
    </div>
  )
}
