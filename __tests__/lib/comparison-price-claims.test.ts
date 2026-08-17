// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sharedCoveredYears, coveredModelByHub } from '@/lib/market-coverage'
import { isModelHubSlug } from '@/lib/model-hubs'

/**
 * Comparison pages must not assert market prices in source.
 *
 * They shipped a `priceRows` table per comparison — hand-typed min/max figures
 * for two models across six years — under an <h2> reading "Harga pasaran
 * mengikut tahun", and repeated those ranges inside `faqs`, which are emitted
 * as FAQPage JSON-LD. Nothing updated them. By August 2026 they disagreed with
 * Paqar's own cohorts by more than the price of the car:
 *
 *     Myvi 2023   page said RM58k–RM74k    cohort said RM33.8k–RM49.8k
 *     Myvi 2020   page said RM46k–RM60k    cohort said RM30.9k–RM39.8k
 *     Axia 2020   page said RM28k–RM39k    cohort said RM11.8k–RM27.8k
 *
 * A buyer benchmarking against this page would read a badly overpriced car as a
 * bargain. These are also the best-ranking pages on the site and are linked
 * from the homepage.
 *
 * Same guard, same reasoning, as __tests__/lib/model-hub-price-claims.test.ts —
 * the defect is authored content, so it is caught where it is written.
 */

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { SCRAPER_URL: '', SCRAPER_API_KEY: '' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient:       () => ({ from: () => ({}) }),
  createCachedServiceClient: () => ({ from: () => ({}) }),
}))

const PAGE = join(process.cwd(), 'app/bandingkan/[slug]/page.tsx')
const RAW  = readFileSync(PAGE, 'utf-8')

/** Strip comments so prose ABOUT the rule (including the figures above) cannot trip it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Everything above generateStaticParams — the COMPARISONS config and its types. */
const CONFIG = stripComments(RAW.slice(0, RAW.indexOf('export function generateStaticParams')))

const RINGGIT = /(?<![A-Za-z])RM\s?\d[\d,.]*\s*k?/gi

describe('comparison config states no market price', () => {
  it('locates the config region', () => {
    expect(CONFIG.length).toBeGreaterThan(1000)
    expect(CONFIG).toContain('COMPARISONS')
  })

  it('declares no priceRows table', () => {
    expect(CONFIG).not.toMatch(/priceRows/)
    expect(CONFIG).not.toMatch(/\bminA:\s*\d/)
    expect(CONFIG).not.toMatch(/\bmaxB:\s*\d/)
  })

  it('contains no Ringgit amount anywhere in authored content', () => {
    const found = CONFIG.match(RINGGIT) ?? []
    expect(found, `hardcoded Ringgit amounts in the comparison config: ${found.join(', ')}`).toEqual([])
  })

  it('contains no range-shaped or difference-shaped price claim', () => {
    // 'RM46k–RM60k', 'RM13k–RM20k lebih rendah', 'Beza lebih kurang RM10k'.
    const claims = CONFIG.match(
      /(?<![A-Za-z])RM\s?\d[\d,.]*\s*k?\s*(?:hingga|ke|sehingga|–|—|-|to)\s*RM?\s?\d/gi,
    ) ?? []
    expect(claims, `range-shaped claims: ${claims.join(' | ')}`).toEqual([])
  })

  it('checks the config region only, not the whole file', () => {
    // Guard the guard: the assertions above must stay scoped to the authored
    // config, or they become a blanket ban on 'RM' anywhere in the file and a
    // legitimate RM12 CTA would be unfixable.
    //
    // This used to prove the scoping by pointing at the live price formatter
    // (`function fmt`, `row.a.min`). Both are gone: the table now renders a
    // link per model-year instead of a range, because a live range is still the
    // RM12 report's range. The scoping is asserted directly instead.
    expect(CONFIG.length).toBeGreaterThan(500)
    expect(CONFIG.length).toBeLessThan(stripComments(RAW).length)
  })

  it('renders a per-year link where it used to render a range', () => {
    const src = stripComments(RAW)
    expect(src).not.toMatch(/row\.a\.min|row\.b\.min|function fmt/)
    expect(src).toContain('harga-${yearKeyA}-${row.year}')
  })
})

describe('the table is built from evidence', () => {
  it('reads cohorts through the shared DB helper', () => {
    expect(RAW).toContain('getModelYearCohorts')
    expect(RAW).toContain('coveredModelByHub')
  })

  it('does not reimplement the median, outlier trim or year filter', () => {
    for (const forbidden of ['filterOutlierPrices', 'filterListingsByYear', 'medianOf']) {
      expect(stripComments(RAW)).not.toContain(forbidden)
    }
  })

  it('revalidates on the shared market-page window', () => {
    expect(RAW).toContain('export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS')
  })

  it('renders a fallback rather than an empty table', () => {
    expect(RAW).toContain('sedang dikemaskini')
  })
})

describe('every comparison names covered models', () => {
  it('uses hub slugs that exist and are kept warm', async () => {
    const { generateStaticParams } = await import('@/app/bandingkan/[slug]/page')
    const slugs = generateStaticParams().map(p => p.slug)
    expect(slugs.length).toBeGreaterThan(0)

    // slugA/slugB are typed ModelHubSlug, so a bad slug is a compile error —
    // but coverage is a runtime fact the type cannot express. A comparison of
    // two models the cron never scrapes would render the fallback forever.
    const pairs = Array.from(
      CONFIG.matchAll(/slugA:\s*'([a-z0-9-]+)',\s*slugB:\s*'([a-z0-9-]+)'/g),
    ).map(m => [m[1]!, m[2]!] as const)

    expect(pairs.length).toBe(slugs.length)

    for (const [a, b] of pairs) {
      expect(isModelHubSlug(a), `${a} is not a real hub`).toBe(true)
      expect(isModelHubSlug(b), `${b} is not a real hub`).toBe(true)
      expect(coveredModelByHub(a as never), `${a} has no coverage`).toBeDefined()
      expect(coveredModelByHub(b as never), `${b} has no coverage`).toBeDefined()
      expect(
        sharedCoveredYears(a as never, b as never).length,
        `${a} vs ${b} share no warm year — the table can never render`,
      ).toBeGreaterThan(0)
    }
  })
})

describe('sharedCoveredYears', () => {
  it('returns only years both models are warmed for, ascending', () => {
    // Myvi 2019–2023, Axia 2020–2023.
    expect(sharedCoveredYears('perodua-myvi', 'perodua-axia'))
      .toEqual(['2020', '2021', '2022', '2023'])
  })

  it('is symmetric', () => {
    expect(sharedCoveredYears('perodua-alza', 'proton-x50'))
      .toEqual(sharedCoveredYears('proton-x50', 'perodua-alza'))
  })

  it('returns [] when there is no overlap', () => {
    // Jazz 2018–2020, City 2021–2023.
    expect(sharedCoveredYears('honda-jazz', 'honda-city')).toEqual([])
  })
})
