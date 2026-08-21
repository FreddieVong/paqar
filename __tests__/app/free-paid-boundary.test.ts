// @vitest-environment node
//
// The free/paid boundary, asserted at the source layer.
//
// Paqar's free tier is a qualitative verdict, a qualitative explanation and a
// confidence band. The RM12 report is the numbers: median, range, price gap,
// negotiation room, trade-in evidence. The price templates were publishing the
// paid half for nothing — 58 year pages carrying min, max, median and listing
// count, repeated inside FAQPage JSON-LD, plus the median again in a
// /kira-ansuran-kereta?harga= query string.
//
// THREE LAYERS GUARD THIS, and they catch different things:
//
//   1. This file — the template cannot REFERENCE the figures. Fails the moment
//      someone reintroduces `stats.medianPrice` into the JSX.
//   2. __tests__/lib/year-price-context.test.ts — the module that decides what
//      a free page may say emits no digit but a model year.
//   3. scripts/seo-check.mjs — scans built HTML across all 89 price pages.
//      The only layer that sees what a template actually interpolates, and the
//      only one that would catch a leak introduced through a helper.
//
// A unit test alone is not sufficient and neither is the build guard alone.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { VARIANT_GUIDES } from '@/lib/variant-guides'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const YEAR_PAGE   = 'app/harga-model/[slug]/page.tsx'
const MODEL_HUB   = 'app/harga-kereta-terpakai/[model]/page.tsx'
const BRAND_LIST  = 'components/layout/BrandModelList.tsx'
const COMPARISON  = 'app/bandingkan/[slug]/page.tsx'
const VARIANT     = 'app/varian/[model]/page.tsx'
const HUB_INDEX   = 'app/harga-kereta-terpakai/page.tsx'

/**
 * Comments describe the removed leak on purpose — that is the record of why
 * the code looks like this. Stripping them is what makes the assertions below
 * about code rather than prose.
 */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments and JSX comment bodies
    .replace(/^\s*\/\/.*$/gm, '')       // line comments
}

// ── Year pages ──────────────────────────────────────────────────────────────

describe('free year pages cannot render market evidence', () => {
  const src = code(YEAR_PAGE)

  /**
   * Everything the component returns — i.e. everything a reader can see.
   *
   * Scoped deliberately. The cohort's median, min, max and count are still READ
   * above this point and handed to buildYearPriceContext, because the
   * qualitative conclusion and the confidence band are decided from them. That
   * is the correct shape: compute from the figures, render none of them.
   * Asserting against the whole file would forbid the computation too, and the
   * page would lose its conclusion.
   */
  const markup = src.slice(src.indexOf('  return (\n    <>'))

  it('finds the rendered markup', () => {
    expect(markup.length).toBeGreaterThan(2000)
    expect(markup).toContain('<Shell>')
  })

  it('never renders a market median', () => {
    expect(markup).not.toMatch(/medianPrice|\.median\b/)
  })

  it('never renders a market range', () => {
    expect(markup).not.toMatch(/minPrice|maxPrice|\.min\b|\.max\b/)
  })

  it('never renders a statistical sample size', () => {
    // The cohort size behind the band. Beside a band it is the missing piece
    // that makes the band estimable.
    expect(markup).not.toMatch(/listingCount|\.count\b/)
  })

  it('never references a derived price gap or threshold anywhere in the file', () => {
    // overpricedThreshold was max x 1.08 — the price gap the RM12 report sells.
    // Banned outright rather than scoped: unlike the median, nothing on this
    // page has any reason to compute it.
    expect(src).not.toMatch(/overpricedThreshold|spreadRm|stepRm|priceGap/)
  })

  it('never references a ratio between distribution figures anywhere in the file', () => {
    expect(src).not.toMatch(/spreadToStepRatio|largestAdjacentStepRm/)
  })

  it('names negotiation room only as something the paid report contains', () => {
    // "ruang untuk berunding" appears once, in the sentence describing what
    // RM12 buys. Describing the product is the point; printing a range is the
    // leak, and the RM-interpolation assertion below covers that.
    const mentions = [...markup.matchAll(/berunding|runding/gi)]
    expect(mentions.length).toBeLessThanOrEqual(1)
    if (mentions.length) expect(markup).toMatch(/Laporan RM12[^<]*berunding/)
  })

  it('states no trade-in value', () => {
    expect(markup).not.toMatch(/tradeIn|trade_in|nilai tukar/i)
  })

  it('passes no price to the loan calculator', () => {
    // The median used to travel in a query string on a link Google follows.
    expect(src).not.toMatch(/kira-ansuran-kereta\?harga=/)
  })

  it('renders exactly one RM interpolation — the public teaser band', () => {
    // The band is the ONE market figure a Tier A year page may print, and it is
    // rendered through formatTeaserBand so its shape cannot drift. Anything
    // else interpolating RM would be a second, unreviewed disclosure.
    expect(markup).not.toMatch(/RM\{/)
    expect(markup).toContain('formatTeaserBand(teaser)')
  })

  it('states the teaser is a general estimate, not a valuation', () => {
    // A band without this qualifier reads as a valuation, which is the one
    // thing it must not be.
    expect(markup).toContain('bukan penilaian untuk mana-mana unit tertentu')
    expect(markup).toContain('Anggaran umum untuk model dan tahun ini')
  })

  it('takes the band from the teaser module, never from the cohort directly', () => {
    expect(src).toContain('buildMarketTeaser')
    // The cohort's own bounds must not reach the band.
    expect(markup).not.toMatch(/yearStats\.(min|max|median)/)
  })

  it('still computes the cohort, because the conclusion depends on it', () => {
    // Guards the guard: if buildMarketYearStats were removed the assertions
    // above would pass vacuously, and the page would lose its confidence band.
    expect(src).toMatch(/buildMarketYearStats/)
    expect(src).toMatch(/buildYearPriceContext/)
  })
})

// ── Every other price surface ───────────────────────────────────────────────

describe('no price template renders a cohort figure', () => {
  it.each([
    ['model hub',        MODEL_HUB],
    ['brand model list', BRAND_LIST],
    ['comparison',       COMPARISON],
    ['hub index',        HUB_INDEX],
  ])('%s interpolates no RM value', (_name, path) => {
    expect(code(path)).not.toMatch(/RM\{/)
  })

  it('the variant guide prints the manufacturer list price and nothing derived', () => {
    // wm_new_pr is the published new-car price a trim launched at — public
    // reference information from Perodua and Honda, not a used-market figure.
    // The derived gaps between trims stay out: those are what RM12 sells.
    const src = code(VARIANT)
    expect(src).toContain('rung.newPriceRm')
    expect(src).not.toMatch(/stepUpRm|ladderSpreadRm/)
  })

  it('the variant guide labels the list price so it cannot read as market value', () => {
    const src = code(VARIANT)
    expect(src).toContain('Harga Baharu Asal Mengikut Varian')
    expect(src).toContain('bukan harga terpakai hari ini')
    expect(src).toContain('baharu')
  })

  it('the brand model list can no longer receive spans at all', () => {
    // Strongest form: the prop is gone, so the figures cannot reach the
    // component even by mistake.
    expect(code(BRAND_LIST)).not.toMatch(/ModelPriceSpan|spans/)
  })

  it('the hub index no longer reads market_price_cache', () => {
    expect(code(HUB_INDEX)).not.toMatch(/getCoverageModelSpans/)
  })

  it('the comparison table renders links rather than ranges', () => {
    const src = code(COMPARISON)
    expect(src).not.toMatch(/row\.a\.(min|max)|row\.b\.(min|max)/)
    expect(src).toMatch(/harga-\$\{yearKeyA\}-\$\{row\.year\}/)
  })


})

// ── The one exemption, held to its shape ────────────────────────────────────

describe('hand-written variant premiums stay within their exemption', () => {
  // scripts/seo-check.mjs allows RM figures on /varian/* only in the shape
  // "RM3k" or "RM3–5k" — editorial priors about what a trim is worth relative
  // to another. This asserts the guide data can only contain that shape, so
  // the exemption cannot be widened by editing content instead of the guard.
  const SHAPE = /^\d{1,2}(?:[–-]\d{1,2})?k$/

  const allText = Object.values(VARIANT_GUIDES).flatMap(g => [
    g.answerLine, g.metaDescription, g.bestValue, g.avoid ?? '',
    ...g.redFlags,
    ...g.faq.flatMap(f => [f.q, f.a]),
    ...g.generations.flatMap(gen =>
      gen.variants.flatMap(v => [v.verdictNote, v.usedPriceBand, ...v.differentiators, ...v.spotChecks])
    ),
  ])

  it('finds the real guide content', () => {
    expect(allText.length).toBeGreaterThan(100)
  })

  it.each(Object.keys(VARIANT_GUIDES))('%s states no absolute price', slug => {
    const guide = VARIANT_GUIDES[slug]!
    const text = [
      guide.answerLine, guide.metaDescription, guide.bestValue, guide.avoid ?? '',
      ...guide.redFlags,
      ...guide.faq.flatMap(f => [f.q, f.a]),
      ...guide.generations.flatMap(gen =>
        gen.variants.flatMap(v => [v.verdictNote, v.usedPriceBand, ...v.differentiators, ...v.spotChecks])
      ),
    ].join(' ')

    // Range branch first — with the plain branch leading, "RM1–3k" matches as
    // "RM1" and every premium reads as an absolute price. Same ordering as
    // RM_FIGURE in scripts/seo-check.mjs, and for the same reason.
    for (const m of text.matchAll(/RM\s?(\d{1,2}[–-]\d{1,2}k|[\d,]+(?:\.\d+)?k?)/gi)) {
      expect(m[1], `${slug}: "${m[0]}" is not a relative trim premium`).toMatch(SHAPE)
    }
  })

  it('never states a market median, range or listing count in guide prose', () => {
    const joined = allText.join(' ')
    expect(joined).not.toMatch(/harga tengah|median|julat pasaran|\d+\s+(listing|iklan)/i)
  })
})

// ── The count taxonomy ──────────────────────────────────────────────────────

describe('sample sizes are forbidden; an action count is not', () => {
  // WHY THIS EXISTS. "No listing counts on free surfaces" is too broad a rule
  // and would block an approved future feature: an action count in the
  // free-check result — "Ada 10 listing yang lebih murah di pasaran" — which
  // counts QUALIFYING ALTERNATIVES rather than the sample behind a statistic.
  //
  // The feature is NOT implemented on this branch. These tests fix the
  // distinction now so the protections cannot be misread later as a blanket
  // ban, and so nobody weakens the SEO-surface rule to make room for it.
  // Comment prose wraps, so compare on normalised whitespace rather than on
  // where the author happened to break the line.
  const GUARD = readFileSync(join(ROOT, 'scripts/seo-check.mjs'), 'utf8')
    .replace(/\n\s*\/\/\s?/g, ' ')
    .replace(/\s+/g, ' ')

  it('the SEO guard rule is scoped to prerendered surfaces, and says so', () => {
    expect(GUARD).toContain('no count on a prerendered SEO surface')
    expect(GUARD).toContain('QUALIFYING ALTERNATIVES')
  })

  it('the SEO guard still rejects a sample-size disclosure', () => {
    const SAMPLE_COUNT = /\b\d+\s+(listing|iklan)\b/i
    expect(SAMPLE_COUNT.test('Berdasarkan 14 listing pasaran terkini')).toBe(true)
    expect(SAMPLE_COUNT.test('Dikira dari 9 iklan setara')).toBe(true)
  })

  it('no SEO template renders any count, which is what keeps the rule absolute there', () => {
    // The permitted count lives in the free-check result, never here. These
    // templates publish a band and prose and count nothing.
    for (const path of [YEAR_PAGE, MODEL_HUB, BRAND_LIST, COMPARISON, HUB_INDEX, VARIANT]) {
      expect(code(path), path).not.toMatch(/betterListingCount/)
      expect(code(path), path).not.toMatch(/listingCount/)
    }
  })

  it('the free-result contract records the exception without pre-empting it', () => {
    const api = read('types/api.ts')
    expect(api).toContain('betterListingCount')
    expect(api).toContain('QUALIFYING ALTERNATIVES')
    // Documented, not built: no field on the type yet.
    const resultType = api.slice(api.indexOf('export type PriceCheckResult'))
    expect(resultType).not.toContain('betterListingCount')
  })

  it('the free result still forbids the sample size itself', () => {
    const api = read('types/api.ts')
    const resultType = api.slice(api.indexOf('export type PriceCheckResult'), api.indexOf('export type PriceCheckResult') + 900)
    for (const banned of ['listingCount', 'medianPrice', 'minPrice', 'maxPrice']) {
      expect(resultType, `leaked: ${banned}`).not.toContain(banned)
    }
  })
})
