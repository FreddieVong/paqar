// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractVariantToken, isPerformanceModelText,
  buildComparableCohort, evaluateVerdictEligibility,
} from '@/lib/comparables'

/**
 * Free text and a structured NVIC variant field need different rules.
 *
 * extractVariantToken reads the manufacturer's own variant string, where "RS",
 * "M" and "R" are unambiguous because the manufacturer put them there. Both
 * free-text callers — the model checker (what a buyer typed) and the plate
 * evidence route (the JPJ description) — were applying it to arbitrary text,
 * with model=null, which also disables its model-token exclusion.
 *
 * THE DAMAGE was not a slightly-wrong cohort. A false positive puts the cohort
 * into mixed_variants mode, and evaluateVerdictEligibility SUPPRESSES a verdict
 * in that mode. So a buyer typing a mainstream Malaysian trim saw "varian khas,
 * no price verdict" while fifteen good comparables sat unused — and the free
 * verdict is what proves the value before the RM12 ask.
 *
 * Measured against a corpus of real names: extractVariantToken 4 wrong of 19,
 * the marker 0 of 19.
 */

/** [typed text, is it genuinely a different performance MODEL?] */
const CORPUS: [string, boolean][] = [
  ['Civic RS',       false],   // mainstream Malaysian Civic trim
  ['Civic Type R',   true ],
  ['Civic TC-P',     false],
  ['Civic 1.8 S',    false],
  ['Yaris',          false],
  ['GR Yaris',       true ],
  ['Vios GR Sport',  false],   // cosmetic trim, ordinary car
  ['Myvi AV',        false],
  ['Myvi H',         false],
  ['Axia SE',        false],
  ['Ativa AV',       false],
  ['320i',           false],
  ['330i',           false],
  ['3 Series',       false],
  ['M Sport',        false],   // package, not an M car
  ['Saga',           false],
  ['Saga R3',        true ],   // Proton's performance edition
  ['X50 Flagship',   false],
  ['X50 Executive',  false],
]

describe('the free-text detector classifies real Malaysian names', () => {
  it.each(CORPUS)('%s', (text, expected) => {
    expect(isPerformanceModelText(text)).toBe(expected)
  })

  it('gets the whole corpus right, where the token rule does not', () => {
    const markerWrong = CORPUS.filter(([t, e]) => isPerformanceModelText(t) !== e)
    expect(markerWrong.map(([t]) => t)).toEqual([])

    // The token rule is kept for structured NVIC input, where it is correct —
    // this only records that it is the wrong tool for free text.
    const tokenWrong = CORPUS.filter(([t, e]) => (extractVariantToken(t, null) != null) !== e)
    expect(tokenWrong.length).toBeGreaterThan(0)
  })

  it('recognises a genuine performance model regardless of spacing or case', () => {
    for (const t of ['civic type r', 'CIVIC TYPE-R', 'Honda Civic TypeR', 'gr yaris', 'GR-Yaris']) {
      expect(isPerformanceModelText(t), t).toBe(true)
    }
  })

  it('is not fooled by a badge in ad copy', () => {
    // The cohort filter has the same problem and solves it with a price ratio;
    // here there is no price, so the marker must simply not over-match.
    expect(isPerformanceModelText('Civic 1.8 S with bodykit')).toBe(false)
    expect(isPerformanceModelText('Myvi GT trim')).toBe(false)
  })

  it('handles empty input', () => {
    expect(isPerformanceModelText('')).toBe(false)
    expect(isPerformanceModelText(null)).toBe(false)
    expect(isPerformanceModelText(undefined)).toBe(false)
  })
})

describe('a mainstream trim gets a verdict instead of a suppression', () => {
  /** A realistic mainstream cohort — fifteen ordinary cars. */
  const listings = Array.from({ length: 15 }, (_, i) => ({
    price: 55_000 + i * 1_000,
    title: `2022 Toyota VIOS 1.5 G (A)2022Auto${40 + i}k-${45 + i}kUsedVerified Dealer`,
    url:   `https://www.mudah.my/2022-toyota-vios-1-5-g-a-1155000${String(i).padStart(2, '0')}.htm`,
    year:  '2022',
  }))

  function cohortFor(typed: string) {
    return buildComparableCohort(listings, {
      year: '2022', officialVariant: typed, model: null,
      isSpecialVariant: isPerformanceModelText(typed),
    })
  }

  it('"Vios GR Sport" is judged, not suppressed', () => {
    const cohort = cohortFor('Vios GR Sport')
    expect(cohort.mode).toBe('normal')
    const eligibility = evaluateVerdictEligibility(cohort, 60_000)
    expect(eligibility.eligible).toBe(true)
    expect(eligibility.suppressionReason).toBeNull()
  })

  it('"Civic RS" is judged, not suppressed', () => {
    const eligibility = evaluateVerdictEligibility(cohortFor('Civic RS'), 60_000)
    expect(eligibility.eligible).toBe(true)
  })

  it('uses every comparable rather than a variant-matched subset', () => {
    expect(cohortFor('Vios GR Sport').count).toBe(15)
  })

  it('a genuine performance model still takes the special path', () => {
    // Not suppressed-vs-judged here — just that it is treated differently, so
    // excludePerformanceModels does not strip the buyer's own kind of car.
    expect(isPerformanceModelText('GR Yaris')).toBe(true)
  })
})

describe('both free-text routes use the marker, not the token', () => {
  const ROOT = join(__dirname, '..', '..')
  it.each([
    'app/api/price-check/route.ts',
    'app/api/checks/[id]/price-evidence/route.ts',
  ])('%s', (path) => {
    const src = readFileSync(join(ROOT, path), 'utf-8')
    expect(src).toContain('isPerformanceModelText(variantSource)')
    expect(src).not.toMatch(/isSpecialVariant\s*=\s*variantToken\s*!=\s*null/)
  })

  it('the structured NVIC path is untouched', () => {
    // /api/v1/valuation derives it from the wmNewPrice / familyFloor ratio,
    // which is evidence rather than string matching, and must stay that way.
    const src = readFileSync(join(ROOT, 'app/api/v1/valuation/route.ts'), 'utf-8')
    expect(src).toContain('familyFloorNewPrice')
    expect(src).not.toContain('isPerformanceModelText')
  })
})
