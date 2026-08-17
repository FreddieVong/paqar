// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * The opt-out Paqar did not have, and the direction its failures must fall.
 *
 * Eight people received a marketing e-mail with no way to stop it, on an
 * address captured by captureLeadOnBlur before they created an account or paid
 * — neither of which the privacy notice's collection clause describes.
 *
 * The important property is not that the link exists. It is that every send
 * path FAILS CLOSED: when Paqar cannot establish whether someone opted out, it
 * must not send. That is the opposite of the retarget cron this ships beside,
 * which read an error and quietly decided there was nobody to e-mail — and it
 * is what makes the deploy order safe, since migration 033 is applied by hand
 * and the table may not exist yet.
 */

// lib/crypto reads process.env.AES_KEY directly, not through @/lib/env, so a
// module mock cannot reach it. 32 bytes as hex, matching the real key length.
process.env.AES_KEY = 'a'.repeat(64)

const fake = new FakeSupabase()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { AES_KEY: 'a'.repeat(64), RESEND_API_KEY: 'test' } }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))

const { isSuppressed, suppress, unsubscribeUrl, emailFromToken, normaliseEmail } =
  await import('@/lib/email/suppression')

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

beforeEach(() => { fake.tables.clear(); fake.failNext = null })

describe('the link identifies nobody and cannot be edited', () => {
  it('never puts the address in the URL', () => {
    const url = unsubscribeUrl('Someone@Example.com')
    expect(url).not.toContain('Someone')
    expect(url).not.toContain('example.com')
    expect(url).toContain('/api/unsubscribe?t=')
  })

  it('round-trips to the normalised address', () => {
    const url = unsubscribeUrl('  MiXeD@Case.COM ')
    const token = decodeURIComponent(url.split('t=')[1]!)
    expect(emailFromToken(token)).toBe('mixed@case.com')
  })

  it('rejects a tampered or invented token', () => {
    expect(emailFromToken('not-a-real-token')).toBeNull()
    expect(emailFromToken('')).toBeNull()
  })

  it('normalises so one person cannot be half-suppressed', () => {
    expect(normaliseEmail(' A@B.com ')).toBe('a@b.com')
  })
})

describe('suppression fails CLOSED', () => {
  it('refuses to send when the lookup errors', async () => {
    // e.g. migration 033 not yet applied — the table does not exist.
    fake.failNext = 'email_suppressions'
    expect(await isSuppressed('someone@example.com')).toBe(true)
  })

  it('allows sending only when it can prove no opt-out', async () => {
    expect(await isSuppressed('someone@example.com')).toBe(false)
  })

  it('blocks after an opt-out is recorded', async () => {
    await suppress('someone@example.com')
    expect(await isSuppressed('someone@example.com')).toBe(true)
  })

  it('matches regardless of case or spacing', async () => {
    await suppress('  Someone@Example.COM ')
    expect(await isSuppressed('someone@example.com')).toBe(true)
  })

  it('is idempotent — a second click is not an error', async () => {
    expect(await suppress('a@b.com')).toBe(true)
    expect(await suppress('a@b.com')).toBe(true)
    expect(fake.rows('email_suppressions')).toHaveLength(1)
  })
})

describe('every marketing send path checks it', () => {
  it('the retarget e-mail refuses suppressed addresses before sending', () => {
    const src = read('lib/email/retarget.ts')
    const guard = src.indexOf('isSuppressed')
    const send  = src.indexOf('resend.emails.send')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(send)
  })

  it('the feedback e-mail refuses suppressed addresses before sending', () => {
    const src = read('lib/email/customer-feedback.ts')
    expect(src.indexOf('isSuppressed')).toBeLessThan(src.indexOf('resend.emails.send'))
  })

  it('both carry an opt-out the recipient can act on', () => {
    expect(read('lib/email/retarget.ts')).toContain('unsubscribeUrl(params.toEmail)')
    expect(read('lib/email/customer-feedback.ts')).toContain('unsubscribeUrl(params.toEmail)')
    expect(read('lib/email/retarget-template.ts')).toContain('Berhenti terima emel')
  })

  it('tells the recipient truthfully why they got it', () => {
    // The old line said "kerana mendaftar minat" — they registered interest.
    // Nobody registered anything; they typed an address into a checkout field.
    const tpl = read('lib/email/retarget-template.ts')
    expect(tpl).toContain('memasukkan alamat emel semasa menyemak')
    expect(tpl).not.toContain('kerana mendaftar minat')
  })
})

describe('the opt-out route', () => {
  const route = read('app/api/unsubscribe/route.ts')

  it('works in one click, with no login', () => {
    expect(route).toContain('export async function GET')
    expect(route).not.toMatch(/getUser\(\)|requireAuth|signIn/)
  })

  it('does not reveal whether an address exists', () => {
    // Same page for a good token, a bad token and a missing one.
    expect(route).toMatch(/if \(!token\) return page\(TROUBLE\)/)
    expect(route).toMatch(/if \(!email\) return page\(TROUBLE\)/)
  })

  it('is not indexable', () => {
    expect(route).toContain('name="robots" content="noindex"')
  })
})

describe('the migration exists and is applied by hand', () => {
  it('ships 033_email_suppressions.sql', () => {
    const files = readdirSync(join(ROOT, 'supabase', 'migrations'))
    expect(files).toContain('033_email_suppressions.sql')
  })

  it('creates the table the code reads', () => {
    const sql = read('supabase/migrations/033_email_suppressions.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS email_suppressions')
    expect(sql).toContain('email        TEXT PRIMARY KEY')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
  })
})
