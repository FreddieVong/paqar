// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isTeamEmail, TEAM_EMAILS } from '@/lib/team-emails'

/**
 * The outreach script may not email anyone by accident, and may not print who
 * it would email.
 *
 * WHY THIS IS A TEST AND NOT A CODE REVIEW NOTE
 *
 * scripts/ask-abandoned-checkouts.ts is the only send-capable path pointed at
 * people who did NOT buy. It has no record of what it sent — nothing is
 * written when an email goes out — so its safety lives entirely in argv
 * handling and in what it puts on the terminal. Both are the kind of thing a
 * later edit removes without noticing.
 *
 * Read as source rather than executed: the module talks to Supabase, Billplz
 * and Resend at import time, and a test that runs it is a test that can send.
 */

const SRC = readFileSync(
  join(__dirname, '..', '..', 'scripts', 'ask-abandoned-checkouts.ts'),
  'utf8',
)

describe('sending requires two deliberate flags', () => {
  it('is dry-run unless --send is passed', () => {
    expect(SRC).toContain("const live = process.argv.includes('--send')")
  })

  it('refuses to send without --confirm-count', () => {
    expect(SRC).toContain('--confirm-count is required')
    expect(SRC).toMatch(/confirmed === null[\s\S]{0,200}process\.exitCode = 1/)
  })

  it('refuses to send when the cohort has changed since review', () => {
    // The list is rebuilt live from the database. A row added between the
    // review and the send would otherwise widen the audience silently.
    expect(SRC).toMatch(/confirmed !== sendable\.length[\s\S]{0,220}process\.exitCode = 1/)
  })

  it('decides live-vs-dry from argv alone, never from the environment', () => {
    // RESEND_API_KEY is read, but only ever to ABORT: absent key means nothing
    // is sent. No env var can flip the script into sending.
    const live = SRC.slice(SRC.indexOf('const live ='), SRC.indexOf('const live =') + 120)
    expect(live).toContain('process.argv')
    expect(live).not.toContain('process.env')

    const keyGuard = SRC.slice(SRC.indexOf('RESEND_API_KEY is not set') - 200)
    expect(keyGuard).toContain('process.exitCode = 1')
  })

  it('sends only inside the live branch', () => {
    const sendCall = SRC.indexOf('await send(l)')
    const liveGate = SRC.indexOf('if (!live)')
    expect(liveGate).toBeGreaterThan(-1)
    expect(sendCall).toBeGreaterThan(liveGate)
  })
})

describe('normal output identifies nobody', () => {
  it('prints a digest, never an address', () => {
    expect(SRC).toContain("createHash('sha256')")
    // Every console line that mentions a recipient must go through pid().
    for (const m of SRC.matchAll(/console\.(log|error)\(`([^`]*)`/g)) {
      const line = m[2]!
      if (!/\bl\.email\b/.test(line)) continue
      expect(line, `raw address printed: ${line}`).toContain('pid(')
    }
  })

  it('never pads a raw address into a column', () => {
    // The old listing did `${l.email.padEnd(30)}`, which is exactly what ends
    // up in a pasted terminal transcript.
    expect(SRC).not.toContain('l.email.padEnd')
  })
})

describe('team exclusion has one source of truth', () => {
  it('imports isTeamEmail instead of copying the address list', () => {
    expect(SRC).toContain("import { isTeamEmail } from '../lib/team-emails'")
    // The local duplicate is gone. lib/team-emails.ts warns in its own header
    // that a second copy eventually misclassifies a real customer as a test.
    expect(SRC).not.toContain('const OURS = new Set')
  })

  it('excludes an unreadable address rather than guessing', () => {
    expect(SRC).toMatch(/if \(!email \|\| isTeamEmail\(email\)\) continue/)
  })

  it('still excludes every team address', () => {
    for (const addr of TEAM_EMAILS) expect(isTeamEmail(addr)).toBe(true)
    expect(isTeamEmail('freddie.anything@example.com')).toBe(true)
    expect(isTeamEmail('a-real-buyer@gmail.com')).toBe(false)
  })
})

describe('it writes nothing and cannot repeat itself silently', () => {
  it('performs no database write', () => {
    // Scoped to the Supabase client on purpose: a bare '.update(' also matches
    // createHash(...).update(email), which writes nothing anywhere.
    for (const m of SRC.matchAll(/\bsb\s*\n?\s*\.from\([^)]*\)([\s\S]{0,200})/g)) {
      const chain = m[1]!
      for (const op of ['.insert(', '.update(', '.upsert(', '.delete(']) {
        expect(chain, `${op} on a Supabase table would mutate production data`).not.toContain(op)
      }
      expect(chain).toContain('.select(')
    }
    // And the client is never handed to anything else that could write.
    expect(SRC.match(/\bsb\b/g)?.length).toBeGreaterThan(0)
  })

  it('excludes anyone who has paid', () => {
    expect(SRC).toContain(".neq('status', 'paid')")
    expect(SRC).toContain('stillUnpaid')
  })

  it('deduplicates to one email per person', () => {
    expect(SRC).toMatch(/if \(!seen\.has\(email\)\)/)
  })

  it('states in its dry run that it keeps no send record', () => {
    // It genuinely does not. Saying so is the only protection a rerun has.
    expect(SRC).toContain('KEEPS NO RECORD')
  })
})
