// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { WhatsappOptIn } from '@/components/report/WhatsappOptIn'

/**
 * The one form a buyer sees right after paying. It must ask plainly, post
 * the token with the number, show the number back the way they wrote it,
 * and say something useful when the number is wrong.
 */
const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const ok  = (phone: string) => ({ ok: true,  json: async () => ({ ok: true, phone }) })
const bad = (error: string) => ({ ok: false, json: async () => ({ error }) })

describe('WhatsappOptIn', () => {
  it('asks, optionally, and says what the number is for', () => {
    render(<WhatsappOptIn checkId="ch_1" claimToken="tok" />)
    expect(screen.getByText('Nak kami WhatsApp bila laporan siap?')).toBeTruthy()
    expect(screen.getByText(/Pilihan/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ya, WhatsApp saya' })).toBeTruthy()
  })

  it('posts the token and the number to the whatsapp route, then shows the tick', async () => {
    fetchMock.mockResolvedValue(ok('012-345 6789'))
    render(<WhatsappOptIn checkId="ch_1" claimToken="tok" />)
    fireEvent.change(screen.getByLabelText('Nombor WhatsApp'), { target: { value: '0123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ya, WhatsApp saya' }))

    await waitFor(() => expect(screen.getByText(/✓ Kami akan WhatsApp 012-345 6789 bila laporan siap/)).toBeTruthy())
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/laporan-pembeli/ch_1/whatsapp')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ claimToken: 'tok', phone: '0123456789' })
  })

  it('shows the route\'s own message for a bad number and keeps the form open', async () => {
    fetchMock.mockResolvedValue(bad('Nombor tak sah — contoh: 012-345 6789'))
    render(<WhatsappOptIn checkId="ch_1" claimToken="tok" />)
    fireEvent.change(screen.getByLabelText('Nombor WhatsApp'), { target: { value: '0312345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ya, WhatsApp saya' }))

    await waitFor(() => expect(screen.getByText('Nombor tak sah — contoh: 012-345 6789')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Ya, WhatsApp saya' })).toBeTruthy()
  })

  it('starts on the tick when a number is already on file, with a way to change it', () => {
    render(<WhatsappOptIn checkId="ch_1" claimToken="tok" initialPhone="012-345 6789" />)
    expect(screen.getByText(/✓ Kami akan WhatsApp 012-345 6789/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tukar nombor' }))
    expect(screen.getByRole('button', { name: 'Ya, WhatsApp saya' })).toBeTruthy()
  })

  it('does not submit an empty number', () => {
    render(<WhatsappOptIn checkId="ch_1" claimToken="tok" />)
    expect((screen.getByRole('button', { name: 'Ya, WhatsApp saya' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
