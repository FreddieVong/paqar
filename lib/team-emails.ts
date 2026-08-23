/**
 * Addresses belonging to the team.
 *
 * Every "sale" before 2026-08-04 was one of these testing, which is why
 * historical conversion rates meant nothing. Emailing yourself "was it useful?"
 * is not research.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * It lived in lib/email/customer-feedback.ts, which imports the Resend client
 * and lib/env — and lib/env imports `server-only`, which throws outside a
 * server component. That made the list unusable from operational scripts, and
 * scripts/reconcile-payments.ts needs it to separate internal testing from real
 * customer payments. Duplicating the addresses there would have been the kind
 * of drift that eventually misclassifies a real customer as a test.
 *
 * Zero imports, deliberately. Anything that needs to know who is internal can
 * read it — server, script or test.
 */
export const TEAM_EMAILS = new Set([
  'invisible4v@gmail.com',
  'test@example.com',
  'lyethengchoo@gmail.com',
  'liyingaun@gmail.com',
  // Added 2026-08-23. This address bought RM29 on the 22nd as a test and was
  // counted as Paqar's fourth paying stranger for a day — the newest one, and
  // the only purchase after that morning's fixes, so it was carrying more
  // weight in the read of the funnel than any other single row.
  'ask.xianyu@gmail.com',
  'freddie.vong@yahoo.com',
])

/**
 * NOTE THE NULL DEFAULT. An absent address answers `true` because the original
 * caller asks "should I email this person?", and an unknown sender is never
 * worth emailing.
 *
 * That default is wrong for any caller asking "was this internal testing?" —
 * there it would silently reclassify a real customer's payment as a test. Such
 * callers must handle null themselves before calling this; see the `owner`
 * three-state flag in scripts/reconcile-payments.ts.
 */
export function isTeamEmail(email: string | null | undefined): boolean {
  if (!email) return true
  const e = email.trim().toLowerCase()
  return TEAM_EMAILS.has(e) || e.startsWith('freddie')
}
