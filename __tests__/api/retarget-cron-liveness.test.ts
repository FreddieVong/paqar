// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The cron that went green every day for a fortnight while sending nothing.
 *
 * WHAT HAPPENED. 49e0e93 (2026-08-02) added `asking_price_rm` to the candidate
 * query. That column does not exist on `checks` — /api/checks validates the
 * asking price and then deliberately discards it — so PostgREST rejected every
 * request. The error was destructured away (`const { data: candidates }`), so
 * `candidates` came back null, and `if (!candidates?.length) return ... sent: 0`
 * reported success. Vercel showed a healthy 2.25s invocation each day.
 *
 * The blast radius was wider than retargeting: askPaidCustomersForFeedback()
 * sat BELOW that early return, so two of Paqar's three genuine customers were
 * never asked for feedback either. Last real send: 2026-08-02. Found
 * 2026-08-17.
 *
 * These tests pin the three separate mistakes, because fixing only the column
 * would leave the next one just as silent.
 */

const ROOT  = join(__dirname, '..', '..')
const ROUTE = readFileSync(join(ROOT, 'app/api/cron/retarget/route.ts'), 'utf8')

/** Columns `checks` actually has, read from the migrations that create them. */
function checksColumns(): Set<string> {
  const dir = join(ROOT, 'supabase', 'migrations')
  const cols = new Set<string>()
  for (const f of readdirSync(dir).filter(n => n.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8')
    for (const m of sql.matchAll(/ALTER TABLE\s+checks\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+(\w+)/gi)) cols.add(m[1]!.toLowerCase())
    const create = sql.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+checks\s*\(([\s\S]*?)\n\);/i)
    if (create) for (const line of create[1]!.split('\n')) {
      const m = line.trim().match(/^(\w+)\s+\w/)
      if (m && !/^(primary|foreign|constraint|unique|check)$/i.test(m[1]!)) cols.add(m[1]!.toLowerCase())
    }
  }
  return cols
}

/** The column list inside `.from('checks').select('...')` in the route. */
function selectedFromChecks(): string[] {
  const m = ROUTE.match(/\.from\('checks'\)\s*\n?\s*\.select\('([^']+)'\)/)
  return m ? m[1]!.split(',').map(s => s.trim().toLowerCase()) : []
}

describe('the candidate query asks for columns that exist', () => {
  it('finds the query at all', () => {
    // Guard the guard: a regex that matched nothing would pass vacuously.
    expect(selectedFromChecks().length).toBeGreaterThan(2)
  })

  it('reads the real column list from the migrations', () => {
    const cols = checksColumns()
    expect(cols.has('lead_email')).toBe(true)
    expect(cols.has('lead_email_sent_at')).toBe(true)
    // The column the outage was built on. It lives on buyer_reports, not here.
    expect(cols.has('asking_price_rm')).toBe(false)
  })

  it('selects nothing `checks` does not have', () => {
    const cols = checksColumns()
    const missing = selectedFromChecks().filter(c => !cols.has(c))
    expect(missing, `these columns are not on \`checks\`: ${missing.join(', ')}`).toEqual([])
  })
})

describe('a failed query is never reported as "nobody to email"', () => {
  it('captures the error instead of destructuring it away', () => {
    expect(ROUTE).toMatch(/const \{ data: candidates, error: candidatesError \}/)
  })

  it('returns a failure status when the query fails', () => {
    const block = ROUTE.slice(ROUTE.indexOf('if (candidatesError)'))
    expect(block.slice(0, 400)).toContain('status: 500')
  })
})

describe('the paid-customer queue cannot be skipped', () => {
  it('is reached on every return path, not just the happy one', () => {
    // The original bug: this call sat below an early return, so an empty or
    // broken retarget queue silently cancelled the feedback e-mails too.
    const returns = [...ROUTE.matchAll(/return NextResponse\.json\(/g)].length
    const asks    = [...ROUTE.matchAll(/askPaidCustomersForFeedback\(\)/g)].length
    // One definition + one call per exit path that can precede it.
    expect(asks).toBeGreaterThanOrEqual(3)
    expect(returns).toBeGreaterThanOrEqual(3)
  })

  it('asks before returning on an empty candidate list', () => {
    const i = ROUTE.indexOf('if (!candidates?.length)')
    expect(i).toBeGreaterThan(-1)
    expect(ROUTE.slice(i, i + 400)).toContain('askPaidCustomersForFeedback()')
  })
})

describe('the fortnight-deep backlog cannot go out in one burst', () => {
  it('bounds candidates by age at both ends', () => {
    expect(ROUTE).toContain('SEND_BEFORE_DAYS')
    expect(ROUTE).toMatch(/\.lt\('created_at', cutoff\)/)
    expect(ROUTE).toMatch(/\.gt\('created_at', floor\)/)
  })

  it('keeps the per-run cap', () => {
    expect(ROUTE).toContain('.limit(MAX_PER_RUN)')
  })
})
