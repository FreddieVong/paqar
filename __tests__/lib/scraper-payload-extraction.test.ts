import { describe, it, expect } from 'vitest'
import { extractFromHtml, parseMileage } from '@/lib/listing-extract'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What the deployed scraper returns must survive the trip into the extractor.
 *
 * Both defects below were invisible until a real Mudah advert was pushed
 * through the real service end to end. Neither is a parsing bug in the
 * extractor — it handled the same text perfectly when handed it directly.
 */

describe('the page text is not shadowed by the site’s own description', () => {
  /**
   * lib/listing-scraper rebuilds a minimal document from the scraper payload,
   * and lib/listing-extract's meta() returns the FIRST match for a key. The
   * site's tags were emitted first and the page text appended after as a
   * SECOND og:description, so on every site that publishes one of its own —
   * which is most of them — the page text was never read.
   *
   * Measured on a real advert: brand, model and price came through from the
   * curated description while the year sitting twelve words later in the page
   * text came back missing. Year is required for coverage, so the buyer was
   * asked to type in details Paqar already had.
   */
  const src = readFileSync(join(__dirname, '..', '..', 'lib/listing-scraper.ts'), 'utf8')

  it('emits exactly one og:description', () => {
    const emitted = src.match(/og:description/g) ?? []
    // One in the filter that removes the site's, one in the tag that replaces
    // it, one in the variable that carries it. Never two <meta> tags.
    expect(src).toContain("k.toLowerCase() !== 'og:description'")
    expect(emitted.length).toBeGreaterThan(0)
  })

  it('merges the site description with the page text rather than dropping either', () => {
    expect(src).toContain('const siteDescription')
    expect(src).toMatch(/\$\{siteDescription\}\s*\$\{\(payload\.text/)
  })

  it('a second og:description would still be shadowed — proving the ordering matters', () => {
    // Guards the reasoning, not just the code: if meta() ever became
    // last-wins, this fails and the merge can be simplified.
    const html = '<html><head>'
      + '<meta property="og:description" content="Honda City for sale">'
      + '<meta property="og:description" content="Honda City 2015 RM 28,500">'
      + '</head></html>'
    expect(extractFromHtml(html).year.value, 'meta() is no longer first-wins').toBeNull()
  })

  it('and the merged form finds what the shadowed form missed', () => {
    const html = '<html><head><title>Honda CITY 1.5 IVTEC V SPEC</title>'
      + '<meta property="og:description" content="Honda City in Cars in Malaysia on Mudah.my.'
      + ' RM 28,500 Honda CITY 1.5 IVTEC V SPEC 2015 Auto 100k - 109k Kuala Lumpur">'
      + '</head></html>'
    const out = extractFromHtml(html)
    expect(out.brand.value).toBe('Honda')
    expect(out.model.value).toBe('City')
    expect(out.year.value).toBe('2015')
    expect(out.askingPriceRm.value).toBe(28_500)
  })
})

describe('Mudah states mileage as a band, not a figure', () => {
  it('reads "100k - 109k" as its midpoint', () => {
    // The format on essentially every Mudah advert, and nothing matched it —
    // so the commonest Malaysian listing format returned null while the rare
    // exact-figure case was handled.
    expect(parseMileage('2015 Auto 100k - 109k Kuala Lumpur')).toBe(104_500)
  })

  it('accepts the dash characters a listing actually uses', () => {
    for (const dash of ['-', '–', '—']) {
      expect(parseMileage(`80k ${dash} 89k`), `dash ${dash}`).toBe(84_500)
    }
  })

  it('takes the midpoint, not an end — neither party gets the benefit', () => {
    // Rounding down flatters the seller on the one number a buyer uses to
    // judge wear; rounding up manufactures a concern the advert never made.
    const v = parseMileage('100k - 109k')!
    expect(v).toBeGreaterThan(100_000)
    expect(v).toBeLessThan(109_000)
  })

  it('still reads an exact figure when one is given', () => {
    expect(parseMileage('68,000 km')).toBe(68_000)
    expect(parseMileage('120k km')).toBe(120_000)
  })

  it('rejects a band whose ends are the wrong way round', () => {
    // A reversed band is a parse gone wrong, not a car. The 1.5M ceiling in
    // the same guard is unreachable for THIS pattern — \d{1,3} caps it at
    // 999k — and is kept only so a wider pattern later cannot slip past it.
    expect(parseMileage('109k - 100k')).toBeNull()
  })

  it('accepts a genuinely high band rather than second-guessing the advert', () => {
    // 949,500 km is a lot and entirely possible on a commercial vehicle.
    // Refusing it would be Paqar overruling what the seller stated.
    expect(parseMileage('900k - 999k')).toBe(949_500)
  })
})
