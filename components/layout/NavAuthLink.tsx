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
      className="font-heading font-semibold text-[12px] text-[#9CA3AF] hover:text-[#374151] transition-colors"
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/auth"
      className="font-heading font-semibold text-[12px] text-[#9CA3AF] hover:text-[#374151] transition-colors"
    >
      Laporan Saya
    </Link>
  )
}
