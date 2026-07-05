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
        <div className="flex items-center gap-4">
          <Link
            href="/panduan"
            className="font-heading font-semibold text-[12px] text-[#9CA3AF] hover:text-[#374151] transition-colors"
          >
            Panduan
          </Link>
          <NavAuthLink />
        </div>
      </div>
    </nav>
  )
}
