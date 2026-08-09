// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Editorial pages may carry guide prices. They may not claim those prices are
 * current, and they may not contradict themselves.
 *
 * /faq/best-first-car-under-30k headed its price table "Harga Pasaran Sebenar
 * (Julai 2026)" and introduced it as "harga pasaran berdasarkan listing
 * sebenar". Neither was true: Myvi 2018, City 2016 and Vios 2013 are all
 * outside MARKET_COVERAGE, so no cohort has ever produced a figure for them —
 * the numbers were authored, and the month was a hand-typed stamp that could
 * only be right on the day someone remembered to change it. It read July while
 * the content had not moved for longer.
 *
 * The page also disagreed with itself: the model cards said City
 * RM25,000–RM32,000 and Vios RM22,000–RM30,000, while its own table two
 * sections down said RM25–30k and RM22–26k for the same cars.
 *
 * Guide prices are legitimate and useful here — this guards the CLAIMS around
 * them, not the numbers.
 */

const ROOT = join(__dirname, '..', '..')
const FAQ  = join(ROOT, 'app', 'faq')

function faqPages(): { slug: string; src: string }[] {
  return readdirSync(FAQ)
    .filter(e => statSync(join(FAQ, e)).isDirectory() && existsSync(join(FAQ, e, 'page.tsx')))
    .map(slug => ({ slug, src: readFileSync(join(FAQ, slug, 'page.tsx'), 'utf-8') }))
}

const PAGES = faqPages()
const MONTHS_MS = 'Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember'

describe('editorial pages make no decaying freshness claim', () => {
  it('finds the FAQ guides', () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(8)
  })

  it.each(PAGES.map(p => p.slug))('%s stamps no hand-typed month/year', (slug) => {
    const { src } = PAGES.find(p => p.slug === slug)!
    const stamps = src.match(new RegExp(`(?:Dikemas ?kini|Kemas ?kini)[^<'"]{0,20}(?:${MONTHS_MS})\\s*\\d{4}`, 'gi')) ?? []
    expect(stamps, `unmaintained freshness stamp: ${stamps.join(', ')}`).toEqual([])
  })

  it.each(PAGES.map(p => p.slug))('%s heads no price block with a month/year', (slug) => {
    const { src } = PAGES.find(p => p.slug === slug)!
    const headings = src.match(new RegExp(`Harga[^<]{0,40}\\((?:${MONTHS_MS})\\s*\\d{4}\\)`, 'gi')) ?? []
    expect(headings, `dated price heading: ${headings.join(', ')}`).toEqual([])
  })
})

describe('editorial guide prices are not presented as computed market data', () => {
  it.each(PAGES.map(p => p.slug))('%s does not call an authored figure a market price', (slug) => {
    const { src } = PAGES.find(p => p.slug === slug)!
    // "Harga Pasaran Sebenar" as a HEADING over authored numbers is the claim
    // that must not return. Prose telling a reader to go and check the real
    // market price is the opposite of the problem, so it stays allowed.
    expect(src).not.toMatch(/>\s*Harga Pasaran Sebenar/i)
    expect(src).not.toMatch(/harga pasaran<\/strong> berdasarkan listing sebenar/i)
  })
})

describe('the first-car guide agrees with itself', () => {
  const src = PAGES.find(p => p.slug === 'best-first-car-under-30k')!.src

  /** Every RMx,xxx–RMy,yyy or RMxx–yyk range on the page, normalised to thousands. */
  function ranges(text: string): [number, number][] {
    const out: [number, number][] = []
    for (const m of text.matchAll(/RM(\d{1,3}(?:,\d{3})?)(?:,000)?\s*[–-]\s*RM?(\d{1,3}(?:,\d{3})?)k?/g)) {
      const norm = (v: string) => {
        const n = Number(v.replace(/,/g, ''))
        return n >= 1000 ? Math.round(n / 1000) : n
      }
      out.push([norm(m[1]!), norm(m[2]!)])
    }
    return out
  }

  it('states one range per car, not two that disagree', () => {
    // Group by the low end: the same car described twice must give the same
    // pair. Before the fix, City appeared as 25–32 and 25–30, Vios as 22–30
    // and 22–26.
    const byLow = new Map<number, Set<string>>()
    for (const [lo, hi] of ranges(src)) {
      if (!byLow.has(lo)) byLow.set(lo, new Set())
      byLow.get(lo)!.add(`${lo}-${hi}`)
    }
    const conflicting = [...byLow.entries()]
      .filter(([, set]) => set.size > 1)
      .map(([lo, set]) => `RM${lo}k: ${[...set].join(' vs ')}`)
    expect(conflicting, `the page gives one car two different ranges: ${conflicting.join(' | ')}`).toEqual([])
  })

  it('still shows guide prices — the numbers are useful, the claim was not', () => {
    expect(ranges(src).length).toBeGreaterThanOrEqual(3)
  })
})
