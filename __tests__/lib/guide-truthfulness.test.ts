import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { VARIANT_GUIDES } from '@/lib/variant-guides'
import { PAGE_REVISED } from '@/lib/seo/editorial-dates'

const ROOT = join(__dirname, '..', '..')
const FAQ  = join(ROOT, 'app', 'faq')

const GUIDES = readdirSync(FAQ, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)

/**
 * Strip comments before asserting on copy.
 *
 * Load-bearing, and learned the hard way four times in one session: the fix
 * for a bad line of copy is usually a comment ABOVE it quoting the bad line so
 * the next person knows why it changed. A naive substring search then finds
 * the phrase in the explanation of its own removal and fails.
 */
const copy = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/(^|[^:])\/\/.*$/gm, '$1')

const read = (slug: string) => copy(readFileSync(join(FAQ, slug, 'page.tsx'), 'utf8'))

describe('the guides do not sell a product Paqar retired', () => {
  /**
   * All eight guides ended with one shared component advertising, in English,
   * an instant valuation keyed on a plate number. Paqar sells one car, read by
   * a person, within a stated SLA — and the plate has been optional since
   * migration 032, so a buyer arriving from a guide went looking for a field
   * that is not on the homepage.
   *
   * The CTA is one file, which is why this was eight live pages wrong for
   * months and a single edit to fix.
   */
  const cta = copy(readFileSync(join(ROOT, 'components/faq/FaqGetValuationCta.tsx'), 'utf8'))

  it('the shared CTA does not promise an instant valuation', () => {
    expect(cta).not.toMatch(/instant valuation/i)
    expect(cta).not.toMatch(/Check a Car Now/i)
    expect(cta).not.toMatch(/Enter a plate number/i)
  })

  it('and asks for the thing the homepage actually accepts', () => {
    expect(cta).toContain('link iklan')
  })

  it('every guide renders it, so none can drift on its own', () => {
    for (const slug of GUIDES) {
      expect(read(slug), `${slug} lost the shared CTA`).toContain('FaqGetValuationCta')
    }
  })
})

describe('the guides do not contradict Paqar itself', () => {
  /**
   * Honda Malaysia never sold a City "H". The line is S, E and V — which
   * Paqar's OWN variant guide has correct at lib/variant-guides.ts. The FAQ
   * guide asserted a different lineup, and different generation numbers, for
   * the same cars: /varian/honda-city said Generasi 5/6/7 while the FAQ guide
   * said 1/2/3.
   */
  it('the City guide names no variant Honda did not sell', () => {
    const g = read('honda-city-buying-guide')
    expect(g, 'the invented City "H" variant is back').not.toMatch(/City 1\.5 H|1\.5 H \(/)
    expect(g).not.toMatch(/Perbandingan Varian: S vs H/)
  })

  it('and renders generations from the same source /varian does', () => {
    const g = read('honda-city-buying-guide')
    expect(g).toContain('VARIANT_GUIDES')
    // A hand-written generation heading is how the two pages diverged before.
    expect(g).not.toMatch(/Generasi 1: 2008/)
  })

  it('the variant source still has the City, since the page asserts it', () => {
    const city = VARIANT_GUIDES['honda-city']
    expect(city).toBeTruthy()
    const names = city!.generations.flatMap(gen => gen.variants.map(v => v.name))
    expect(names.join(' ')).not.toMatch(/\bH\b/)
  })

  it('no guide numbers generations in a scheme that disagrees with another', () => {
    // The Vios guide counted 1/2/3 for cars the City guide counts 5/6/7. Year
    // ranges cannot be off by one, so that is what the Vios guide uses now.
    const vios = read('toyota-vios-buying-guide')
    expect(vios).not.toMatch(/Gen [123]:/)
    /**
     * ── AND NOT IN THE STRUCTURED DATA EITHER ──────────────────────────────
     *
     * The assertion above only ever looked at the heading form, `Gen 1:`. The
     * page body was duly rewritten to year ranges — and the FAQPage answer
     * went on saying "Generasi 2 (2013–2018) paling berbaloi … Generasi 1
     * (2007–2013) elok dielak", which is the discarded numbering, on the
     * discarded boundaries (the body says 2013–2019), inside the one part of
     * the page Google can lift and attribute to Paqar as an answer.
     *
     * A guard that checks the visible copy and not the schema checks the half
     * a reader can already see is wrong.
     */
    expect(vios, 'generation numbering is back, in the schema').not.toMatch(/Generasi [123]\b/)
  })

  it('the Vios schema does not price advice the page never gives', () => {
    // The same answer told buyers to avoid the oldest Vios "unless your budget
    // is under RM12,000" — a threshold, and a recommendation, that appear
    // nowhere on the page. The body says take it if the budget is tight and
    // the service record is there.
    expect(read('toyota-vios-buying-guide')).not.toMatch(/elok dielak kecuali bajet/)
  })
})

describe('the guides declare that they were revised', () => {
  /**
   * All eight were fact-corrected on 2026-08-27. Each emitted a bare FAQPage
   * and nothing else — no Article, so no `dateModified`, so nothing anywhere
   * said the correction had happened. That is both a ranking signal thrown
   * away and, here, simply true.
   */
  it('every guide builds its schema from the shared builder', () => {
    for (const slug of GUIDES) {
      expect(read(slug), `${slug} hand-rolls its own schema again`).toContain('guideSchema(')
    }
  })

  it('and the builder emits a revision date for each of them', () => {
    for (const slug of GUIDES) {
      expect(PAGE_REVISED[`/faq/${slug}`], `${slug} has no revision date`).toBeTruthy()
    }
  })
})

describe('the guides do not invent government fees', () => {
  /**
   * The road-tax guide published a four-column table of invented rates for
   * Selangor, Johor, Pulau Pinang and Kedah, and stated that road tax is a
   * state tax. It is federal, and the schedule has two regions: Peninsular
   * Malaysia, and Sabah/Sarawak.
   */
  const rt = read('roadtax-by-state')

  it('does not price road tax per Peninsular state', () => {
    expect(rt).not.toMatch(/Selangor\/KL/)
    expect(rt, 'a per-state rate column is back').not.toMatch(/<th[^>]*>Johor<\/th>/)
  })

  it('does not call it a state tax', () => {
    expect(rt).not.toMatch(/cukai negeri, bukan cukai persekutuan/)
  })

  it('quotes the rate that can be checked against cars people own', () => {
    // Axia 1.0 = RM20 and a 1.5 saloon = RM90 are the two figures every
    // Malaysian driver can falsify from their own windscreen.
    expect(rt).toContain('RM90')
    expect(rt).toContain('RM20')
  })

  it('sends the buyer to JPJ for the authoritative figure', () => {
    expect(rt).toMatch(/jpj\.gov\.my|MyJPJ/)
  })
})

describe('the guides do not state unmeasured facts as measured', () => {
  it('no guide claims a lifespan in kilometres', () => {
    const offenders = GUIDES.filter(s => /\b[45]00k\+? km/.test(read(s)))
    expect(offenders, `invented lifespan in: ${offenders.join(', ')}`).toEqual([])
  })

  it('no guide claims one model outlasts another by a distance', () => {
    const offenders = GUIDES.filter(s => /100,000 km lagi|100k km lagi/.test(read(s)))
    expect(offenders, `unsupported longevity claim in: ${offenders.join(', ')}`).toEqual([])
  })

  it('no guide states a fixed minimum down payment', () => {
    // Financing margin is set by the bank against the car's age and valuation.
    // "You need at least 40%" was wrong in both directions.
    const offenders = GUIDES.filter(s => /sekurang-kurangnya \d+% bayaran pendahuluan/.test(read(s)))
    expect(offenders, `fixed down payment in: ${offenders.join(', ')}`).toEqual([])
  })

  it('the two City-vs-Vios surfaces agree about resale', () => {
    // /bandingkan said Vios holds value better; the FAQ guide said City did.
    // Same two cars, opposite answers, both live.
    const faq = read('honda-city-vs-toyota-vios')
    expect(faq, 'the FAQ guide claims City resale again').not.toMatch(/Honda City menang dari segi ciri dan nilai jual semula/)
  })
})
