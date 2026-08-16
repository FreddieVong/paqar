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
  // The paywall pitch. Added after production QA found it still saying
  // "Maklumat kenderaan (JPJ)" — the same claim, on the one surface the first
  // sweep missed, and the surface a buyer reads immediately before paying.
  'components/report/BuyerReportPitch.tsx',
  // The homepage carries the same feature list.
  'app/page.tsx',
]

describe('provenance is never attributed to JPJ', () => {
  it.each(CLAIM_SURFACES)('%s does not claim JPJ as the data source', (path) => {
    const src = code(read(path))
    expect(src).not.toMatch(/Sumber:\s*JPJ/)
    // Also catches the paywall's "Maklumat kenderaan (JPJ)" phrasing.
    expect(src).not.toMatch(/kenderaan\s*\(JPJ\)/)
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

/**
 * THE HOMEPAGE PROOF BEAT
 *
 * The homepage shows a sample price result immediately after the plate form.
 * It sits beside a "Semakan harga percuma" hero, which is what makes the
 * labelling load-bearing: an unlabelled range and gap invite the reader to
 * conclude the FREE check returns them. It does not.
 *
 * Source-level, like the guards above, because the wording is now shared
 * between the homepage and /contoh-laporan through one component.
 */
describe('the homepage proof beat', () => {
  const page = () => read('app/page.tsx')
  const card = () => read('components/report/SampleVerdictCard.tsx')

  it('names the paid tier that the sample figures come from', () => {
    // Every numeric market figure in the beat is Laporan Pembeli evidence.
    expect(card()).toContain('Contoh daripada Laporan Pembeli RM12')
    expect(page()).toMatch(/<SampleVerdictCard\s+showTierLabel/)
  })

  it('marks the sample as illustrative, not a real vehicle', () => {
    expect(card()).toContain('Data contoh — bukan kereta sebenar.')
    expect(page()).toContain('SAMPLE_DISCLAIMER')
  })

  it('conditions the history row on a record existing', () => {
    // Not every accident produces a claim record, and no odometer reading is
    // guaranteed to have been logged. "jika direkodkan" is the whole claim.
    expect(code(page())).toContain('jika direkodkan')
  })

  it('states the total, not only the increment', () => {
    // "+RM88" alone leaves the buyer to work out what they would actually pay.
    expect(page()).toContain('jumlah RM100')
  })

  it('does not call the comparable range "the market"', () => {
    // The range is asking prices: capped, one site, up to CACHE_TTL_DAYS old.
    // The same overclaim was removed from the verdict lines and the paid CTAs;
    // it survived in the sample because the sample was not in that sweep.
    for (const src of [code(card()), code(read('components/report/SampleReportPreview.tsx'))]) {
      expect(src).not.toContain('Market semasa')
      expect(src).not.toMatch(/harga pasaran (semasa|sebenar)/)
    }
    expect(card()).toContain('Julat iklan setanding')
  })

  it('renders the proof beat directly after the form, before the product cards', () => {
    // Placement IS the design: the beat only works if it is the first thing a
    // buyer scrolls to. Below the product cards it is the old link again.
    const src = page()
    const form  = src.indexOf('<HomeCheckerTabs')
    const beat  = src.indexOf('<SampleVerdictCard')
    const cards = src.indexOf('{/* Free price check card */}')
    expect(form).toBeGreaterThan(-1)
    expect(beat).toBeGreaterThan(form)
    expect(beat).toBeLessThan(cards)
  })

  it('does not render the sample verdict card twice on expansion', () => {
    // The beat already shows the card; the expander below it must not repeat it.
    expect(page()).toMatch(/<CollapsibleSampleReport[^>]*showVerdictCard=\{false\}/)
  })

  it('distinguishes a homepage sample open from a paywall one', () => {
    expect(page()).toMatch(/<CollapsibleSampleReport[^>]*source="homepage_proof"/)
  })

  it('no longer repeats the how-it-works strip the beat replaced', () => {
    const tabs = code(read('components/check/HomeCheckerTabs.tsx'))
    expect(tabs).not.toContain('showSteps')
    expect(tabs).not.toContain('Dapat keputusan harga serta-merta')
  })
})

describe('a plus sign means the add-on, never the total', () => {
  /**
   * The claim check costs RM88 on top of the RM12 report; RM100 is the TOTAL.
   * So "+ ... RM100" states the sum as if it were the increment, and a buyer
   * reading the sample's tabs would price the bundle at RM112.
   *
   * Every other surface already has this right — JomCheckUpsell, PaymentForm,
   * the receipt email and the landing page all say "+RM88", and the pages that
   * show RM100 show it without a plus. Only the sample's tab disagreed.
   */
  const SURFACES = [
    'components/report/SampleReportPreview.tsx',
    'components/report/JomCheckUpsell.tsx',
    'components/report/PaymentForm.tsx',
    'app/page.tsx',
  ]

  it.each(SURFACES)('%s never prefixes the bundle total with a plus', (path) => {
    expect(code(read(path))).not.toMatch(/\+\s*Accident\/Claim\s*(Insurans\s*)?RM100/)
  })

  it('the sample tab charges the add-on price', () => {
    const src = read('components/report/SampleReportPreview.tsx')
    expect(src).toContain("'+ Accident/Claim RM88'")
  })

  it('the sample still states the total somewhere the tab is selected', () => {
    // Naming only the increment leaves RM12 + RM88 as the buyer's arithmetic.
    expect(read('components/report/SampleReportPreview.tsx')).toContain('jumlah RM100')
  })
})

/**
 * THE HOMEPAGE FAQ HAS ONE SOURCE
 *
 * The page rendered four questions while FAQPage emitted seven. Google's
 * FAQPage guidance requires the question and answer content to be visible on
 * the page, so three of them were structured data describing content no
 * visitor could read — including the limitations answer, which is the most
 * important thing Paqar tells a buyer.
 *
 * Source-level, because a rendering test would prove the accordion is right
 * without proving the JSON-LD comes from the same place.
 */
describe('the homepage FAQ', () => {
  const page = () => code(read('app/page.tsx'))
  const faq  = () => read('lib/faq/home.ts')

  it('drives both the accordion and the structured data from one import', () => {
    const src = page()
    expect(src).toContain("from '@/lib/faq/home'")
    expect(src).toContain('mainEntity: faqMainEntity()')
    expect(src).toContain('{HOME_FAQ.map((faq) => (')
  })

  it('leaves no hand-written Question nodes to drift', () => {
    expect(page()).not.toMatch(/'@type':\s*'Question'/)
  })

  it('makes the limitations answer visible, not crawler-only', () => {
    const src = faq()
    expect(src).toContain('Apakah had atau limitasi Paqar?')
    expect(src).toContain('Paqar tidak mengesahkan bacaan odometer sebenar.')
  })

  it('never frames a missing claim record as proof of a clean car', () => {
    expect(faq()).toContain('Tiada rekod tuntutan bukan bukti bahawa kereta bebas kemalangan.')
  })

  it('states that RM12 excludes claim and odometer history', () => {
    // A locked RM88 history row sits a few centimetres above this answer in
    // the proof beat. The exclusion has to be said, not implied by omission.
    expect(faq()).toMatch(/RM12 tidak termasuk rekod tuntutan kemalangan atau bacaan odometer/)
  })

  it('does not describe the RM12 figures as the whole market', () => {
    expect(faq()).not.toContain('angka pasaran penuh')
    expect(faq()).toContain('angka berdasarkan iklan setanding')
  })
})

describe('structured data claims only what the site does', () => {
  const page = () => read('app/page.tsx')

  it('publishes no SearchAction, because there is no search', () => {
    // The removed one pointed at /?q=, which nothing reads.
    expect(page()).not.toContain('SearchAction')
    expect(page()).not.toContain('potentialAction')
    expect(page()).not.toContain('search_term_string')
  })

  it('keeps the RM12 Offer and adds no RM100 one', () => {
    expect(page()).toContain("price: '12'")
    expect(page()).not.toContain("price: '100'")
  })
})

describe('the hero still sells only the free outcome it can deliver', () => {
  const page = () => read('app/page.tsx')

  it('names each price beside what it buys', () => {
    expect(page()).toContain('Semakan harga percuma · Laporan pembeli RM12 · Rekod tuntutan +RM88')
  })

  it('leads the plate journey with the free outcome', () => {
    expect(read('components/check/PlateCheckerForm.tsx')).toContain('Semak Harga Percuma →')
  })

  it('asks for a price in both journeys with the same words', () => {
    for (const p of ['components/check/PlateCheckerForm.tsx', 'components/check/DualCheckForm.tsx']) {
      expect(read(p)).toContain('Harga yang penjual minta')
    }
  })
})
