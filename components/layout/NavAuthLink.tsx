'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Client-side auth check so Nav stays a static component — a server-side
// auth.getUser() here would force every page on the site into dynamic rendering.
//
// Renders NOTHING when logged out, and that is the fix for a duplicate.
//
// It used to show "Laporan Saya" pointing at /auth. Nav now has its own
// "Laporan Saya" pointing at /laporan-saya, so the header carried the SAME
// LABEL TWICE with different destinations — and the /auth one is a login wall
// for a product sold explicitly without accounts.
//
// /laporan-saya serves the anonymous buyer (their link is in their email) and
// offers /dashboard to the few who registered for expiry reminders. So the only
// thing left for this component to do is show Dashboard to someone already
// signed in.
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
  ) : null
}
