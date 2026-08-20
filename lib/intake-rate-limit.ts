import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limits for the intake path — deliberately NOT the spend guard.
 *
 * ── THE MISTAKE THIS REPLACES ──────────────────────────────────────────────
 *
 * Intake creation, screenshot upload and OCR were all guarded by
 * mayLookupVehicle, which exists to protect a RM0.81 provider call. It is
 * calibrated for money: 3 per session and 5 per IP PER DAY, and it FAILS CLOSED
 * on a missing session cookie.
 *
 * Applied to "insert a row", both properties are wrong in the same direction:
 *
 *   - A first-time visitor has no paqar_sid yet, so the very first request of
 *     a brand-new session was refused outright.
 *   - A buyer comparing four cars in an evening hit the daily cap on the
 *     fourth.
 *
 * Every attempt returned HTTP 429, so pasting a link did nothing and uploading
 * a screenshot said "Tak dapat mula". The form was completely dead in a
 * browser while every underlying module passed its tests.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *
 * Fail CLOSED when the downside is unbounded spend. Fail OPEN when the downside
 * is a spurious database row. Getting that backwards does not make the product
 * safer, it makes it unusable — and an unusable product protects nothing
 * because nobody reaches the expensive path anyway.
 *
 * So the tiers below are graded by what each action actually costs:
 *
 *   intake   a row. Generous, and open on failure.
 *   upload   storage plus validation CPU. Moderate.
 *   extract  a metered Anthropic call. Tight, and CLOSED on failure — this is
 *            the one that spends real money, and it keeps the strict semantics.
 */

export type IntakeAction = 'intake' | 'upload' | 'extract'

interface Tier {
  perIp:     number
  window:    `${number} ${'m' | 'h' | 'd'}`
  /** What to do when the limiter itself cannot answer. */
  onFailure: 'allow' | 'deny'
}

const TIERS: Record<IntakeAction, Tier> = {
  // A row costs nothing. Someone hammering this wastes their own time and a few
  // kilobytes that the 24-hour sweep reclaims.
  intake:  { perIp: 60, window: '1 h', onFailure: 'allow' },
  // Storage plus image validation. Five screenshots per intake means a real
  // buyer working through several cars stays well inside this.
  upload:  { perIp: 60, window: '1 h', onFailure: 'allow' },
  // A metered vision call. This is the one that spends money, so it keeps the
  // strict posture: being unable to enforce a limit is exactly when the limit
  // matters most.
  extract: { perIp: 20, window: '1 h', onFailure: 'deny' },
}

const TIMEOUT_MS = 1000

function configured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

export type IntakeDecision = { allowed: true } | { allowed: false; reason: string }

/**
 * May this request proceed?
 *
 * Keyed on IP alone. The session cookie is deliberately NOT required: a visitor
 * who has not been issued one yet is a normal first-time buyer, not an
 * attacker, and refusing them was the whole defect.
 */
export async function mayIntake(action: IntakeAction, ip: string): Promise<IntakeDecision> {
  const tier = TIERS[action]

  if (!configured()) {
    // No limiter available. For a row, proceed; for a metered call, refuse.
    return tier.onFailure === 'allow'
      ? { allowed: true }
      : { allowed: false, reason: 'unconfigured' }
  }

  try {
    const limiter = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(tier.perIp, tier.window),
      prefix:  `paqar:intake:${action}`,
      timeout: TIMEOUT_MS,
    })
    const { success } = await limiter.limit(ip)
    return success ? { allowed: true } : { allowed: false, reason: 'rate_limited' }
  } catch {
    return tier.onFailure === 'allow'
      ? { allowed: true }
      : { allowed: false, reason: 'limiter_error' }
  }
}
