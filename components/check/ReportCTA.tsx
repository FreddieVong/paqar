
interface Props {
  plate?: string
}

export function ReportCTA({ plate }: Props) {
  return (
    <div className="bg-[#064E4A] rounded-[16px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-white/60 mb-2">
        Laporan Pembeli
      </p>
      <p className="font-heading font-extrabold text-[20px] text-white mb-3">
        {plate ? `Untuk kereta ${plate}:` : 'Untuk kenderaan ini:'}
      </p>

      <ul className="space-y-1.5">
        {[
          'Harga pasaran sebenar dalam RM',
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
    </div>
  )
}
