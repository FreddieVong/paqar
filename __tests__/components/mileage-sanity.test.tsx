// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/laporan-pembeli/ch_1', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/analytics', () => ({ analytics: { paymentFormSubmitted: vi.fn(), paymentFormViewed: vi.fn() } }))
vi.mock('@/lib/meta-events', () => ({ trackAdEvent: vi.fn() }))
vi.mock('@/app/laporan-pembeli/[checkId]/_actions', () => ({ initiateBuyerReport: vi.fn() }))

import { PaymentForm } from '@/components/report/PaymentForm'

const mount = () =>
  render(<PaymentForm checkId="ch_1" claimToken="tok" valuationPath="plate_report" />)

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

/**
 * The field says "kami semak sama ada ia munasabah untuk umur kereta" and then
 * accepted 700,000 km silently — a figure no private Malaysian car reaches,
 * and almost always 70,000 with one extra keystroke. The buyer pays for a
 * plausibility check against a number they did not mean.
 */
describe('an implausible mileage is questioned, not swallowed', () => {
  const setMileage = (v: string) => {
    const input = screen.getByLabelText(/Mileage/i)
    fireEvent.change(input, { target: { value: v } })
  }

  it('says nothing for an ordinary reading', () => {
    mount()
    setMileage('85000')
    expect(screen.queryByText(/sangat tinggi/)).toBeNull()
    expect(screen.getByText(/munasabah untuk umur kereta/)).toBeTruthy()
  })

  it('names the likely typo for 700,000 km', () => {
    mount()
    setMileage('700000')
    expect(screen.getByText(/sangat tinggi/)).toBeTruthy()
    // The whole value of the warning: the number they probably meant.
    expect(screen.getByText(/70,000 km/)).toBeTruthy()
  })

  it('does not block — a genuine ex-fleet car exists', () => {
    mount()
    setMileage('700000')
    const pay = screen.getByRole('button', { name: /Bayar/i })
    expect(pay.hasAttribute('disabled')).toBe(false)
    expect(screen.getByText(/teruskan sahaja/)).toBeTruthy()
  })

  it('clears once the value is corrected', () => {
    mount()
    setMileage('700000')
    expect(screen.getByText(/sangat tinggi/)).toBeTruthy()
    setMileage('70000')
    expect(screen.queryByText(/sangat tinggi/)).toBeNull()
  })
})
