// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Nav } from '@/components/layout/Nav'

/**
 * The audit proposed hiding "Kira Ansuran" and "Panduan" on mobile. Measured
 * horizontal overflow at 375px and 390px is 0px, so the crowding does not
 * reproduce — and Panduan is the guide hub, so removing it from the highest
 * traffic page would cut internal linking to solve a problem that isn't there.
 *
 * What was real: 12px #9CA3AF is 2.54:1, below the WCAG AA 4.5:1 floor, in a
 * link whose tap target was ~16px tall against a 44px minimum this project
 * already adopted.
 */

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

describe('every destination stays reachable', () => {
  it.each(['Kira Ansuran', 'Panduan', 'Laporan Saya'])('keeps %s', (name) => {
    render(<Nav />)
    expect(screen.getByRole('link', { name })).toBeTruthy()
  })

  it('keeps the logo as the home link', () => {
    render(<Nav />)
    expect(screen.getByRole('link', { name: 'Paqar' }).getAttribute('href')).toBe('/')
  })
})

describe('the links are legible and tappable', () => {
  it.each(['Kira Ansuran', 'Panduan', 'Laporan Saya'])('%s passes AA and reaches 44px', (name) => {
    render(<Nav />)
    const cls = screen.getByRole('link', { name }).className
    expect(cls).toContain('text-[#6B7280]')   // 4.83:1 on white
    expect(cls).not.toContain('#9CA3AF')      // 2.54:1 — fails AA
    expect(cls).toContain('min-h-[44px]')
  })

  it('shows a focus ring for keyboard users', () => {
    render(<Nav />)
    expect(screen.getByRole('link', { name: 'Panduan' }).className)
      .toContain('focus-visible:ring-2')
  })
})
