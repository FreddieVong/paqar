import Link  from 'next/link'
import Image from 'next/image'
import { NavAuthLink } from './NavAuthLink'

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-[#F3F4F6]">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/paqar-logo.png"
            alt="Paqar"
            width={96}
            height={56}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>
        {/*
          ONE utility action, not a menu.

          Kira Ansuran and Panduan moved to the footer's tools area. Neither is
          a step in buying a car — they are things to read — and every extra
          item here competes with the single job this page has. "Laporan Saya"
          earns its place because it is the one thing a buyer who ALREADY paid
          needs, and losing a paid report is the worst experience Paqar can
          give someone.

          It points at /laporan-saya rather than /dashboard: the dashboard
          redirects anonymous visitors to a login wall, and virtually every
          buyer is anonymous by design.
        */}
        <div className="flex items-center gap-4">
          <Link
            href="/laporan-saya"
            className="font-heading font-semibold text-[12px] text-[#374151] hover:text-[#064E4A] transition-colors min-h-[44px] flex items-center"
          >
            Laporan Saya
          </Link>
          <NavAuthLink />
        </div>
      </div>
    </nav>
  )
}
