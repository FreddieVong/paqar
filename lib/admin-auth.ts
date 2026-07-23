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
    path:     '/admin',
    maxAge:   60 * 60 * 24 * 30,
  })
}
