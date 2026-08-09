// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MARKET_COVERAGE } from '@/lib/market-coverage'
import { MODEL_HUB_SLUGS } from '@/lib/model-hubs'

/**
 * The year page's MODEL_MAP is the LAST hand-written copy of the make/model
 * strings, and it is the copy that reads the cache.
 *
 * app/harga-model/[slug]/page.tsx looks a model up by yearKey and passes
 * `info.make` / `info.model` straight to getCachedMarketPrices, which lowercases
 * them and matches against rows the warm-cache cron wrote from MARKET_COVERAGE.
 * If the two ever disagree — 'HRV' against the cron's 'HR-V', a renamed model,
 * a year page whose key was never added here — the query matches nothing and
 * the page renders its empty-data fallback. Silently, forever: no error, no
 * failing test, no 404 anyone would notice. Just a prerendered page in the
 * sitemap with no prices on it.
 *
 * Scanned from source rather than imported because App Router page modules may
 * only export the framework's own symbols, so MODEL_MAP cannot be exported.
 */

const PAGE = readFileSync(
  join(__dirname, '..', '..', 'app/harga-model/[slug]/page.tsx'), 'utf-8',
)

/** Parses `'key': { make: 'X', model: 'Y', brand: 'Z', hubSlug: 'h', … }` entries. */
function parseModelMap(): Map<string, { make: string; model: string; hubSlug?: string }> {
  const body = PAGE.slice(PAGE.indexOf('const MODEL_MAP'), PAGE.indexOf('type Props'))
  const out = new Map<string, { make: string; model: string; hubSlug?: string }>()

  const entry = /^ {2}'?([a-z0-9-]+)'?: \{\s*\n\s*make:\s*'([^']+)',\s*model:\s*'([^']+)'[^\n]*\n(?:\s*hubSlug:\s*'([^']+)',)?/gm
  for (const m of body.matchAll(entry)) {
    out.set(m[1]!, { make: m[2]!, model: m[3]!, hubSlug: m[4] })
  }
  return out
}

const MODEL_MAP = parseModelMap()

describe('the year page agrees with the coverage declaration', () => {
  it('parses the map at all', () => {
    // Guard the guard: a regex that matched nothing would make every
    // assertion below vacuously true.
    expect(MODEL_MAP.size).toBe(MARKET_COVERAGE.length)
  })

  it('has an entry for every model the cron warms', () => {
    const missing = MARKET_COVERAGE
      .filter(m => !MODEL_MAP.has(m.yearKey))
      .map(m => `${m.make} ${m.model} (${m.yearKey})`)
    // A missing key means notFound() at build time for every year of that
    // model, on URLs the sitemap advertises.
    expect(missing, `coverage entries with no MODEL_MAP entry: ${missing.join(', ')}`).toEqual([])
  })

  it('uses the exact cache keys the cron writes rows under', () => {
    const mismatched: string[] = []
    for (const m of MARKET_COVERAGE) {
      const entry = MODEL_MAP.get(m.yearKey)
      if (!entry) continue
      if (entry.make !== m.make || entry.model !== m.model) {
        mismatched.push(
          `${m.yearKey}: page says ${entry.make}/${entry.model}, cron writes ${m.make}/${m.model}`,
        )
      }
    }
    expect(mismatched, mismatched.join(' | ')).toEqual([])
  })

  it('names the same hub as the coverage list, or none at all', () => {
    const wrong: string[] = []
    for (const m of MARKET_COVERAGE) {
      const entry = MODEL_MAP.get(m.yearKey)
      if (!entry) continue
      if ((entry.hubSlug ?? undefined) !== (m.hubSlug ?? undefined)) {
        wrong.push(`${m.yearKey}: page ${entry.hubSlug ?? 'none'}, coverage ${m.hubSlug ?? 'none'}`)
      }
    }
    // A hub named here that coverage does not name would put a link and a
    // JSON-LD breadcrumb on a page that 404s — the bug lib/model-hubs.ts exists
    // to prevent, in the one place the type system cannot see it.
    expect(wrong, wrong.join(' | ')).toEqual([])
  })

  it('declares no model the cron does not scrape', () => {
    const keys = new Set(MARKET_COVERAGE.map(m => m.yearKey))
    const orphans = [...MODEL_MAP.keys()].filter(k => !keys.has(k))
    // An orphan renders a permanently empty year page at a crawlable 200.
    expect(orphans, `MODEL_MAP entries with no coverage: ${orphans.join(', ')}`).toEqual([])
  })

  it('only names hub slugs that have a route', () => {
    for (const [key, entry] of MODEL_MAP) {
      if (!entry.hubSlug) continue
      expect(
        (MODEL_HUB_SLUGS as readonly string[]).includes(entry.hubSlug),
        `${key} → ${entry.hubSlug} has no page`,
      ).toBe(true)
    }
  })
})
