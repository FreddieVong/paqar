import Link from 'next/link'

export function Shell({
  children,
  width = 'default',
}: {
  children: React.ReactNode
  /**
   * 'default' (max-w-lg) suits the narrow, form-led product pages.
   * 'wide' (max-w-3xl) is for long-form guides with tables — squeezing those
   * into max-w-lg reflows multi-column tables into an unreadable mess, which
   * is why the /faq/* guides previously opted out of Shell entirely and so
   * shipped with no nav and no footer links.
   * Both class strings appear literally so Tailwind's JIT keeps them.
   */
  width?: 'default' | 'wide'
}) {
  const maxWidth = width === 'wide' ? 'max-w-3xl' : 'max-w-lg'
  return (
    <>
      <main className={`${maxWidth} mx-auto px-4 py-8`}>
        {children}
      </main>
      <footer className="border-t border-[#F3F4F6] mt-4">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4 text-center">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/panduan" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Panduan Pembeli
            </Link>
            <Link href="/faq" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Soalan Lazim
            </Link>
            <Link href="/panduan-semak-saman" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Semak Saman
            </Link>
            <Link href="/cara-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Cara Beli Kereta
            </Link>
            <Link href="/checklist-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Checklist
            </Link>
            <Link href="/risiko-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Risiko
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/harga-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Harga Model
            </Link>
            <Link href="/kira-ansuran-kereta" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Kira Ansuran
            </Link>
            <Link href="/bandingkan" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Bandingkan
            </Link>
            <Link href="/tentang" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Tentang
            </Link>
            <Link href="/privasi" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Privasi
            </Link>
            <Link href="/terma" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Terma
            </Link>
            <a href="mailto:hello@paqar.my" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">
              Hubungi Kami
            </a>
          </div>
          <p className="font-body text-[11px] text-[#D1D5DB]">
            © {new Date().getFullYear()} Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
          </p>
        </div>
      </footer>
    </>
  )
}
