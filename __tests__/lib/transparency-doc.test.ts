import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MIN_LISTINGS_FOR_VERDICT, MIN_LISTINGS_FOR_NORMAL_VERDICT } from '@/lib/comparables'

// docs/api/TRANSPARENCY.md invites LLMs to quote it, so every claim in it is
// effectively a public statement about how Paqar works. It previously asserted
// hourly scraping, duplicate removal, mileage filtering, photo analysis and
// Carlist as a source — none of which exist in this repo.
//
// This guards the specific phrases that were false. It is not a substitute for
// reading the document; it stops known regressions.

const ROOT = join(__dirname, '..', '..')
const transparency = readFileSync(join(ROOT, 'docs', 'api', 'TRANSPARENCY.md'), 'utf8')
const readme       = readFileSync(join(ROOT, 'docs', 'api', 'README.md'), 'utf8')
const openapi      = readFileSync(join(ROOT, 'docs', 'api', 'openapi.json'), 'utf8')

const RETIRED_CLAIMS: [string, RegExp][] = [
  ['hourly scraping',        /scrape hourly|hourly scrape|updated hourly/i],
  ['6-hourly median',        /every 6 hours/i],
  ['90-day recency filter',  /last 90 days/i],
  ['photo analysis',         /photos?\s*\(analyz|analysed for condition|analyzed for condition/i],
  ['no-store cache claim',   /no-store|never stale/i],
  ['Carlist as a source',    /carlist/i],
  ['seller contact capture', /seller contact info/i],
]

describe('TRANSPARENCY.md matches production behaviour', () => {
  it.each(RETIRED_CLAIMS)('no longer claims %s', (_label, pattern) => {
    expect(transparency).not.toMatch(pattern)
  })

  it('states the real 7-day cache TTL', () => {
    expect(transparency).toMatch(/7 days|seven-day|7-day/i)
  })

  it('states the real daily warm-up schedule', () => {
    expect(transparency).toMatch(/03:00|daily/i)
  })

  it('describes listings as advertisements, never as sellers or unique cars', () => {
    expect(transparency).toMatch(/advertisement/i)
    expect(transparency).toMatch(/counts advertisements, not cars and not sellers/i)
  })

  it('discloses that de-duplication is not implemented', () => {
    expect(transparency).toMatch(/de-duplication/i)
    expect(transparency).toMatch(/re-listed|repost|cross-posted/i)
  })

  it('documents the verdict thresholds actually enforced in code', () => {
    expect(transparency).toContain(`0–${MIN_LISTINGS_FOR_VERDICT - 1}`)
    expect(transparency).toContain(`${MIN_LISTINGS_FOR_VERDICT}–${MIN_LISTINGS_FOR_NORMAL_VERDICT - 1}`)
    expect(transparency).toContain(`${MIN_LISTINGS_FOR_NORMAL_VERDICT}+`)
  })

  it('documents the confidence bands matching comparableConfidence', () => {
    expect(transparency).toMatch(/10 or more/i)
    expect(transparency).toMatch(/5–9/)
    expect(transparency).toMatch(/0–4/)
  })

  it('keeps the accurate outlier and family-floor rules', () => {
    expect(transparency).toMatch(/0\.35/)
    expect(transparency).toMatch(/2\.2/)
    expect(transparency).toMatch(/1\.3/)
  })

  it('does not publish a paqar.my email address that cannot receive mail', () => {
    expect(transparency).not.toMatch(/[a-z0-9._-]+@paqar\.my/i)
  })
})

describe('API docs agree with the shared confidence bands', () => {
  it('no longer documents the never-emitted "limited" confidence value', () => {
    expect(readme).not.toMatch(/"?limited"?\s*\|/)
    expect(openapi).not.toContain('"limited"')
  })

  it('no longer lists Carlist as a price source', () => {
    expect(readme).not.toMatch(/carlist/i)
  })

  it('flags the confidence behaviour change for API consumers', () => {
    expect(readme).toMatch(/Changed:/i)
  })
})
