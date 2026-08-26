// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

/** The current call to action. Kept in one place so the next rename is one line. */
const CTA_LABEL = 'Semak kereta itu →'

vi.mock('next/navigation', () => ({
  usePathname: () => '/faq/how-to-spot-flood-cars',
}))

const trackFaqGetValuationClick = vi.fn()
vi.mock('@/lib/ga4-events', () => ({
  trackFaqGetValuationClick: (...args: unknown[]) => trackFaqGetValuationClick(...args),
}))

// next/link renders a plain anchor in this environment
vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}))

import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, search },
  })
}

describe('FaqGetValuationCta', () => {
  beforeEach(() => {
    trackFaqGetValuationClick.mockClear()
    setSearch('')
  })
  afterEach(cleanup)

  it('renders the primary CTA', () => {
    render(<FaqGetValuationCta faqSlug="how-to-spot-flood-cars" />)
    expect(screen.getByText(CTA_LABEL)).toBeDefined()

    // The button text was pinned here as "Check a Car Now" — which is part of
    // why the retired product survived on eight live guides for months: the
    // test asserted the wrong copy was present, so changing it looked like a
    // regression. Assert the SHAPE (a label exists, it links home, it tracks)
    // and the one thing that must never come back.
    expect(screen.queryByText(/instant valuation/i)).toBeNull()
    expect(screen.queryByText(/Enter a plate number/i)).toBeNull()
  })

  // The back-link is what connects each guide back to the hub. Before it
  // existed the guides were crawl dead-ends, so this is a real regression guard.
  it('renders a back-link to the FAQ hub', () => {
    render(<FaqGetValuationCta faqSlug="how-to-spot-flood-cars" />)
    const back = screen.getByText('← Semua panduan pembeli')
    expect(back.getAttribute('href')).toBe('/faq')
  })

  it('fires the GA4 event on CTA click with the slug and path', () => {
    render(<FaqGetValuationCta faqSlug="roadtax-by-state" />)
    fireEvent.click(screen.getByText(CTA_LABEL))
    expect(trackFaqGetValuationClick).toHaveBeenCalledWith({
      faq_slug: 'roadtax-by-state',
      page_path: '/faq/how-to-spot-flood-cars',
      destination: '/',
    })
  })

  it('marks the homepage link with entry_source=faq', () => {
    render(<FaqGetValuationCta faqSlug="how-to-spot-flood-cars" />)
    const cta = screen.getByText(CTA_LABEL)
    expect(cta.getAttribute('href')).toContain('entry_source=faq')
  })

  it('preserves UTM and click-id params through to the homepage', () => {
    setSearch('?utm_source=google&utm_medium=cpc&gclid=abc123')
    render(<FaqGetValuationCta faqSlug="how-to-spot-flood-cars" />)
    const href = screen.getByText(CTA_LABEL).getAttribute('href') ?? ''
    expect(href).toContain('utm_source=google')
    expect(href).toContain('utm_medium=cpc')
    expect(href).toContain('gclid=abc123')
    expect(href).toContain('entry_source=faq')
  })

  it('does not invent params that were not present', () => {
    render(<FaqGetValuationCta faqSlug="how-to-spot-flood-cars" />)
    const href = screen.getByText(CTA_LABEL).getAttribute('href') ?? ''
    expect(href).not.toContain('utm_source')
    expect(href).not.toContain('gclid')
  })
})
