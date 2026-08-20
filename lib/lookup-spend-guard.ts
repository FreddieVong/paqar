import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

/**
 * The only thing standing between a stranger and Paqar's provider bill.
 *
 * A vehicle lookup costs RM0.81. A cache HIT costs nothing, so this guard only
 * ever governs a cache MISS — the case where a real call would be made.
 *
 * IT FAILS CLOSED, ALWAYS.
 *
 * The earlier version failed OPEN: `.catch(() => ({ success: true }))` on each
 * limiter, so an Upstash outage, a timeout, or missing configuration silently
 * removed the spend cap entirely. That inverts the risk. Being unable to
 * enforce a limit is exactly when the limit matters most, and the failure is
 * invisible — nobody notices an absent refusal, everybody notices a bill.
 *
 * The cost of failing closed is a buyer who is told to try again. The cost of
 * failing open is unbounded, automatable spend. Those are not comparable, so
 * this does not treat them as a trade-off.
 *
 * THE FIVE STATES, all of which must yield ZERO provider calls:
 *
 *   1. Upstash not configured   — no credentials, so no limit can exist
 *   2. Redis error              — the limiter threw
 *   3. Timeout                  — Ratelimit's own `timeout` elapsed
 *   4. Rate-limited             — the limiter answered "no"
 *   5. Missing session          — no paqar_sid, so the session dimension is
 *                                 unenforceable and the IP dimension alone is
 *                                 trivially rotated
 *
 * State 5 is deliberate rather than incidental. Middleware sets paqar_sid on
 * every request, so its absence means a client that discarded it — which is
 * precisely the client a per-session cap exists to constrain.
 *
 * NOT keyed on the plate hash: plate_lookup_cache already means a repeat plate
 * never bills twice, so a plate limiter would save nothing and would refuse two
 * different buyers checking the same advertised car.
 */

export type SpendDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unconfigured' | 'limiter_error' | 'rate_limited' | 'missing_session' }

/** Per-IP: shared behind CGNAT, trivially rotated. Necessary, never sufficient. */
const IP_LIMIT      = 5
/** Per-session: stable for one real browser, cheap for an attacker to discard. */
const SESSION_LIMIT = 3
const WINDOW        = '1 d' as const
/** Below the route's own budget so a hung limiter cannot eat the request. */
const TIMEOUT_MS    = 1000

function isConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Built per call, not at module scope.
 *
 * `Redis.fromEnv()` throws when credentials are absent, and at module scope
 * that throw takes down the whole route — turning a spend-guard problem into a
 * total outage of check creation. Constructing lazily keeps the failure local
 * and lets it be reported as `unconfigured` instead.
 */
function build(): { ip: Ratelimit; session: Ratelimit } | null {
  if (!isConfigured()) return null
  try {
    const redis = Redis.fromEnv()
    return {
      ip:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(IP_LIMIT, WINDOW),      prefix: 'paqar:vlookup',      timeout: TIMEOUT_MS }),
      session: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(SESSION_LIMIT, WINDOW), prefix: 'paqar:vlookup:sess', timeout: TIMEOUT_MS }),
    }
  } catch {
    return null
  }
}

/**
 * May this request spend RM0.81?
 *
 * Both dimensions must return an explicit allow. Anything else — a throw, a
 * timeout, an absent session, a refusal — is a refusal.
 */
export async function mayLookupVehicle(
  ip: string,
  sessionId: string | null,
): Promise<SpendDecision> {
  // Checked BEFORE the limiters: with no session there is nothing to key the
  // session dimension on, so no configuration of Redis could make this safe.
  if (!sessionId) return { allowed: false, reason: 'missing_session' }

  const limiters = build()
  if (!limiters) return { allowed: false, reason: 'unconfigured' }

  let byIp: { success: boolean }
  let bySession: { success: boolean }
  try {
    // Ratelimit resolves (not rejects) on its own timeout, returning
    // success:false — so a timeout lands in the rate_limited branch below and
    // still yields zero provider calls. A throw lands here.
    ;[byIp, bySession] = await Promise.all([
      limiters.ip.limit(ip),
      limiters.session.limit(sessionId),
    ])
  } catch {
    return { allowed: false, reason: 'limiter_error' }
  }

  // Defensive: a malformed answer is not an allow.
  if (byIp?.success !== true || bySession?.success !== true) {
    return { allowed: false, reason: 'rate_limited' }
  }

  return { allowed: true }
}
