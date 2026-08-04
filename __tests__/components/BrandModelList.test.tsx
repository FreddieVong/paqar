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
  { hubSlug: 'honda-city', model: 'City',  yearKey: 'city',  years: ['2021', '2022'], range: 'RM38k – RM92k',  tag: 'Sedan' },
  { hubSlug: 'honda-hrv',  model: 'HR-V',  yearKey: 'hr-v',  years: ['2021', '2022'], range: 'RM56k – RM92k',  tag: 'SUV' },
  {                        model: 'Civic', yearKey: 'civic', years: ['2020', '2021'], range: 'RM70k – RM120k', tag: 'Sedan sport' },
]

const hrefs = () => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'))

afterEach(cleanup)

describe('BrandModelList', () => {
  it('keeps a hub-less model visible with its price range', () => {
    render(<BrandModelList brand="Honda" models={HONDA} />)
    expect(screen.getByText('Honda Civic')).toBeDefined()
    expect(screen.getByText(/RM70k – RM120k/)).toBeDefined()
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
