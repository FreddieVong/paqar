import 'server-only'
import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'

// The cookie stores sha256(ADMIN_SECRET), never the raw secret —
// rotating ADMIN_SECRET invalidates every logged-in device.
export const ADMIN_COOKIE = 'paqar_admin'

function secretHash(): string | null {
  if (!env.ADMIN_SECRET) return null
  return createHash('sha256').update(env.ADMIN_SECRET).digest('hex')
}

export function isAdminSecretValid(candidate: string): boolean {
  if (!env.ADMIN_SECRET || !candidate) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(env.ADMIN_SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isAdminAuthenticated(): boolean {
  const expected = secretHash()
  if (!expected) return false
  const cookie = cookies().get(ADMIN_COOKIE)?.value
  if (!cookie) return false
  const a = Buffer.from(cookie)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function setAdminCookie(): void {
  const expected = secretHash()
  if (!expected) return
  cookies().set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Site-wide, NOT '/admin'.
    //
    // The review queue's whole job is to check a draft before a buyer sees it,
    // and the draft only renders at /laporan-pembeli/[checkId] — a path an
    // /admin-scoped cookie is never sent to. Scoping it to /admin would mean
    // the reviewer approving reports they cannot read.
    //
    // The widening is safe by construction: the value is sha256(ADMIN_SECRET),
    // never the secret; it is httpOnly so no script can read it; and it is
    // compared with timingSafeEqual. It grants exactly one extra capability —
    // previewing an unreleased report — and only to someone who already holds
    // the admin secret.
    path:     '/',
    maxAge:   60 * 60 * 24 * 30,
  })
}

/**
 * Audit marker for the single operator behind ADMIN_SECRET.
 *
 * Paqar has one reviewer and one shared secret, so there is no per-user
 * identity to record and pretending otherwise would put a fictional name in an
 * audit log. This is deliberately a constant: when a second reviewer exists,
 * the honest change is real accounts, not a free-text field anyone can type
 * into. Recorded on every transition so the audit trail says WHO by role even
 * while that answer is trivially "the owner".
 */
export const REVIEWER_ID = 'admin'
