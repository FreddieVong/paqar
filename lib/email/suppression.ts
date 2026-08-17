import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt }    from '@/lib/crypto'
import { SITE_URL }            from '@/lib/site'

/**
 * The opt-out Paqar did not have.
 *
 * Every send path must call `isSuppressed` before it sends, and must treat a
 * FAILURE as a refusal. That direction is deliberate and is the opposite of the
 * bug this ships alongside: the retarget cron read a broken query, saw an
 * error, and quietly decided there was nobody to e-mail. Here the same
 * ambiguity has to resolve the other way — if Paqar cannot prove someone has
 * not opted out, it does not e-mail them.
 *
 * Failing closed also makes the deploy order safe. Migration 033 is applied by
 * hand, so if the code ships first the table is missing, every check errors,
 * and the outcome is "no e-mail sent" — the status quo — rather than "e-mailed
 * someone who opted out", which cannot be undone.
 */

/** Trimmed and lowercased, so one person cannot be half-suppressed. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * The unsubscribe link for an address.
 *
 * The address travels encrypted, never in the query string. A link that reads
 * `?email=someone@gmail.com` leaks that person to every proxy, mail scanner and
 * server log between Resend and their inbox — and invites anyone to unsubscribe
 * a stranger by editing the URL. AES-256-GCM is already how plates are stored;
 * this reuses it rather than inventing a second scheme.
 */
export function unsubscribeUrl(email: string): string {
  return `${SITE_URL}/api/unsubscribe?t=${encodeURIComponent(encrypt(normaliseEmail(email)))}`
}

/** Reverses `unsubscribeUrl`. Returns null for anything tampered with. */
export function emailFromToken(token: string): string | null {
  try {
    const email = decrypt(token)
    return email.includes('@') ? normaliseEmail(email) : null
  } catch {
    return null
  }
}

/**
 * Has this person asked not to be e-mailed?
 *
 * Returns TRUE when the answer cannot be established. Callers must skip the
 * send on true — see the note at the top of this file.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('email')
      .eq('email', normaliseEmail(email))
      .maybeSingle()

    if (error) {
      console.error('[suppression] lookup failed — refusing to send', error.message)
      return true
    }
    return data != null
  } catch (err) {
    console.error('[suppression] lookup threw — refusing to send', err)
    return true
  }
}

/**
 * Record an opt-out. Idempotent: clicking the link twice is not an error, and
 * the second click must not overwrite the first timestamp.
 */
export async function suppress(email: string, source = 'unsubscribe_link'): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('email_suppressions')
      .upsert({ email: normaliseEmail(email), source }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) { console.error('[suppression] write failed', error.message); return false }
    return true
  } catch (err) {
    console.error('[suppression] write threw', err)
    return false
  }
}
