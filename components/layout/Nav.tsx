import Link  from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

export async function Nav() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="font-heading font-semibold text-[13px] text-[#064E4A] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 hover:border-[#064E4A] transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/auth"
              className="font-heading font-semibold text-[13px] text-[#064E4A] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 hover:border-[#064E4A] transition-colors"
            >
              Log Masuk
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
