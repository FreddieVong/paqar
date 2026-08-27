import Link from 'next/link'
import { FooterLegal } from './FooterLegal'
import { SocialLinks } from './SocialLinks'
import { whatsappUrl } from '@/lib/site'

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
  // Rendered only when a channel actually works. This used to be a
  // mailto:hello@paqar.my, but that domain has no MX record — the link looked
  // live and went nowhere. No link beats a link into a void.
  const contactHref = whatsappUrl('Hai Paqar, saya perlukan bantuan.')
  return (
    <>
      {/* A DIV, not a second <main> — app/layout.tsx owns the landmark.
          Carries the skip-link target because the content starts here, after
          the page's navigation. tabIndex -1 so focus actually lands on it:
          without it some browsers scroll to the anchor but leave focus on the
          body, and the next Tab returns to the top of the page. */}
      <div id="main-content" tabIndex={-1} className={`${maxWidth} mx-auto px-4 py-8 outline-none`}>
        {children}
      </div>
      <footer className="border-t border-[#F3F4F6] mt-4">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4 text-center">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/panduan" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Panduan Pembeli
            </Link>
            <Link href="/faq" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Soalan Lazim
            </Link>
            <Link href="/panduan-semak-saman" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Semak Saman
            </Link>
            <Link href="/cara-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Cara Beli Kereta
            </Link>
            <Link href="/checklist-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Checklist
            </Link>
            <Link href="/risiko-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Risiko
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/harga-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Harga Model
            </Link>
            <Link href="/kira-ansuran-kereta" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Kira Ansuran
            </Link>
            <Link href="/bandingkan" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Bandingkan
            </Link>
            <Link href="/tentang" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Tentang
            </Link>
            {/*
              /api-docs was in the sitemap, indexable, and reachable from no
              page on the site — click depth infinity, zero inbound links. A
              sitemap entry asserts a page EXISTS; a link asserts it MATTERS,
              and a URL with only the first is what Google leaves in
              "Discovered - currently not indexed".

              It sits in the company group next to Tentang because that is what
              it is: a public reference surface, not a buyer journey step. One
              link in the footer, not a promotion into the homepage body.
            */}
            <Link href="/api-docs" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              API
            </Link>
            <Link href="/privasi" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Privasi
            </Link>
            <Link href="/terma" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
              Terma
            </Link>
            {contactHref && (
              <a href={contactHref} target="_blank" rel="noopener noreferrer" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#3D472F] transition-colors">
                Hubungi Kami
              </a>
            )}
          </div>
          <SocialLinks />
          <FooterLegal />
        </div>
      </footer>
    </>
  )
}
