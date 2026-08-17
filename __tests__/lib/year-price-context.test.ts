// @vitest-environment node
//
// The free/paid boundary, enforced at the module that decides what a free year
// page may say.
//
// An earlier version of lib/year-price-context.ts returned spreadRm,
// largestAdjacentStepRm and spreadToStepRatio, and the page printed all three.
// Each is RM12 evidence: a spread plus a median reconstructs the range, and a
// ratio plus one anchor reconstructs the spread. The tests then in place
// checked that the arithmetic was right, which it was — they never asked
// whether the arithmetic should be on the page.
//
// So the assertions here are about DISCLOSURE first. The strongest is
// `emits no digit anywhere`, which no amount of copy editing can slip past.
import { describe, it, expect } from 'vitest'
import {
  buildYearPriceContext,
  yearPriceContextLines,
  confidenceLabel,
  type YearCohortPoint,
  type YearPriceContext,
} from '@/lib/year-price-context'

const point = (year: string, median: number, min: number, max: number, count = 14): YearCohortPoint =>
  ({ year, median, min, max, count })

/** Real cohorts read from market_price_cache on 2026-08-14. */
const MYVI_2019 = point('2019', 35300, 20880, 36800, 14)
const MYVI_2020 = point('2020', 34400, 28800, 43800, 14)
const MYVI_2021 = point('2021', 38300, 28999, 41800, 14)
const BEZZA_2020 = point('2020', 31300, 23888, 39800, 15)
const BEZZA_2021 = point('2021', 31888, 25500, 36800, 15)
const CITY_2021 = point('2021', 54300, 41900, 59800, 14)
const CITY_2022 = point('2022', 60800, 48000, 74999, 14)

const linesFor = (ctx: YearPriceContext, model = 'Perodua Myvi') => yearPriceContextLines(ctx, model)

// ── The boundary ────────────────────────────────────────────────────────────

describe('free year pages disclose no market evidence', () => {
  const cases: Array<[string, YearPriceContext]> = [
    ['myvi 2020 (both neighbours)', buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })],
    ['myvi 2019 (no previous)',     buildYearPriceContext({ current: MYVI_2019, previous: null, next: MYVI_2020 })],
    ['bezza 2020 (level years)',    buildYearPriceContext({ current: BEZZA_2020, previous: null, next: BEZZA_2021 })],
    ['city 2022 (large step)',      buildYearPriceContext({ current: CITY_2022, previous: CITY_2021, next: null })],
  ]

  it.each(cases)('%s emits no digit other than a model year', (_name, ctx) => {
    // The catch-all. A median, a range, a gap, a count, a ratio and a
    // percentage are all impossible to state without a digit.
    //
    // Model years are the one legitimate numeral on the page — "unit 2020" is
    // the subject, not evidence about it — so they are removed before the
    // check rather than exempted by a looser pattern. Anything numeric that
    // survives this strip is a figure the free tier must not print.
    const withoutYears = linesFor(ctx).join(' ').replace(/\b(19|20)\d{2}\b/g, '')
    expect(withoutYears).not.toMatch(/\d/)
  })

  it.each(cases)('%s strips real years, so the guard above can actually fail', (_name, ctx) => {
    // Guards the guard: if the strip were too greedy the test above would pass
    // vacuously on any copy at all.
    const stripped = 'harga RM34,400 pada 2020'.replace(/\b(19|20)\d{2}\b/g, '')
    expect(stripped).toMatch(/\d/)
    expect(linesFor(ctx).join(' ')).toMatch(/\b(19|20)\d{2}\b/)
  })

  it.each(cases)('%s emits no RM figure', (_name, ctx) => {
    // RM followed by a digit — the actual leak shape. A bare /RM/i also matches
    // ordinary Malay ("be-rm-akna"), which would make this pass or fail on
    // vocabulary rather than on disclosure.
    expect(linesFor(ctx).join(' ')).not.toMatch(/RM\s?\d/i)
  })

  it.each(cases)('%s emits no ratio or multiple', (_name, ctx) => {
    // "3.8x", "kali ganda", "peratus", "%" — anything that lets a reader
    // reconstruct one quantity from another.
    expect(linesFor(ctx).join(' ')).not.toMatch(/kali ganda|×|\bx\b|peratus|%/i)
  })

  it.each(cases)('%s names no market statistic', (_name, ctx) => {
    // Median, range, spread, listing count, negotiation room, trade-in value.
    expect(linesFor(ctx).join(' ')).not.toMatch(
      /median|harga tengah|julat|jurang|listing|iklan setara|nilai tukar|trade-?in|ruang runding/i
    )
  })

  it('exposes no numeric field on the context object itself', () => {
    // The page can only render what the type offers. Fields named here were
    // the exact leak: spreadRm, largestAdjacentStepRm, spreadToStepRatio.
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })
    const numericValues = JSON.stringify(ctx).match(/:\s*-?\d+(\.\d+)?/g) ?? []
    expect(numericValues).toEqual([])
    for (const banned of ['spreadRm', 'largestAdjacentStepRm', 'spreadToStepRatio', 'median', 'min', 'max', 'count', 'stepRm']) {
      expect(Object.keys(ctx)).not.toContain(banned)
      expect(JSON.stringify(ctx)).not.toContain(banned)
    }
  })

  it('carries only the year label as a numeral, never a price', () => {
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })
    expect(ctx.year).toBe('2020')
    expect(ctx.previous?.year).toBe('2019')
    expect(ctx.next?.year).toBe('2021')
    // Direction and publishability, never magnitude.
    expect(ctx.previous).toEqual({ year: '2019', direction: 'lower', publishable: false })
    expect(ctx.next).toEqual({ year: '2021', direction: 'lower', publishable: true })
  })
})

// ── The conclusion is still correct ─────────────────────────────────────────

describe('the qualitative conclusion still tracks the cohort', () => {
  it('calls the unit dominant when the within-year spread is far wider than the year step', () => {
    // Myvi 2020: spread 15000 against a largest step of 3900.
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })
    expect(ctx.driver).toBe('unit')
    expect(linesFor(ctx)[0]).toContain('menggerakkan harga')
  })

  it('calls the unit dominant when adjacent years are level', () => {
    // Bezza 2020 vs 2021: RM588 apart, 1.9% of the median. Whatever variation
    // exists is inside the year, so the same conclusion follows for a
    // different reason — and it is reached without dividing by noise.
    const ctx = buildYearPriceContext({ current: BEZZA_2020, previous: null, next: BEZZA_2021 })
    expect(ctx.driver).toBe('unit')
    expect(ctx.next).toEqual({ year: '2021', direction: 'level', publishable: false })
    // A level reading is an absence of evidence, not evidence of sameness, so
    // the page says nothing about it at all.
    expect(linesFor(ctx, 'Perodua Bezza').join(' ')).not.toMatch(/2021/)
  })

  it('calls the year dominant when the step clearly exceeds the spread', () => {
    const ctx = buildYearPriceContext({
      current:  point('2021', 50000, 48000, 52000),   // spread 4000
      previous: point('2020', 38000, 36000, 40000),   // step  12000
      next:     null,
    })
    expect(ctx.driver).toBe('year')
    expect(linesFor(ctx, 'Honda City')[0]).toContain('Tahun model menggerakkan harga')
  })

  it('calls it balanced when neither clearly dominates', () => {
    const ctx = buildYearPriceContext({
      current:  point('2021', 50000, 46000, 54000),   // spread 8000
      previous: point('2020', 43000, 40000, 47000),   // step   7000
      next:     null,
    })
    expect(ctx.driver).toBe('balanced')
    expect(linesFor(ctx, 'Honda City')[0]).toContain('sama-sama menggerakkan harga')
  })

  it('reports direction in both directions when publishable', () => {
    const dearer = buildYearPriceContext({ current: MYVI_2021, previous: MYVI_2020, next: null })
    expect(dearer.previous).toEqual({ year: '2020', direction: 'higher', publishable: true })
    expect(linesFor(dearer).join(' ')).toContain('lebih mahal daripada unit 2020')

    const cheaper = buildYearPriceContext({ current: MYVI_2020, previous: null, next: MYVI_2021 })
    expect(cheaper.next).toEqual({ year: '2021', direction: 'lower', publishable: true })
    expect(linesFor(cheaper).join(' ')).toContain('lebih murah daripada unit 2021')
  })
})

// ── No conclusion where the data cannot carry one ───────────────────────────

describe('silence where the evidence is insufficient', () => {
  it('renders nothing at all with no adjacent cohort', () => {
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: null, next: null })
    expect(ctx.driver).toBe('insufficient')
    expect(linesFor(ctx)).toEqual([])
  })

  it('renders nothing when the cohort is too small to characterise', () => {
    // 6 comparables is verdict-eligible but far too thin to claim the SHAPE of
    // the distribution. harga-civic-2022 sat at exactly this on 2026-08-14.
    const ctx = buildYearPriceContext({
      current:  point('2022', 80350, 63900, 101555, 6),
      previous: point('2021', 75900, 67999, 83999, 10),
      next:     null,
    })
    expect(ctx.driver).toBe('insufficient')
    expect(linesFor(ctx)).toEqual([])
  })

  it('renders nothing when every listing carries the same price', () => {
    const ctx = buildYearPriceContext({
      current:  point('2021', 30000, 30000, 30000, 12),
      previous: point('2020', 28000, 27000, 29000, 12),
      next:     null,
    })
    expect(ctx.driver).toBe('insufficient')
    expect(linesFor(ctx)).toEqual([])
  })
})

// ── Confidence is a band, never a count ─────────────────────────────────────

describe('confidence', () => {
  it('maps cohort size to a band using the shared rule', () => {
    expect(buildYearPriceContext({ current: point('2021', 30000, 25000, 35000, 14), previous: null, next: null }).confidence).toBe('high')
    expect(buildYearPriceContext({ current: point('2021', 30000, 25000, 35000, 6),  previous: null, next: null }).confidence).toBe('medium')
    expect(buildYearPriceContext({ current: point('2021', 30000, 25000, 35000, 3),  previous: null, next: null }).confidence).toBe('low')
  })

  it.each(['high', 'medium', 'low'] as const)('%s label states no count', band => {
    const label = confidenceLabel(band)
    expect(label).not.toMatch(/\d/)
    expect(label).not.toMatch(/listing|iklan/i)
  })
})

// ── The pilot claim it exists to make ───────────────────────────────────────

// ── Directional claims must clear a real bar ────────────────────────────────

describe('cross-year directional claims', () => {
  // THE DEFECT THIS PREVENTS. The first version published a direction whenever
  // the gap cleared 2%, which put this on /harga-myvi-2020:
  //
  //     Harga unit 2020 secara amnya lebih rendah daripada unit 2019.
  //     Harga unit 2020 secara amnya lebih rendah daripada unit 2021.
  //
  // Cheaper than a 2021 is depreciation. Cheaper than a 2019 is not — it is
  // what a difference in variant mix looks like when read as a price
  // difference. The gap was RM900 on a RM34,400 median.
  it('suppresses the anti-depreciation claim on the real Myvi cohort', () => {
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })
    expect(ctx.previous!.publishable).toBe(false)
    const rendered = linesFor(ctx).join(' ')
    expect(rendered).not.toMatch(/2019/)
    expect(rendered).toContain('lebih murah daripada unit 2021')
  })

  it('publishes a with-depreciation claim above 5%', () => {
    const ctx = buildYearPriceContext({
      current:  point('2020', 50_000, 45_000, 55_000, 12),
      previous: null,
      next:     point('2021', 54_000, 49_000, 59_000, 12),   // 8% dearer, newer
    })
    expect(ctx.next!.publishable).toBe(true)
  })

  it('suppresses a with-depreciation claim below 5%', () => {
    const ctx = buildYearPriceContext({
      current:  point('2020', 50_000, 45_000, 55_000, 12),
      previous: null,
      next:     point('2021', 51_500, 47_000, 56_000, 12),   // 3%
    })
    expect(ctx.next!.publishable).toBe(false)
  })

  it('holds an anti-depreciation claim to the doubled bar', () => {
    // Older year dearer by 7% — over the normal bar, under the doubled one.
    const under = buildYearPriceContext({
      current:  point('2019', 53_500, 48_000, 58_000, 12),
      previous: null,
      next:     point('2020', 50_000, 45_000, 55_000, 12),
    })
    expect(under.next!.direction).toBe('higher')
    expect(under.next!.publishable).toBe(false)

    // Older year dearer by 20% — large enough that variant mix is an
    // implausible sole explanation.
    const over = buildYearPriceContext({
      current:  point('2019', 60_000, 54_000, 66_000, 12),
      previous: null,
      next:     point('2020', 50_000, 45_000, 55_000, 12),
    })
    expect(over.next!.publishable).toBe(true)
  })

  it('requires both cohorts to be substantial', () => {
    const ctx = buildYearPriceContext({
      current:  point('2020', 50_000, 45_000, 55_000, 12),
      previous: null,
      next:     point('2021', 60_000, 55_000, 65_000, 6),   // thin neighbour
    })
    expect(ctx.next!.publishable).toBe(false)
  })

  it('never publishes a level reading as a direction', () => {
    const ctx = buildYearPriceContext({ current: BEZZA_2020, previous: null, next: BEZZA_2021 })
    expect(ctx.next!.direction).toBe('level')
    expect(ctx.next!.publishable).toBe(false)
  })
})

describe('the block still asks the buyer to check a specific car', () => {
  it('closes by pointing at the unit rather than the year', () => {
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })
    expect(linesFor(ctx).at(-1)).toContain('unit itu sendiri disemak')
  })

  it('states no verdict on whether an asking price is fair — that is what a check does', () => {
    // Scoped to a judgement ABOUT A PRICE. A comparative between two model
    // years ("unit 2020 lebih murah daripada unit 2021") is a statement about
    // the market, not a verdict on anyone's asking price, and is what the whole
    // block exists to say.
    const ctx = buildYearPriceContext({ current: MYVI_2020, previous: MYVI_2019, next: MYVI_2021 })
    const rendered = linesFor(ctx).join(' ')
    expect(rendered).not.toMatch(/harga (ini|itu|tersebut)\s+(berpatutan|mahal|murah)/i)
    expect(rendered).not.toMatch(/patut beli|berbaloi|tawaran (baik|bagus)/i)
  })
})
