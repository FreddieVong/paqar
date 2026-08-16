'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Client-side auth check so Nav stays a static component — a server-side
// auth.getUser() here would force every page on the site into dynamic rendering.
//
// "Laporan Saya", not "Log Masuk". The hero badge two inches below promises
// "Tanpa daftar", and /auth is passwordless — magic link or phone OTP, with no
// password and no registration step. "Log Masuk" described an account that does
// not exist and contradicted the badge on the same screen. What this link
// actually does is reach reports you already have.
/**
 * Shared by Nav and by this link so the two can never disagree.
 *
 * #6B7280, not #9CA3AF: gray-400 on white is 2.54:1 and fails WCAG AA for
 * body text. min-h-[44px] because a 12px link is a ~16px tap target, well
 * under the 44px minimum this project already adopted elsewhere.
 */
export const NAV_LINK_CLS =
  'font-heading font-semibold text-[12px] text-[#6B7280] hover:text-[#111827] transition-colors '
  + 'min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 '
  + 'focus-visible:ring-[#064E4A]/40 rounded'

export function NavAuthLink() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setLoggedIn(true)
    })
  }, [])

  return loggedIn ? (
    <Link
      href="/dashboard"
      className={NAV_LINK_CLS}
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/auth"
      className={NAV_LINK_CLS}
    >
      Laporan Saya
    </Link>
  )
}
