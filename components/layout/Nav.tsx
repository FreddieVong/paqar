import Link from 'next/link'

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-[#F3F4F6]">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] bg-[#064E4A] flex items-center justify-center flex-shrink-0">
            <div className="w-3.5 h-3.5 bg-[#FACC15] rounded-[3px]" />
          </div>
          <span className="font-heading font-extrabold text-[17px] text-[#111827] tracking-tight">
            Paqar
          </span>
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
