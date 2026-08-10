import * as Sentry from '@sentry/nextjs'

/**
 * Failures on the money path, made visible.
 *
 * WHY THIS EXISTS
 *
 * Sentry only sees UNHANDLED exceptions. Every failure that matters most in
 * Paqar is deliberately handled — a receipt send that throws must not roll back
 * a confirmed payment, so it is caught, logged with console.error, and
 * swallowed. That is the right behaviour and it had the side effect that the
 * three things worth waking someone up for were the three things Sentry could
 * never see:
 *
 *   a paid Billplz webhook matching no report   money in, entitlement unknown
 *   a receipt that never sent                   paid, but no link to the report
 *   a receipt send that could not be claimed    same, withheld deliberately
 *
 * Deliberately narrow. This is not a console.error replacement — routing every
 * caught error here would bury the ones that mean a customer paid and got
 * nothing. Add a call only when the answer to "would I want to be told within
 * the hour?" is yes.
 *
 * SAFE CONTEXT ONLY
 *
 * billId, checkId and buyerReportId are references, not credentials: they
 * cannot open a report on their own. A claim token, an email address, a plate
 * or an IC must never be passed here. lib/sentry-scrub.ts would redact several
 * of them anyway, but the scrubber is a backstop, not a licence.
 */
export interface MoneyPathContext {
  billId?:        string | null
  checkId?:       string | null
  buyerReportId?: string | null
  amountCents?:   number | null
  /** Short, safe classification — never a provider payload or a stack. */
  reason?:        string | null
}

/**
 * How loudly an event should land.
 *
 *   error    a customer's money or entitlement is at risk right now
 *   warning  recovered automatically, but the cause needs a look
 *   info     designed behaviour worth an audit trail, never an alarm
 *
 * Not cosmetic. Every call here used to be 'error', including the two that fire
 * when the system successfully recovers — a superseded bill being reconciled
 * and a dead upgrade bill being replaced. Both are the feature working. Paging
 * on them is how an owner learns to swipe the alerts away, and then misses the
 * one that means a customer paid and got nothing.
 */
export type MoneyPathLevel = 'error' | 'warning' | 'info'

export function reportMoneyPathFailure(
  op: string,
  context: MoneyPathContext,
  level: MoneyPathLevel = 'error',
): void {
  // Keep the log line: Vercel logs are the fastest place to look, and they
  // survive a Sentry outage or quota exhaustion.
  const log = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info
  log(`[money-path:${op}]`, context)

  try {
    Sentry.captureMessage(`money-path: ${op}`, {
      level,
      tags:  { money_path: op },
      extra: { ...context },
    })
  } catch {
    // Reporting a failure must never become one. The console line above has
    // already recorded it.
  }
}
