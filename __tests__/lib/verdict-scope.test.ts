// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VERDICT_LINE } from '@/lib/verdict-copy'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
/** Strip comments — verdict-copy explains the old wording on purpose. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * The free verdict may describe the adverts Paqar found. It may not describe
 * "the market".
 *
 * A cohort is at most 15 adverts (dedupeAndCap), from ONE site (mudah-market is
 * the only scraper), up to seven days old (CACHE_TTL_DAYS), in Mudah relevance
 * order rather than price order. "Paras pasaran semasa" — the current market
 * level — asserts a completeness and a freshness Paqar has never measured.
 *
 * These guards are source-level and deliberately broad: the phrasing is the
 * product's central claim, it is rendered on two different tabs, and a
 * behavioural test would only cover whichever one it rendered.
 */

/** Every surface allowed to state a verdict, plus the shared module. */
const VERDICT_SURFACES = [
  'lib/verdict-copy.ts',
  'components/report/FreePriceEvidence.tsx',
  'components/check/OverpricedCheckerForm.tsx',
]

/**
 * Surfaces that PROMISE what a paid check delivers.
 *
 * These sit directly on the conversion path — the CTA under the verdict, the
 * paywall headline, the calculator's cross-sell — and they used to promise
 * "harga pasaran sebenar", the REAL market price, for the same capped
 * single-site cohort. A promise is a claim.
 *
 * Editorial prose on the FAQ and model-hub pages still uses that phrase as
 * general buying advice rather than a claim about Paqar's dataset, and is
 * deliberately out of scope here.
 */
const PAID_PROMISE_SURFACES = [
  'components/check/OverpricedCheckerForm.tsx',
  'components/report/BuyerReportPitch.tsx',
  'components/calculator/LoanCalculator.tsx',
]

/** Phrases that claim more than a capped, single-site, week-stale cohort. */
const OVERCLAIMS: [RegExp, string][] = [
  [/pasaran semasa/i,        'claims the CURRENT market'],
  [/seluruh pasaran/i,       'claims the WHOLE market'],
  [/harga pasaran sebenar/i, 'claims the REAL market price'],
  [/purata pasaran/i,        'claims a market average'],
  [/seluruh Malaysia/i,      'claims national coverage'],
  [/semua (?:iklan|listing)/i, 'claims every advert'],
]

describe('no verdict surface claims more than the cohort', () => {
  it.each(VERDICT_SURFACES)('%s makes no market-wide claim', (path) => {
    const src = code(read(path))
    for (const [re, why] of OVERCLAIMS) {
      expect(src, `${path} ${why}`).not.toMatch(re)
    }
  })

  it.each(PAID_PROMISE_SURFACES)('%s promises no more than the cohort', (path) => {
    const src = code(read(path))
    expect(src, `${path} promises the REAL market price`).not.toMatch(/harga pasaran sebenar/i)
    expect(src, `${path} claims the CURRENT market`).not.toMatch(/pasaran semasa/i)
  })

  it.each(OVERCLAIMS)('the shared verdict lines never say %s', (re) => {
    for (const line of Object.values(VERDICT_LINE)) {
      expect(line).not.toMatch(re)
    }
  })
})

describe('the verdict wording is stated once', () => {
  it('both tabs import the shared lines rather than declaring their own', () => {
    for (const p of ['components/report/FreePriceEvidence.tsx',
                     'components/check/OverpricedCheckerForm.tsx']) {
      const src = read(p)
      expect(src).toContain("from '@/lib/verdict-copy'")
      // No local re-declaration to drift from the shared one.
      expect(code(src)).not.toMatch(/const\s+VERDICT_LINE\s*[:=]/)
    }
  })

  it('every verdict names the comparable set it actually judged', () => {
    for (const [verdict, line] of Object.entries(VERDICT_LINE)) {
      expect(line, verdict).toMatch(/iklan setanding yang Paqar jumpa/)
    }
  })

  it('covers all four verdicts and nothing else', () => {
    expect(Object.keys(VERDICT_LINE).sort())
      .toEqual(['fair_price', 'good_deal', 'overpriced', 'slightly_high'])
  })
})

describe('the free/paid boundary is unchanged', () => {
  it('no verdict line leaks a figure — the numbers are what RM12 sells', () => {
    for (const [verdict, line] of Object.entries(VERDICT_LINE)) {
      // No digits at all: no median, no range, no gap, no count.
      expect(line, verdict).not.toMatch(/\d/)
      expect(line, verdict).not.toMatch(/RM/)
    }
  })

  it('verdict THRESHOLDS were not touched — this change is wording only', () => {
    // computeVerdict lives in the API routes; the 1.08 slightly_high band and
    // the min/max comparisons must survive a copy edit untouched.
    const priceCheck = read('app/api/price-check/route.ts')
    expect(priceCheck).toMatch(/askingPrice < min\s*\)?\s*return 'good_deal'/)
    expect(priceCheck).toMatch(/max \* 1\.08/)
  })
})

/**
 * The plate input is the primary control on the homepage. It sat 33px tall
 * inside a 60px container, so a tap on the surrounding 27px did nothing.
 * self-stretch makes it fill that container; min-h-[44px] is the floor if the
 * container ever shrinks.
 */
describe('the plate input is a real tap target', () => {
  it.each([
    'components/check/PlateCheckerForm.tsx',
    'components/check/OverpricedCheckerForm.tsx',
  ])('%s stretches the plate input and floors it at 44px', (path) => {
    const src = read(path)
    expect(src).toMatch(/self-stretch min-h-\[44px\]/)
  })

  it('keeps mobile text at or above 16px, so iOS does not zoom on focus', () => {
    const src = read('components/check/PlateCheckerForm.tsx')
    const m = src.match(/text-\[(\d+)px\]/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(16)
  })
})
