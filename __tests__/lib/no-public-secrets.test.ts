import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * NEXT_PUBLIC_ is not a naming convention. It is a publication instruction.
 *
 * Next.js inlines any NEXT_PUBLIC_* value into the client bundle at BUILD time.
 * The value is then in a JavaScript file served to every visitor, cached by
 * their browser and by every CDN in between — it cannot be recalled, only
 * rotated. A single prefix typo turns a server secret into a public one, and
 * nothing in the type system or the runtime objects, because the mechanism is
 * working exactly as designed.
 *
 * lib/env.ts validates server and client variables in separate schemas, which
 * means a mistake here is caught by neither. This test is the thing that
 * catches it.
 */

/** Names that must never be published, in any prefixed form. */
const SECRET_NAMES = [
  'ADMIN_SECRET', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'AES_KEY',
  'BILLPLZ_API_KEY', 'BILLPLZ_X_SIGNATURE_KEY', 'CRON_SECRET', 'RESEND_API_KEY',
  'META_SYSTEM_USER_ACCESS_TOKEN', 'UPSTASH_REDIS_REST_TOKEN',
  'POSTHOG_PERSONAL_API_KEY', 'SCRAPER_API_KEY',
  'META_CAPI_TOKEN', 'TELEGRAM_BOT_TOKEN',
]

describe('no server secret is ever published to the browser', () => {
  it.each(SECRET_NAMES)('lib/env.ts does not declare NEXT_PUBLIC_%s', (name) => {
    expect(read('lib/env.ts')).not.toContain(`NEXT_PUBLIC_${name}`)
  })

  it.each(SECRET_NAMES)('no source file reads NEXT_PUBLIC_%s', (name) => {
    // A read implies the value was expected to exist client-side, which is the
    // mistake this guards even if the variable is never actually set.
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const hits = execSync(
      `grep -rl "NEXT_PUBLIC_${name}" app lib components 2>/dev/null || true`,
      { cwd: ROOT, encoding: 'utf8' },
    ).trim()
    expect(hits, `NEXT_PUBLIC_${name} referenced in: ${hits}`).toBe('')
  })

  it('the local env file publishes no secret', () => {
    if (!existsSync(join(ROOT, '.env.local'))) return
    const names = read('.env.local')
      .split('\n')
      .map(l => l.match(/^([^#=\s]+)\s*=/)?.[1])
      .filter((n): n is string => !!n)

    for (const n of names) {
      if (!n.startsWith('NEXT_PUBLIC_')) continue
      const bare = n.replace('NEXT_PUBLIC_', '')
      expect(
        SECRET_NAMES.includes(bare),
        `${n} publishes a server secret to every visitor's browser`,
      ).toBe(false)
    }
  })

  /**
   * The client schema is the allowlist of what MAY be published. Anything it
   * accepts is public by definition, so it is worth reading deliberately rather
   * than growing by accident.
   */
  it('only known-safe values are declared public', () => {
    const src = read('lib/env.ts')
    const declared = [...src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map(m => m[0])
    const ALLOWED = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',   // anon key is public by design; RLS is the boundary
      'NEXT_PUBLIC_GA_MEASUREMENT_ID',
      'NEXT_PUBLIC_POSTHOG_HOST',
      'NEXT_PUBLIC_POSTHOG_KEY',
      'NEXT_PUBLIC_JOMCHECK_ENABLED',
      'NEXT_PUBLIC_SITE_URL',
      // The pixel ID is embedded in Meta's own snippet on every page — public
      // by design. META_CAPI_TOKEN, which is NOT, is declared separately and
      // unprefixed, and is covered by SECRET_NAMES below.
      'NEXT_PUBLIC_META_PIXEL_ID',
    ]
    for (const d of new Set(declared)) {
      expect(ALLOWED, `${d} is newly published — confirm it is safe, then allow it here`)
        .toContain(d)
    }
  })
})
