// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * THE DEFECT THIS PINS.
 *
 * Intake creation, screenshot upload and OCR were all guarded by
 * mayLookupVehicle — a limiter built to protect a RM0.81 provider call. It
 * allows 3 per session and 5 per IP PER DAY, and FAILS CLOSED when there is no
 * session cookie.
 *
 * A first-time visitor has no paqar_sid on their very first request, so the
 * form returned HTTP 429 to literally everyone. Pasting a link did nothing;
 * uploading a screenshot said "Tak dapat mula". Every underlying module passed
 * its tests while the product was unusable in a browser.
 *
 * The rule: fail CLOSED when the downside is unbounded spend; fail OPEN when
 * the downside is a spurious row. Backwards, it does not make the product
 * safer — nobody reaches the expensive path at all.
 */

let limitResult: { success: boolean } | Error = { success: true }

vi.mock('server-only', () => ({}))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    async limit() {
      if (limitResult instanceof Error) throw limitResult
      return limitResult
    }
  },
}))

const { mayIntake } = await import('@/lib/intake-rate-limit')

beforeEach(() => {
  limitResult = { success: true }
  process.env.UPSTASH_REDIS_REST_URL   = 'https://fake.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake'
})

describe('a first-time visitor is never refused', () => {
  it.each(['intake', 'upload'] as const)('%s allows a request with no session at all', async (action) => {
    // Note the signature: IP only. There is no session parameter to omit,
    // which is what makes the old failure structurally impossible.
    expect(await mayIntake(action, '203.0.113.1')).toEqual({ allowed: true })
  })
})

describe('failure posture is graded by what the action costs', () => {
  it('a row is created even when the limiter is unreachable', async () => {
    limitResult = new Error('upstash down')
    expect((await mayIntake('intake', '203.0.113.1')).allowed).toBe(true)
    expect((await mayIntake('upload', '203.0.113.1')).allowed).toBe(true)
  })

  /**
   * OCR spends real money, so it keeps the strict posture: being unable to
   * enforce a limit is exactly when the limit matters most.
   */
  it('a metered OCR call is refused when the limiter is unreachable', async () => {
    limitResult = new Error('upstash down')
    expect(await mayIntake('extract', '203.0.113.1')).toEqual({ allowed: false, reason: 'limiter_error' })
  })

  it('OCR is refused when no limiter is configured at all', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    expect((await mayIntake('extract', '203.0.113.1')).allowed).toBe(false)
    // …while a row still gets created.
    expect((await mayIntake('intake', '203.0.113.1')).allowed).toBe(true)
  })
})

describe('a genuine limit breach is still refused', () => {
  it.each(['intake', 'upload', 'extract'] as const)('%s honours the limiter saying no', async (action) => {
    limitResult = { success: false }
    expect(await mayIntake(action, '203.0.113.1')).toEqual({ allowed: false, reason: 'rate_limited' })
  })
})

describe('the intake path no longer borrows the spend guard', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

  it.each([
    'app/api/listing-intake/route.ts',
    'app/api/listing-screenshots/route.ts',
    'app/api/listing-intake/[id]/extract/route.ts',
  ])('%s uses mayIntake, not mayLookupVehicle', (f) => {
    const src = read(f)
    expect(src).toContain('mayIntake(')
    expect(src, 'the spend guard is calibrated for RM0.81, not for rows')
      .not.toContain('mayLookupVehicle')
  })

  /** The provider call it was built for must keep the strict guard. */
  it('the vehicle lookup still uses the spend guard', () => {
    expect(read('lib/vehicle-lookup-trigger.ts')).toContain('mayLookupVehicle')
  })
})
