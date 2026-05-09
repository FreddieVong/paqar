import Link from 'next/link'

interface Props {
  checkId:    string
  claimToken: string
}

export function ReportCTA({ checkId, claimToken }: Props) {
  return (
    <div className="bg-[#064E4A] rounded-[16px] p-5">
      <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-white/60 mb-2">
        Laporan Pembeli
      </p>
      <p className="font-heading font-extrabold text-[20px] text-white mb-3">
        Nak buat keputusan dengan lebih yakin?
      </p>

      <ul className="space-y-1.5 mb-5">
        {[
          'Anggaran harga pasaran kereta ini',
          'Soalan yang perlu tanya penjual',
          'Skrip rundingan harga siap guna',
          'Checklist sebelum bayar deposit',
          'Sejarah kemalangan — akan datang',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2 font-body text-[13px] text-white/90">
            <span className="text-[#FACC15] flex-shrink-0 mt-0.5">✓</span>
            {item}
          </li>
        ))}
      </ul>

      <Link
        href={`/laporan-pembeli/${checkId}?claim_token=${claimToken}`}
        className="block w-full bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 text-center hover:bg-yellow-300 transition-colors"
      >
        Dapatkan Laporan — RM29 →
      </Link>

      <p className="font-body text-[11px] text-white/50 text-center mt-2">
        Bayar sekali · Akses terus
      </p>
    </div>
  )
}
