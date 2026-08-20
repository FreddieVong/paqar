import 'server-only'
import { createHmac } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * A stable, privacy-safe way to recognise the same purchaser twice.
 *
 * ── WHY session_id WILL NOT DO ─────────────────────────────────────────────
 *
 * `checks.session_id` is the paqar_sid cookie. It identifies a BROWSER SESSION,
 * and it is wrong for repeat-purchase measurement in both directions:
 *
 *   OVERCOUNTS  the same person on a phone and a laptop, after clearing
 *               cookies, in a private window, or after the cookie expires,
 *               looks like several first-time buyers.
 *   UNDERCOUNTS  a shared or family device makes two people look like one
 *               returning customer.
 *
 * Repeat purchase is the metric that decides whether Paqar is a product or a
 * one-off novelty, and measuring it on a browser cookie would produce a number
 * that feels precise and is not. With three lifetime customers, a single
 * miscount is a large proportion of the answer.
 *
 * ── WHY A KEYED HASH RATHER THAN THE EMAIL ─────────────────────────────────
 *
 * The email is already stored on buyer_reports for receipt delivery, so this
 * adds no new personal data — but it must not travel to analytics, where the
 * whole point is that rows are not attributable to a person.
 *
 * An HMAC keyed on a server secret, rather than a bare SHA-256, because the
 * space of real email addresses is small enough to enumerate: a plain digest of
 * an email is reversible by anyone with a wordlist. Keyed, it is only linkable
 * by someone who already holds the key and the database.
 *
 * ── WHY IT IS DERIVED AT PAYMENT, AND PERSISTED THERE ──────────────────────
 *
 * From the email on a COMPLETED payment, so it identifies a purchaser rather
 * than a visitor. An abandoned checkout leaves no identity behind, which is the
 * correct behaviour for a repeat-PURCHASE measure.
 *
 * It is STORED on the row rather than recomputed on read. Recomputing looks
 * tidier and is a trap: the id is keyed on a server secret, so rotating that
 * secret would silently re-issue every identity at once. Every returning
 * customer would become a first-time buyer on the same day, and the repeat-rate
 * chart would show a cliff that no product change caused — the kind of number
 * that is worse than having none, because someone will act on it.
 *
 * Persisting freezes history. PURCHASER_ID_VERSION travels with each row so a
 * rotation is visible rather than invisible: ids of different versions are
 * simply not comparable, and any query spanning a rotation can say so instead
 * of quietly reporting nonsense.
 */

/**
 * Bump ONLY when the derivation changes — a new key, a different canonical
 * form, a different hash. Rows keep the version they were written with, so a
 * bump partitions the data rather than corrupting it.
 */
export const PURCHASER_ID_VERSION = 1

/** Normalise before hashing, or the same person yields two identities. */
export function canonicalEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  if (!e || !e.includes('@')) return null
  const [local, domain] = e.split('@') as [string, string]
  if (!local || !domain) return null
  // Gmail ignores dots and everything after '+'. Two receipts to the same inbox
  // are the same customer, and counting them as two would inflate exactly the
  // metric this exists to measure honestly.
  const isGmail = domain === 'gmail.com' || domain === 'googlemail.com'
  const cleaned = isGmail ? local.replace(/\./g, '').split('+')[0]! : local.split('+')[0]!
  return `${cleaned}@${isGmail ? 'gmail.com' : domain}`
}

/**
 * The analytics-safe purchaser id, or null when no key is configured.
 *
 * Returns null rather than falling back to an unkeyed digest: a weaker
 * identifier that silently replaces a strong one is worse than none, because
 * nothing downstream would know the difference.
 */
export function purchaserId(email: string | null | undefined): string | null {
  if (!email) return null
  const canonical = canonicalEmail(email)
  if (!canonical) return null
  const key = env.AES_KEY
  if (!key) return null
  return createHmac('sha256', key).update(`purchaser:${canonical}`).digest('hex').slice(0, 32)
}
