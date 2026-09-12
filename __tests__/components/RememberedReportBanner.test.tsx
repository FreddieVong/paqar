// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { RememberedReportBanner } from '@/components/report/RememberedReportBanner'

/**
 * One line on the homepage for the phone that paid. Renders nothing for
 * everyone else, prefers a paid report over a free result, and links with
 * the credential the route returned.
 */
const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const reply = (reports: unknown[]) => ({ ok: true, json: async () => ({ reports }) })
const released = { checkId: 'ch_1', label: 'PPD769', state: 'released', url: '/laporan-pembeli/ch_1?claim_token=t', createdAt: null }
const free     = { checkId: 'ch_2', label: 'Perodua Myvi 2019', state: 'free_result', url: '/laporan-pembeli/ch_2?claim_token=u', createdAt: null }

describe('RememberedReportBanner', () => {
  it('renders nothing when the phone remembers nothing', async () => {
    fetchMock.mockResolvedValue(reply([]))
    const { container } = render(<RememberedReportBanner />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/laporan-saya', { cache: 'no-store' }))
    expect(container.innerHTML).toBe('')
  })

  it('hands a released report straight to the buyer', async () => {
    fetchMock.mockResolvedValue(reply([released]))
    render(<RememberedReportBanner />)
    const link = await screen.findByRole('link')
    expect(link.textContent).toContain('Laporan PPD769 dah siap.')
    expect(link.textContent).toContain('Buka laporan →')
    expect(link.getAttribute('href')).toBe('/laporan-pembeli/ch_1?claim_token=t')
  })

  it('prefers the paid report over an older free result', async () => {
    fetchMock.mockResolvedValue(reply([free, released]))
    render(<RememberedReportBanner />)
    const link = await screen.findByRole('link')
    expect(link.textContent).toContain('PPD769')
  })

  it('offers the way back to a free result when that is all there is', async () => {
    fetchMock.mockResolvedValue(reply([free]))
    render(<RememberedReportBanner />)
    const link = await screen.findByRole('link')
    expect(link.textContent).toContain('Semakan Perodua Myvi 2019 anda masih ada.')
  })

  it('stays silent when the route fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const { container } = render(<RememberedReportBanner />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })
})
