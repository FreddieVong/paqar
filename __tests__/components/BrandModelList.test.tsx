// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// next/link renders a plain anchor in this environment
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { BrandModelList, brandCollectionItems } from '@/components/layout/BrandModelList'
import type { BrandModel } from '@/lib/model-hubs'
import type { ModelPriceSpan } from '@/lib/db/market-prices'

// Mirrors the real Honda hub: City/Jazz/HR-V have hubs, Civic does not.
const HONDA: BrandModel[] = [
  { hubSlug: 'honda-city', model: 'City',  yearKey: 'city',  years: ['2021', '2022'], tag: 'Sedan' },
  { hubSlug: 'honda-hrv',  model: 'HR-V',  yearKey: 'hr-v',  years: ['2021', '2022'], tag: 'SUV' },
  {                        model: 'Civic', yearKey: 'civic', years: ['2020', '2021'], tag: 'Sedan sport' },
]

// Keyed on yearKey, as getCoverageModelSpans returns. HR-V deliberately has no
// entry: that is the "cohort too thin to publish" case.
const span = (min: number, max: number): ModelPriceSpan =>
  ({ min, max, years: ['2021', '2022'], fetchedAt: '2026-08-01T00:00:00Z' })

const SPANS = new Map<string, ModelPriceSpan>([
  ['city',  span(47_800, 72_899)],
  ['civic', span(70_100, 119_500)],
])

const hrefs = () => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'))

afterEach(cleanup)

describe('BrandModelList', () => {
  it('keeps a hub-less model visible with its price range', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    expect(screen.getByText('Honda Civic')).toBeDefined()
    expect(screen.getByText(/RM70k – RM120k/)).toBeDefined()
  })

  it('renders the span from the live cohort, not an authored string', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    // 47_800 / 72_899 rounded to the nearest thousand.
    expect(screen.getByText(/RM48k – RM73k · Sedan/)).toBeDefined()
  })

  it('shows the tag alone when a model has no publishable span', () => {
    // The defect this replaces: every row carried a hand-typed range that no
    // cohort had produced, and that nothing updated. Suppressing the figure is
    // the only honest option — inventing one is what caused the problem.
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    expect(screen.getByText('SUV')).toBeDefined()
    expect(screen.queryByText(/RM\d+k – RM\d+k · SUV/)).toBeNull()
  })

  it('keeps the row, the hub link and the year chips when the span is absent', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    expect(screen.getByText('Honda HR-V')).toBeDefined()
    expect(hrefs()).toContain('/harga-kereta-terpakai/honda-hrv')
    expect(hrefs()).toContain('/harga-hr-v-2021')
  })

  it('keeps every year link for a hub-less model', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    // Civic year pages are real and in the sitemap — only the hub is missing.
    expect(hrefs()).toContain('/harga-civic-2020')
    expect(hrefs()).toContain('/harga-civic-2021')
  })

  it('renders no model-hub link for a hub-less model', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    expect(hrefs()).not.toContain('/harga-kereta-terpakai/honda-civic')
    expect(hrefs().some(h => h?.startsWith('/harga-kereta-terpakai/'))).toBe(true) // City/HR-V still link
  })

  it('links models that do have a hub, using the real slug', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    expect(hrefs()).toContain('/harga-kereta-terpakai/honda-city')
    expect(hrefs()).toContain('/harga-kereta-terpakai/honda-hrv')
    expect(hrefs()).not.toContain('/harga-kereta-terpakai/honda-hr-v')
  })

  it('renders no empty href anywhere', () => {
    render(<BrandModelList brand="Honda" models={HONDA} spans={SPANS} />)
    for (const href of hrefs()) {
      expect(href).toBeTruthy()
      expect(href).not.toBe('')
    }
  })
})

describe('brandCollectionItems', () => {
  it('excludes hub-less models from ItemList structured data', () => {
    const urls = brandCollectionItems('Honda', HONDA).map(i => i.url)
    expect(urls).toEqual([
      'https://paqar.my/harga-kereta-terpakai/honda-city',
      'https://paqar.my/harga-kereta-terpakai/honda-hrv',
    ])
    expect(urls).not.toContain('https://paqar.my/harga-kereta-terpakai/honda-civic')
  })

  it('names items with the brand prefix', () => {
    expect(brandCollectionItems('Honda', HONDA)[0]).toEqual({
      name: 'Honda City',
      url:  'https://paqar.my/harga-kereta-terpakai/honda-city',
    })
  })
})
