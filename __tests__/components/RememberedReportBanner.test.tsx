// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { RememberedReportBanner } from '@/components/report/RememberedReportBanner'

const { pathnameState } = vi.hoisted(() => ({ pathnameState: { value: '/' } }))
vi.mock('next/navigation', () => ({ usePathname: () => pathnameState.value }))

/**
 * One line on the homepage for the phone that paid. Renders nothing for
 * everyone else, prefers a paid report over a free result, and links with
 * the credential the route returned.
 */
const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); pathnameState.value = '/'; sessionStorage.clear() })
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

  it('stays off the report page itself and off Laporan Saya, without even asking', async () => {
    fetchMock.mockResolvedValue(reply([released]))
    for (const path of ['/laporan-pembeli/ch_1', '/laporan-saya']) {
      pathnameState.value = path
      const { container, unmount } = render(<RememberedReportBanner />)
      await new Promise(r => setTimeout(r, 10))
      expect(container.innerHTML).toBe('')
      unmount()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks the route once per tab, not once per page', async () => {
    fetchMock.mockResolvedValue(reply([released]))
    const first = render(<RememberedReportBanner />)
    await screen.findByRole('link')
    first.unmount()
    render(<RememberedReportBanner />)
    await screen.findByRole('link')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('remembers an empty answer too, so a visitor with nothing is not re-queried', async () => {
    fetchMock.mockResolvedValue(reply([]))
    const first = render(<RememberedReportBanner />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    first.unmount()
    render(<RememberedReportBanner />)
    await new Promise(r => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stays silent when the route fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const { container } = render(<RememberedReportBanner />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })
})
