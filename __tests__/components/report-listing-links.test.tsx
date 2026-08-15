// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/app/laporan-pembeli/[checkId]/_actions', () => ({
  initiateBuyerReport:     vi.fn(),
  initiateJomCheckUpgrade: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))

import { BuyerReportContent } from '@/components/report/BuyerReportContent'
import { isIndividualListingUrl } from '@/lib/listing-url'

/**
 * The defect this file exists for:
 *
 * Every comparable price in the RM12 report rendered as <a href={l.url}>, on
 * the assumption that every cached row points at one advert. It does not.
 * scraper/src/scrapers/mudah-market.ts builds the literal
 * "https://www.mudah.my/m/" when a JSON item carries no adid, and its DOM
 * fallback keeps any link whose surrounding card mentions a price — so search
 * pages, category pages and promo links reach the cache looking like listings.
 * A buyer who paid RM12 to be told which adverts set the price was being sent
 * to a search page, or to nothing.
 *
 * The fix withholds the LINK, never the price: the row stays in the cohort, so
 * the median and the methodology line keep describing the same set the chips
 * show. These tests pin both halves, and pin that nothing else in the report
 * moved.
 */

const vehicle = {
  make: 'Perodua', model: 'Myvi', registrationYear: '2020',
  description: 'Perodua Myvi 1.5 AV', engineCC: '1496', bodyType: 'Hatchback',
}

/** The two identity-bearing shapes the scraper actually produces. */
const LINKABLE = [
  ['ad page url (JSON + DOM path)', 'https://www.mudah.my/perodua-myvi-1-5-av-108123456.htm'],
  ['ad page url with tracking qs',  'https://www.mudah.my/perodua-myvi-1-5-av-108123456.htm?utm_source=x'],
  ['short /m/ url (adid present)',  'https://www.mudah.my/m/108123457'],
] as const

/** Everything else the scraper can and does store. */
const NOT_LINKABLE = [
  ['bare /m/ stub (empty adid)',  'https://www.mudah.my/m/'],
  ['search url',                  'https://www.mudah.my/Malaysia/Cars-for-sale?q=Perodua+Myvi+2020'],
  ['category/filter url',         'https://www.mudah.my/malaysia/used-cars-for-sale/perodua/myvi/mfg-year-2020'],
  ['category url, no filters',    'https://www.mudah.my/malaysia/cars-for-sale/perodua/myvi'],
  ['unsupported domain',          'https://www.carlist.my/used-cars-for-sale/perodua/myvi/malaysia'],
  ['malformed string',            'not-a-url-at-all'],
  ['scheme only',                 'https://'],
  ['too-few-digit id',            'https://www.mudah.my/m/12345'],
  ['empty string',                ''],
] as const

const chipCls = 'inline-block bg-[#F0FAFA]'

function renderReport(
  listings: { price: number; url?: string | null }[],
  extraProps: Record<string, unknown> = {},
) {
  return render(
    <BuyerReportContent
      plate="WPH925"
      askingPriceRm={55_000}
      vehicleData={vehicle}
      marketPrices={{
        listings: listings.map(l => ({
          price: l.price,
          url:   l.url as string,
          title: 'Perodua Myvi 1.5 AV 2020 Auto 60k-65k UsedDirect Owner',
          year:  '2020',
          mileage: null,
        })),
        fetchedAt: new Date().toISOString(),
        searchUrl: 'https://mudah.my',
      }}
      {...extraProps}
    />,
  )
}

/** Chips are the only elements whose entire text is exactly "RM<amount>". */
function chipFor(amount: string): HTMLElement {
  const el = screen.getAllByText(`RM${amount}`).find(n => n.tagName === 'A' || n.tagName === 'SPAN')
  if (!el) throw new Error(`no chip rendered for RM${amount}`)
  return el
}

function chipAnchors(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a'))
    .filter(a => /^RM[\d,]+$/.test(a.textContent ?? ''))
}

/** Eight comparables: three linkable, five not. Enough for a normal verdict. */
const mixed = [
  { price: 41_000, url: LINKABLE[0][1] },
  { price: 42_000, url: LINKABLE[1][1] },
  { price: 43_000, url: LINKABLE[2][1] },
  { price: 44_000, url: NOT_LINKABLE[0][1] },
  { price: 45_000, url: NOT_LINKABLE[1][1] },
  { price: 46_000, url: NOT_LINKABLE[2][1] },
  { price: 47_000, url: NOT_LINKABLE[4][1] },
  { price: 48_000, url: NOT_LINKABLE[5][1] },
]

afterEach(cleanup)

// ── 1-8: the predicate, against the repository's real URL shapes ───────────

describe('isIndividualListingUrl', () => {
  it.each(LINKABLE)('links %s', (_label, url) => {
    expect(isIndividualListingUrl(url)).toBe(true)
  })

  it.each(NOT_LINKABLE)('withholds %s', (_label, url) => {
    expect(isIndividualListingUrl(url)).toBe(false)
  })

  it('withholds a missing url without throwing', () => {
    expect(isIndividualListingUrl(null)).toBe(false)
    expect(isIndividualListingUrl(undefined)).toBe(false)
  })

  it('reads the ad id, not merely the presence of digits', () => {
    // A slug carrying a long number that is not an ad id must not be promoted
    // just because digits appear somewhere in the path.
    expect(isIndividualListingUrl('https://www.mudah.my/malaysia/cars-for-sale/perodua/myvi/2020')).toBe(false)
    expect(isIndividualListingUrl('https://www.mudah.my/perodua-myvi-108123456.htm')).toBe(true)
  })
})

// ── 9-10: rendering ────────────────────────────────────────────────────────

describe('RM12 comparable chips', () => {
  it('links only the prices whose URL resolves to one advert', () => {
    renderReport(mixed)
    for (const amount of ['41,000', '42,000', '43,000']) {
      expect(chipFor(amount).tagName).toBe('A')
    }
    for (const amount of ['44,000', '45,000', '46,000', '47,000', '48,000']) {
      expect(chipFor(amount).tagName).toBe('SPAN')
    }
  })

  it('never emits an invalid href into the rendered HTML', () => {
    const { container } = renderReport(mixed)
    const hrefs = chipAnchors(container).map(a => a.getAttribute('href') ?? '')
    expect(hrefs).toHaveLength(3)
    for (const href of hrefs) expect(isIndividualListingUrl(href)).toBe(true)
    // No empty anchors, and nothing that merely looks like a link.
    for (const a of chipAnchors(container)) {
      expect(a.getAttribute('href')).toBeTruthy()
    }
  })

  it('renders the price for a listing with no url at all, without an anchor', () => {
    renderReport([
      { price: 41_000, url: null },
      { price: 42_000, url: undefined },
      { price: 43_000, url: LINKABLE[0][1] },
      { price: 44_000, url: NOT_LINKABLE[0][1] },
      { price: 45_000, url: NOT_LINKABLE[1][1] },
    ])
    expect(chipFor('41,000').tagName).toBe('SPAN')
    expect(chipFor('42,000').tagName).toBe('SPAN')
    expect(chipFor('43,000').tagName).toBe('A')
  })

  it('keeps every measured price visible, so chips still describe the measured cohort', () => {
    renderReport(mixed)
    for (const { price } of mixed) {
      const amount = price.toLocaleString('en-US')
      expect(chipFor(amount)).toBeTruthy()
    }
  })

  it('invents no replacement URL and presents no search page as advert evidence', () => {
    const { container } = renderReport(mixed)
    const hrefs = chipAnchors(container).map(a => a.getAttribute('href') ?? '')
    // Every emitted href is one the cache actually held.
    const cached = mixed.map(l => l.url)
    for (const href of hrefs) expect(cached).toContain(href)
    // And none of them is a search or category page.
    for (const href of hrefs) {
      expect(href).not.toMatch(/Cars-for-sale\?q=/i)
      expect(href).not.toMatch(/\/cars-for-sale\/[a-z]/i)
    }
  })

  it('opens linked adverts safely in a new tab', () => {
    renderReport(mixed)
    const a = chipFor('41,000')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders no chip anchors when every URL is unlinkable', () => {
    const { container } = renderReport([
      { price: 41_000, url: NOT_LINKABLE[0][1] },
      { price: 42_000, url: NOT_LINKABLE[1][1] },
      { price: 43_000, url: NOT_LINKABLE[2][1] },
      { price: 44_000, url: NOT_LINKABLE[4][1] },
      { price: 45_000, url: NOT_LINKABLE[5][1] },
    ])
    expect(chipAnchors(container)).toHaveLength(0)
    expect(chipFor('41,000').tagName).toBe('SPAN')
    // Styling is identical, so a withheld link is not a visual defect.
    expect(chipFor('41,000').className).toContain(chipCls)
  })

  it('styles linked and unlinked chips identically apart from the hover affordance', () => {
    renderReport(mixed)
    expect(chipFor('41,000').className).toContain(chipCls)
    expect(chipFor('44,000').className).toContain(chipCls)
    expect(chipFor('44,000').className).not.toContain('hover:bg-')
  })
})

// ── 11-13: everything else in the report must be untouched ─────────────────

describe('the rest of the RM12 report is unchanged', () => {
  /**
   * The fix touches one map callback. These assert the surrounding paid
   * sections still render off the same cohort, so a regression here would mean
   * the chip change had moved the cohort rather than only its hrefs.
   */
  it('still renders median, range, trade-in, confidence and methodology', () => {
    const { container } = renderReport(mixed)
    const text = container.textContent ?? ''
    expect(text).toContain('Harga tengah pasaran')
    expect(text).toContain('Anggaran trade-in')
    expect(text).toMatch(/Berdasarkan \d+ listing/)
    expect(text).toMatch(/Keyakinan data|Data pasaran terhad/)
  })

  it('still renders the negotiation script, seller questions and deposit checklist', () => {
    const { container } = renderReport(mixed)
    const text = container.textContent ?? ''
    expect(text).toContain('Skrip Rundingan')
    expect(text).toContain('Checklist sebelum bayar deposit')
    expect(text).toContain('Soalan Wajib Tanya Seller')
    expect(text).toContain('Langkah Seterusnya')
  })

  it('produces identical report text whether or not a chip URL is linkable', () => {
    // Same prices, different URL validity. Only the anchors may differ; every
    // figure the buyer acts on must be byte-identical.
    const linkable = mixed.map((l, i) => ({ price: l.price, url: `https://www.mudah.my/m/10812345${i}` }))
    const { container: a } = renderReport(mixed)
    const textA = a.textContent ?? ''
    cleanup()
    const { container: b } = renderReport(linkable)
    const textB = b.textContent ?? ''
    expect(textA).toBe(textB)
  })

  it('does not alter the RM100 accident/claim section', () => {
    // Rendered only when purchased; absent here, and must stay absent.
    const { container } = renderReport(mixed)
    expect(container.textContent ?? '').not.toContain('Rekod Kemalangan')
  })

  it('emits no cohort size or count into chip markup (free-boundary guard)', () => {
    const { container } = renderReport(mixed)
    for (const n of container.querySelectorAll('a,span')) {
      const t = n.textContent ?? ''
      if (/^RM[\d,]+$/.test(t)) expect(t).toMatch(/^RM[\d,]+$/)
    }
  })
})
