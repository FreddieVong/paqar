// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// A transitive import reaches lib/db, which is marked server-only. The report
// itself is a pure render given its props, so the guard is stubbed rather than
// the component being restructured.
vi.mock('server-only', () => ({}))
// JomCheckUpsell imports the Billplz server actions, which validate the full
// server env at module load. Not needed to render a report.
vi.mock('@/app/laporan-pembeli/[checkId]/_actions', () => ({
  initiateBuyerReport:     vi.fn(),
  initiateJomCheckUpgrade: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))

import { BuyerReportContent } from '@/components/report/BuyerReportContent'

/**
 * The defect this file exists for:
 *
 * `marketMedian` was nulled at count < 2 to mean "not enough data", while
 * `hasMarketData` checked only min/max — which a single listing supplies. The
 * verdict rendered anyway, the median was non-null-asserted, and because
 * Math.round(null) === 0 every median-derived figure formatted as RM0 —
 * including inside the WhatsApp script the buyer pastes to a seller.
 */

const vehicle = {
  make: 'Perodua', model: 'Myvi', registrationYear: '2020',
  description: 'Perodua Myvi 1.5 AV', engineCC: '1496', bodyType: 'Hatchback',
}

const marketPrices = (prices: number[]) => ({
  listings: prices.map((price, i) => ({
    price, title: `Perodua Myvi 1.5 AV ${i}`, url: `https://mudah.my/m/${i}`,
    year: '2020', mileage: null,
  })),
  fetchedAt: new Date().toISOString(),
  searchUrl: 'https://mudah.my',
})

/** Same fixture plus NVIC new-price data, so depreciation context is available. */
const renderWithNewPrice = (prices: number[], askingPriceRm: number | null = 55_000) =>
  render(
    <BuyerReportContent
      plate="WPH925"
      askingPriceRm={askingPriceRm}
      vehicleData={{ ...vehicle, valuation: { wmNewPrice: '58000', familyFloorNewPrice: '55000' } }}
      marketPrices={marketPrices(prices)}
    />,
  )

const renderReport = (prices: number[], askingPriceRm: number | null = 55_000) =>
  render(
    <BuyerReportContent
      plate="WPH925"
      askingPriceRm={askingPriceRm}
      vehicleData={vehicle}
      marketPrices={marketPrices(prices)}
    />,
  )

/** Currency amounts that came out as exactly RM0 / RM0,000 etc. */
const zeroCurrency = (text: string) => text.match(/RM\s?0(?![\d,.])/g) ?? []

afterEach(cleanup)

describe('one-listing cohort', () => {
  it('renders no RM0 anywhere on the page', () => {
    const { container } = renderReport([45_000])
    expect(zeroCurrency(container.textContent ?? '')).toEqual([])
  })

  it('shows no market median line', () => {
    const { container } = renderReport([45_000])
    expect(container.textContent).not.toContain('Harga tengah iklan setanding')
  })

  it('shows no trade-in estimate', () => {
    const { container } = renderReport([45_000])
    expect(container.textContent).not.toContain('Anggaran trade-in')
  })

  it('publishes no aggregate market claim from a single advertisement', () => {
    // The raw listing price may still be shown — that is honest evidence. What
    // must not appear is one ad dressed up as "the market median".
    const { container } = renderReport([45_000])
    const text = container.textContent ?? ''
    expect(text).not.toContain('Harga tengah iklan setanding')
    expect(text).not.toContain('Anggaran trade-in')
  })

  it('shows no verdict badge at all', () => {
    const { container } = renderReport([45_000])
    const text = container.textContent ?? ''
    for (const badge of ['MAHAL', 'WAJAR', 'BERBALOI']) expect(text).not.toContain(badge)
  })

  it('shows no verdict badge even when depreciation data IS available', () => {
    // The correction: a depreciation-derived MAHAL is indistinguishable from a
    // market MAHAL to a buyer. Neither may appear on an unsupported cohort.
    const text = renderWithNewPrice([45_000]).container.textContent ?? ''
    for (const badge of ['MAHAL', 'WAJAR', 'BERBALOI']) expect(text).not.toContain(badge)
  })

  it('presents depreciation as clearly-labelled supporting context', () => {
    const text = renderWithNewPrice([45_000]).container.textContent ?? ''
    expect(text).toContain('Anggaran berdasarkan susut nilai')
    expect(text).toContain('Belum cukup iklan setanding untuk beri keputusan harga pasaran')
    expect(text).toContain('bukan harga pasaran semasa')
    expect(text).not.toContain('Harga tengah iklan setanding')
    expect(text).not.toContain('Anggaran trade-in')
    expect(zeroCurrency(text)).toEqual([])
  })

  it('puts no market median into the negotiation script', () => {
    const { container } = renderReport([45_000])
    const text = container.textContent ?? ''
    expect(text).not.toContain('harga tengah pasaran sekarang RM0')
    expect(text).not.toMatch(/harga tengah pasaran[^.]*RM\s?0(?![\d,.])/)
  })
})

describe('two-listing cohort', () => {
  it('renders no RM0 and no aggregate market claim', () => {
    const { container } = renderReport([45_000, 47_000])
    const text = container.textContent ?? ''
    expect(zeroCurrency(text)).toEqual([])
    expect(text).not.toContain('Harga tengah iklan setanding')
    expect(text).not.toContain('Anggaran trade-in')
  })

  it('shows no verdict badge, with or without depreciation data', () => {
    for (const text of [
      renderReport([45_000, 47_000]).container.textContent ?? '',
      renderWithNewPrice([45_000, 47_000]).container.textContent ?? '',
    ]) {
      for (const badge of ['MAHAL', 'WAJAR', 'BERBALOI']) expect(text).not.toContain(badge)
    }
  })

  it('states plainly that comparables are insufficient', () => {
    const text = renderWithNewPrice([45_000, 47_000]).container.textContent ?? ''
    expect(text).toContain('Belum cukup iklan setanding')
    expect(text).toContain('2 iklan setanding dijumpai')
  })
})

describe('insufficient-data negotiation script', () => {
  const script = (prices: number[]) => {
    const nodes = Array.from(renderWithNewPrice(prices).container.querySelectorAll('p'))
    return nodes.map(n => n.textContent ?? '').find(t => t.startsWith('Salam')) ?? ''
  }

  it('names its own basis instead of claiming a market price', () => {
    const s = script([45_000])
    expect(s).toContain('belum menemui cukup iklan setanding')
    expect(s).toContain('Berdasarkan harga baharu dan umur kenderaan sahaja')
  })

  it('never claims a market median or comparable evidence', () => {
    for (const s of [script([45_000]), script([45_000, 47_000])]) {
      expect(s).not.toContain('harga tengah pasaran')
      expect(s).not.toContain('listing serupa')
      expect(s).not.toContain('keputusan harga')
      expect(s).not.toMatch(/RM\s?0(?![\d,.])/)
    }
  })
})

describe('provisional cohort (3–4 listings)', () => {
  it('shows the verdict with a visible low-confidence caution naming the count', () => {
    const { container } = renderReport([45_000, 46_000, 47_000])
    const text = container.textContent ?? ''
    expect(text).toContain('Anggaran awal')
    expect(text).toContain('3 iklan setanding')
    expect(zeroCurrency(text)).toEqual([])
  })

  it('keeps the listing count visible', () => {
    const { container } = renderReport([45_000, 46_000, 47_000, 48_000])
    expect(container.textContent).toContain('4 iklan setanding')
  })

  it('does not overstate certainty in the copied script', () => {
    const { container } = renderReport([45_000, 46_000, 47_000])
    expect(container.textContent).toContain('anggaran awal')
  })
})

describe('normal cohort (5+ listings)', () => {
  const prices = [42_000, 44_000, 45_000, 46_000, 48_000, 50_000]

  it('renders the market evidence block with a real median', () => {
    const { container } = renderReport(prices)
    const text = container.textContent ?? ''
    expect(text).toContain('Bukti daripada Iklan Setanding')
    expect(text).toContain('Harga tengah iklan setanding')
    expect(zeroCurrency(text)).toEqual([])
  })

  it('carries the real median into the negotiation script', () => {
    const { container } = renderReport(prices, 62_000)
    const text = container.textContent ?? ''
    // Wording scoped from "harga tengah pasaran sekarang" to "harga tengahnya":
    // the script is pasted to a seller, and a ≤15-advert single-site sample is
    // not "the market price now". The figure it must carry is unchanged.
    expect(text).toContain('harga tengahnya RM45,500')
  })

  it('shows no provisional caution', () => {
    const { container } = renderReport(prices)
    expect(container.textContent).not.toContain('Anggaran awal')
  })
})

describe('no asking price', () => {
  it('renders no verdict and no RM0', () => {
    const { container } = renderReport([42_000, 44_000, 45_000, 46_000, 48_000], null)
    expect(zeroCurrency(container.textContent ?? '')).toEqual([])
  })
})

describe('insufficient-data page copy leaks', () => {
  it('does not title the found ads as evidence of a market price', () => {
    const text = renderWithNewPrice([45_000]).container.textContent ?? ''
    expect(text).not.toContain('Bukti daripada Iklan Setanding')
    expect(text).toContain('Iklan Dijumpai')
  })

  it('keeps that title once the cohort is eligible', () => {
    const text = renderWithNewPrice([42_000, 44_000, 45_000, 46_000, 48_000, 50_000], 62_000)
      .container.textContent ?? ''
    expect(text).toContain('Bukti daripada Iklan Setanding')
  })

  it('does not interpret the new price against a single-ad median', () => {
    // depreciationInsight compares wmNewPrice to the market median; on one ad
    // that would read one advertisement as the market.
    const text = renderWithNewPrice([45_000]).container.textContent ?? ''
    expect(text).not.toContain('Harga ketika baru (anggaran)')
  })
})
