// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SocialLinks } from '@/components/layout/SocialLinks'
import { SOCIAL, GOOGLE_BUSINESS } from '@/lib/site'

afterEach(cleanup)

describe('SocialLinks', () => {
  it('links all three social profiles and the Google review CTA', () => {
    render(<SocialLinks />)
    const hrefs = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'))
    expect(hrefs).toEqual([
      SOCIAL.facebook,
      SOCIAL.instagram,
      SOCIAL.tiktok,
      GOOGLE_BUSINESS.review,
    ])
  })

  it('uses the review deep link for the CTA, not the entity profile URL', () => {
    render(<SocialLinks />)
    const hrefs = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'))
    expect(hrefs).toContain(GOOGLE_BUSINESS.review)
    expect(hrefs).not.toContain(GOOGLE_BUSINESS.profile)
  })

  it('opens every external link safely in a new tab', () => {
    render(<SocialLinks />)
    for (const a of Array.from(document.querySelectorAll('a'))) {
      expect(a.getAttribute('target')).toBe('_blank')
      // Without noopener the opened page gets a handle on window.opener.
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('gives every icon-only link an accessible name', () => {
    render(<SocialLinks />)
    // The links have no text content, so aria-label is the only accessible name.
    expect(screen.getByLabelText('Paqar di Facebook')).toBeDefined()
    expect(screen.getByLabelText('Paqar di Instagram')).toBeDefined()
    expect(screen.getByLabelText('Paqar di TikTok')).toBeDefined()
    expect(screen.getByLabelText('Tulis ulasan Paqar di Google')).toBeDefined()
  })

  it('hides the decorative SVGs from assistive tech', () => {
    render(<SocialLinks />)
    for (const svg of Array.from(document.querySelectorAll('svg'))) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('carries a visible focus ring and the footer hover colour', () => {
    render(<SocialLinks />)
    for (const a of Array.from(document.querySelectorAll('a'))) {
      const cls = a.getAttribute('class') ?? ''
      expect(cls).toContain('focus-visible:ring-2')
      expect(cls).toContain('text-[#9CA3AF]')      // resting, matches sibling footer links
      expect(cls).toContain('hover:text-[#064E4A]') // hover, matches sibling footer links
    }
  })

  it('renders no empty href', () => {
    render(<SocialLinks />)
    for (const a of Array.from(document.querySelectorAll('a'))) {
      expect(a.getAttribute('href')).toBeTruthy()
    }
  })
})
