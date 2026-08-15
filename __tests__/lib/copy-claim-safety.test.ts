import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** Strip comments — the fixes document the old wording on purpose. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * Two claims Paqar cannot substantiate, pinned so they cannot drift back.
 *
 * 1. PROVENANCE. The vehicle block was labelled "Sumber: JPJ". The lookup
 *    provider is RegCheck (Infinite Loop Development Ltd), whose published
 *    material names no Malaysian source — only "official government data
 *    sources" generically. Paqar has no basis to attribute the data to JPJ.
 *
 * 2. MARKET SCOPE. The methodology line and the negotiation scripts said
 *    "di pasaran" over a cohort that is at most 15 adverts (dedupeAndCap),
 *    from ONE site (mudah-market.ts is the only scraper), up to 7 days old
 *    (CACHE_TTL_DAYS), ordered by relevance rather than price. The scripts
 *    matter most: the buyer pastes them to a seller, so an overclaim is
 *    repeated by the buyer as their own words.
 *
 * These are source-level guards, deliberately. The wording is spread across a
 * component, a sample, an OG image and an email template, and a behavioural
 * test would only cover whichever surface it rendered.
 */

/** Every surface that states what the comparable set is. */
const CLAIM_SURFACES = [
  'components/report/BuyerReportContent.tsx',
  'components/report/SampleReportPreview.tsx',
  'app/api/og/route.tsx',
  'lib/email/retarget-template.ts',
]

describe('provenance is never attributed to JPJ', () => {
  it.each(CLAIM_SURFACES)('%s does not claim JPJ as the data source', (path) => {
    expect(code(read(path))).not.toMatch(/Sumber:\s*JPJ/)
  })

  it('the report and the sample agree on the provenance label', () => {
    for (const path of ['components/report/BuyerReportContent.tsx',
                        'components/report/SampleReportPreview.tsx']) {
      expect(read(path)).toContain('Maklumat pendaftaran kenderaan')
    }
  })
})

describe('the comparable set is never described as "the market"', () => {
  it.each(CLAIM_SURFACES)('%s makes no "listing … di pasaran" claim', (path) => {
    const src = code(read(path))
    // "N listing/iklan … di pasaran" — a count of adverts asserted to be the
    // market. Generic prose about the used-car market elsewhere is unaffected,
    // because the count is what makes it a measurement claim.
    expect(src).not.toMatch(/\d+\s*(listing|iklan)[^\n]{0,40}di pasaran/)
    expect(src).not.toMatch(/\$\{[^}]+\}\s*(listing|iklan)[^\n]{0,40}di pasaran/)
  })

  it('no seller-facing script asserts a figure IS the current market price', () => {
    const src = code(read('components/report/BuyerReportContent.tsx'))
    expect(src).not.toMatch(/memang harga pasaran sekarang/)
    expect(src).not.toMatch(/harga tengah pasaran sekarang RM\$\{/)
  })

  it('the methodology line still states the sample size', () => {
    // The correction narrows the CLAIM, never hides the evidence. A buyer must
    // still be able to see how many adverts the judgement rests on.
    const src = read('components/report/BuyerReportContent.tsx')
    expect(src).toMatch(/Berdasarkan \$\{mPrices\.length\} iklan setanding yang kami jumpa/)
  })
})
