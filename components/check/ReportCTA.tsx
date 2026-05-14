import Link from 'next/link'

const WA_SHARE_TEXT = encodeURIComponent(
  'Nak beli kereta terpakai? Ada tool free check saman kat paqar.my — masukkan nombor plat, terus ada panduan semak PDRM/JPJ. Takde perlu daftar 👇\nhttps://paqar.my'
)

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
          'Data kenderaan rasmi dari JPJ',
          'Status insurans semasa',
          'Soalan tepat untuk tanya penjual',
          'Skrip rundingan harga siap guna',
          'Checklist sebelum bayar deposit',
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
        Dapatkan Laporan — RM12 →
      </Link>

      <p className="font-body text-[11px] text-white/50 text-center mt-2">
        Bayar sekali · Akses terus
      </p>

      <div className="mt-3 pt-3 border-t border-white/10">
        <a
          href={`https://wa.me/?text=${WA_SHARE_TEXT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full text-white/60 font-body text-[12px] py-1.5 hover:text-white/90 transition-colors"
        >
          <span>Kongsi tool percuma ini via WhatsApp →</span>
        </a>
      </div>
    </div>
  )
}
