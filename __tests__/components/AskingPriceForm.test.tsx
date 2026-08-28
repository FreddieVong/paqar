// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { AskingPriceForm } from '@/components/report/AskingPriceForm'

/**
 * The paywall's second chance to collect an asking price.
 *
 * It renders only when a report reached the paywall WITHOUT one — so this is
 * the last field standing between a buyer and a verdict they have already
 * waited for. It got the same formatting treatment as the three check forms,
 * and it PATCHes a different route with a different body shape, so the payload
 * needs its own proof rather than inheriting the plate form's.
 *
 * It previously stripped non-digits at submit time. That stripping is now the
 * field's own behaviour, which means the value in state is already canonical —
 * and this suite exists to keep it that way.
 */

const reload = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
  // jsdom has no navigation; the component reloads on success.
  Object.defineProperty(window, 'location', { value: { reload }, writable: true })
  reload.mockClear()
})
afterEach(() => cleanup())

const field  = () => screen.getByLabelText('Harga yang seller minta') as HTMLInputElement
const submit = () => fireEvent.submit(screen.getByRole('button', { name: /Semak/ }).closest('form')!)
const body   = () => JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)

describe('the buyer sees a grouped number', () => {
  it('formats as they type', () => {
    render(<AskingPriceForm checkId="ch_1" claimToken="tok" />)
    fireEvent.change(field(), { target: { value: '59000' } })
    expect(field().value).toBe('59,000')
  })

  it('accepts a value pasted straight out of an advert', () => {
    render(<AskingPriceForm checkId="ch_1" claimToken="tok" />)
    fireEvent.change(field(), { target: { value: 'RM 59,000' } })
    expect(field().value).toBe('59,000')
  })
})

describe('the route receives a number, never a formatted string', () => {
  it.each(['59000', '59,000', 'RM 59,000', 'RM59000'])('sends 59000 for %s', async (typed) => {
    render(<AskingPriceForm checkId="ch_1" claimToken="tok" />)
    fireEvent.change(field(), { target: { value: typed } })
    submit()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(body().askingPriceRm).toBe(59_000)
  })

  it('keeps the rest of the payload and the endpoint unchanged', async () => {
    render(<AskingPriceForm checkId="ch_abc" claimToken="tok_xyz" />)
    fireEvent.change(field(), { target: { value: '59000' } })
    submit()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(url).toBe('/api/laporan-pembeli/ch_abc/asking-price')
    expect(init.method).toBe('PATCH')
    expect(body()).toEqual({ claimToken: 'tok_xyz', askingPriceRm: 59_000 })
  })
})

describe('validation did not move', () => {
  it('rejects a price below the floor without calling the route', async () => {
    render(<AskingPriceForm checkId="ch_1" claimToken="tok" />)
    fireEvent.change(field(), { target: { value: '999' } })
    submit()
    await waitFor(() => expect(screen.getByText(/harga yang sah/i)).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an empty field', async () => {
    render(<AskingPriceForm checkId="ch_1" claimToken="tok" />)
    submit()
    await waitFor(() => expect(screen.getByText(/harga yang sah/i)).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects text that contains no digits at all', async () => {
    render(<AskingPriceForm checkId="ch_1" claimToken="tok" />)
    fireEvent.change(field(), { target: { value: 'RM' } })
    submit()
    await waitFor(() => expect(screen.getByText(/harga yang sah/i)).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })
})
