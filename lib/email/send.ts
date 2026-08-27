import type { Resend } from 'resend'

/**
 * Send through Resend and FAIL when Resend says it failed.
 *
 * ── THE BUG THIS FIXES ─────────────────────────────────────────────────────
 *
 * The Resend SDK does not throw on an API error. `emails.send()` resolves with
 * `{ data: null, error: {...} }` — so ten of the eleven senders in this folder
 * did `await resend.emails.send({...})` and treated a refusal as a success.
 *
 * That matters here more than it would elsewhere, because the callers were
 * DESIGNED around the assumption that a failed send throws. Release
 * notifications go through notifyInBackground, whose whole job is
 * `work.catch(err => console.error(...))`. A promise that resolves on failure
 * gives that catch nothing to catch: the reviewer sees a clean release, the
 * buyer gets no email, and no line appears in any log.
 *
 * Which is the same shape as the bug that hid the ORIGINAL missing-email
 * defect — a mechanism reporting success from the half that worked. That one
 * took a real released report and an empty inbox to find. This one would have
 * hidden a suppressed recipient, an exceeded rate limit or a domain problem
 * exactly the same way, and for as long.
 *
 * Verified against the live API while proving the release path works: a good
 * send returns `{ data: { id }, error: null }`, so `error` is the signal and
 * it is trustworthy.
 *
 * ── WHY IT THROWS RATHER THAN RETURNING A RESULT ───────────────────────────
 *
 * Every existing caller already handles a thrown error, and none of them
 * checked a returned one. Throwing makes the ten broken call sites correct
 * without touching their error handling; returning a result would require
 * eleven new checks, any of which could be forgotten — which is how this
 * happened in the first place.
 */
export async function sendEmail(
  resend: Resend,
  label: string,
  payload: Parameters<Resend['emails']['send']>[0],
): Promise<string | null> {
  const { data, error } = await resend.emails.send(payload)
  if (error) {
    // The recipient is NOT logged: these lines land in a shared platform log
    // and a buyer's address is not needed to diagnose a send failure.
    throw new Error(`[${label}] resend refused: ${error.name ?? 'error'} — ${error.message ?? 'no message'}`)
  }
  return data?.id ?? null
}
