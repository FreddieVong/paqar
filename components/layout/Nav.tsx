import Link from 'next/link'
import Image from 'next/image'

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-[#F3F4F6]">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/paqar-logo.png"
            alt="Paqar"
            width={96}
            height={32}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>
        <Link
          href="/auth"
          className="font-heading font-semibold text-[13px] text-[#064E4A] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 hover:border-[#064E4A] transition-colors"
        >
          Log Masuk
        </Link>
      </div>
    </nav>
  )
}
