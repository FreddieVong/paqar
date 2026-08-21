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

// Mirrors the real Honda hub: City/Jazz/HR-V have hubs, Civic does not.
const HONDA: BrandModel[] = [
  { hubSlug: 'honda-city', model: 'City',  yearKey: 'city',  years: ['2021', '2022'], tag: 'Sedan' },
  { hubSlug: 'honda-hrv',  model: 'HR-V',  yearKey: 'hr-v',  years: ['2021', '2022'], tag: 'SUV' },
  {                        model: 'Civic', yearKey: 'civic', years: ['2020', '2021'], tag: 'Sedan sport' },
]

const hrefs = () => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'))

afterEach(cleanup)

describe('BrandModelList', () => {
  it('keeps a hub-less model visible', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(screen.getByText('Honda Civic')).toBeDefined()
  })

  // ── The free/paid boundary ────────────────────────────────────────────────
  //
  // Every row used to end with a rounded market span — "RM48k - RM73k - Sedan"
  // — and the tests above asserted the rounding was correct. Rounding is not
  // redaction: the minimum and maximum of a scraped cohort is the range the
  // RM12 report sells, whatever precision it is printed at. The component can
  // no longer receive those figures at all.

  it('renders no price figure anywhere', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(document.body.textContent).not.toMatch(/RM/i)
  })

  it('renders no digit other than a model year', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    // No word boundary: textContent concatenates adjacent year chips into
    // "20212022", so \b would fail to strip either of them.
    const withoutYears = (document.body.textContent ?? '').replace(/(19|20)\d{2}/g, '')
    expect(withoutYears).not.toMatch(/\d/)
  })

  it('shows the tag alone', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(screen.getByText('SUV')).toBeDefined()
    expect(screen.getByText('Sedan')).toBeDefined()
  })

  it('keeps the row, the hub link and the year chips when the span is absent', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(screen.getByText('Honda HR-V')).toBeDefined()
    expect(hrefs()).toContain('/harga-kereta-terpakai/honda-hrv')
    expect(hrefs()).toContain('/harga-hr-v-2021')
  })

  it('keeps every year link for a hub-less model', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    // Civic year pages are real and in the sitemap — only the hub is missing.
    expect(hrefs()).toContain('/harga-civic-2020')
    expect(hrefs()).toContain('/harga-civic-2021')
  })

  it('renders no model-hub link for a hub-less model', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(hrefs()).not.toContain('/harga-kereta-terpakai/honda-civic')
    expect(hrefs().some(h => h?.startsWith('/harga-kereta-terpakai/'))).toBe(true) // City/HR-V still link
  })

  it('links models that do have a hub, using the real slug', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(hrefs()).toContain('/harga-kereta-terpakai/honda-city')
    expect(hrefs()).toContain('/harga-kereta-terpakai/honda-hrv')
    expect(hrefs()).not.toContain('/harga-kereta-terpakai/honda-hr-v')
  })

  it('renders no empty href anywhere', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
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
