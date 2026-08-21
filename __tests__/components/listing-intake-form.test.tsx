// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'

/**
 * Drives the REAL form the way a buyer does.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The live journey script passed 16/16 by calling the database layer directly.
 * It never crossed an HTTP boundary, so it could not catch the defect that
 * actually broke the product: every intake request returning 429. Only using
 * the form found that.
 *
 * A dev server cannot be kept alive in this environment, so this is the closest
 * honest substitute — the real component, real state transitions, real fetch
 * calls, with the network stubbed. It catches wiring bugs (a handler that never
 * fires, a token that never reaches a header, a summary that never renders). It
 * does NOT catch layout, CSS or genuine browser behaviour, and is not claimed to.
 */

vi.mock('@/lib/analytics', () => ({
  analytics: { plateFormEngaged: vi.fn(), checkStarted: vi.fn(), ctaClicked: vi.fn() },
}))
vi.mock('@/lib/ga4-events', () => ({ trackValuationStarted: vi.fn(), getTrafficContext: () => ({}) }))
vi.mock('@/lib/meta-events', () => ({ trackAdEvent: vi.fn() }))
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const { ListingIntakeForm } = await import('@/components/check/ListingIntakeForm')

/** Records every request so header/body wiring can be asserted. */
type Call = { url: string; init?: RequestInit }
let calls: Call[] = []
let routes: Record<string, unknown> = {}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })
    // ORDER MATTERS, and substring matching is a trap here:
    // '/api/listing-intake/<id>/extract' contains '/api/listing-intake', which
    // is the LONGER string — so both "first match" and "longest match" answer
    // the extract call with the create-intake payload, and nothing downstream
    // ever renders. Most specific route first, explicitly.
    const key = u.includes('/extract')        ? '/extract'
              : u.includes('/convert')        ? '/convert'
              : u.includes('/fields')         ? '/fields'
              : u.includes('/api/price-check')? '/api/price-check'
              : u.includes('/api/listing-screenshots') ? '/api/listing-screenshots'
              : u.includes('/api/listing-intake')      ? '/api/listing-intake'
              : null
    if (!key || !(key in routes)) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => routes[key] }
  }))
}

const SUMMARY = {
  brand:         { value: 'Honda', status: 'high',   provenance: 'url_metadata' },
  model:         { value: 'City',  status: 'high',   provenance: 'url_metadata' },
  year:          { value: '2019',  status: 'high',   provenance: 'url_metadata' },
  variant:       { value: null,    status: 'missing', provenance: null },
  askingPriceRm: { value: 55000,   status: 'high',   provenance: 'url_metadata' },
  mileageKm:     { value: 85000,   status: 'medium', provenance: 'url_metadata' },
  plate:         { value: null,    status: 'missing', provenance: null },
}

beforeEach(() => {
  calls = []
  push.mockClear()
  routes = {
    '/api/listing-intake':  { intakeId: 'intake_1', token: 'tok_secret_value' },
    '/extract':             { summary: SUMMARY, ready: true, needScreenshots: false, ocrUnavailable: false },
    '/api/price-check':     { eligible: true, modelLabel: 'Honda City 2019' },
  }
  stubFetch()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const pasteUrl = (url: string) => {
  const input = screen.getByLabelText(/Tampal link iklan/i)
  fireEvent.change(input, { target: { value: url } })
  fireEvent.blur(input)
}

const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', { type: 'image/png' })

/**
 * Extraction is driven by SCREENSHOTS, not by the URL.
 *
 * Nothing is server-fetched: every listing site either forbids automated
 * access in robots.txt or answers 403 to non-browser requests. A pasted link is
 * stored for the human reviewer; the buyer's own screenshots are what can be
 * read.
 */
const uploadScreenshot = () => {
  routes['/api/listing-screenshots'] = { ok: true, duplicate: false, count: 1 }
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement,
    { target: { files: [pngFile()] } })
}

describe('pasting a listing link', () => {
  it('reads a readable link and shows the summary', async () => {
    render(<ListingIntakeForm />)
    pasteUrl('https://www.mudah.my/honda-city-2019-108451234.htm')

    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })
    expect(screen.getByText(/Seller minta RM55,000/)).toBeTruthy()
  })

  /**
   * Reading is delegated to the scraper service, which already runs a real
   * browser against Mudah for comparables. The app never fetches these pages
   * itself — it gets 403 — so the request that matters is the one to /extract.
   */
  it('asks the server to read a readable link', async () => {
    render(<ListingIntakeForm />)
    pasteUrl('https://www.mudah.my/x-1.htm')
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })
    expect(calls.some(c => c.url.includes('/extract'))).toBe(true)
  })

  it('falls back to asking for screenshots when it cannot be read', async () => {
    routes['/extract'] = { summary: SUMMARY, ready: false, needScreenshots: true, ocrUnavailable: true }
    render(<ListingIntakeForm />)
    pasteUrl('https://www.carlist.my/used-cars/honda/city/2019/1')
    await screen.findByText(/tak dapat baca/i, undefined, { timeout: 5000 })
  })

  it('creates the intake so the URL is actually persisted', async () => {
    render(<ListingIntakeForm />)
    pasteUrl('https://www.mudah.my/x-1.htm')
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })

    const create = calls.find(c => c.url.endsWith('/api/listing-intake'))!
    expect(JSON.parse(String(create.init?.body))).toMatchObject({
      url: 'https://www.mudah.my/x-1.htm',
    })
  })

  /** A credential in a query string reaches logs, history and Referer headers. */
  it('sends the ownership token in a HEADER, never in the URL', async () => {
    render(<ListingIntakeForm />)
    pasteUrl('https://www.mudah.my/x-1.htm')
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })

    const extract = calls.find(c => c.url.includes('/extract'))!
    const headers = extract.init?.headers as Record<string, string>
    expect(headers['x-paqar-intake-token']).toBe('tok_secret_value')
    for (const c of calls) expect(c.url).not.toContain('tok_secret_value')
  })
})

describe('an unfetchable listing', () => {
  it('is accepted and asks for screenshots, with no error language', async () => {
    routes['/extract'] = { summary: SUMMARY, ready: false, needScreenshots: true, ocrUnavailable: false }
    routes['/extract'] = { summary: SUMMARY, ready: false, needScreenshots: true, ocrUnavailable: true }
    render(<ListingIntakeForm />)
    pasteUrl('https://www.carlist.my/used-cars/honda/city/2019/1234567')

    await screen.findByText(/tak dapat baca/i, undefined, { timeout: 5000 })
    // Nothing about hosts, HTTP, policies or storage may reach the buyer.
    const body = document.body.textContent ?? ''
    for (const leak of ['403', 'HTTP', 'Cloudflare', 'host', 'policy', 'storage', 'OCR']) {
      expect(body, `leaked "${leak}" to the buyer`).not.toContain(leak)
    }
  })
})

describe('the summary is editable without a confirmation step', () => {
  it('offers exactly one Ubah action and no confirm button', async () => {
    render(<ListingIntakeForm />)
    uploadScreenshot()
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })

    expect(screen.getByText(/Maklumat salah\? Ubah/i)).toBeTruthy()
    expect(screen.queryByText(/Ya, betul/i)).toBeNull()
    expect(screen.queryByText(/Sahkan/i)).toBeNull()
  })

  it('reveals the fields when Ubah is pressed', async () => {
    render(<ListingIntakeForm />)
    uploadScreenshot()
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })

    fireEvent.click(screen.getByText(/Maklumat salah\? Ubah/i))
    await waitFor(() => expect(screen.getByLabelText(/Jenama/i)).toBeTruthy())
  })
})

describe('coverage', () => {
  it('shows capability only — never a verdict, median or range', async () => {
    render(<ListingIntakeForm />)
    uploadScreenshot()
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })

    fireEvent.click(screen.getByRole('button', { name: /Semak kereta ini/i }))
    await screen.findByText(/Paqar boleh semak/i, undefined, { timeout: 5000 })

    const body = document.body.textContent ?? ''
    for (const leaked of ['MAHAL', 'WAJAR', 'BERBALOI', 'harga tengah', 'julat']) {
      expect(body, `coverage leaked "${leaked}"`).not.toContain(leaked)
    }
  })

  it('refuses honestly and offers no payment when ineligible', async () => {
    routes['/api/price-check'] = { eligible: false, modelLabel: 'Honda City 2019' }
    render(<ListingIntakeForm />)
    uploadScreenshot()
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })

    fireEvent.click(screen.getByRole('button', { name: /Semak kereta ini/i }))
    await screen.findByText(/belum boleh bantu/i, undefined, { timeout: 5000 })
    expect(screen.queryByText(/Dapatkan keputusan/i)).toBeNull()
  })
})

describe('the price sits above the pay button', () => {
  it('shows the asking price and converts on click', async () => {
    routes['/convert'] = { checkId: 'ch_1', claimToken: 'ct_1' }
    render(<ListingIntakeForm />)
    uploadScreenshot()
    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: /Semak kereta ini/i }))
    await screen.findByText(/Paqar boleh semak/i, undefined, { timeout: 5000 })

    expect(screen.getAllByText(/Seller minta RM55,000/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Dapatkan keputusan — RM29/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('/laporan-pembeli/ch_1')))
  })
})

/**
 * The upload path, which reported "Tak dapat mula" in a browser.
 *
 * That message is the `!owner` branch — ensureIntake returned null because the
 * API answered 429. It is worth pinning that the component creates the intake
 * LAZILY on first file selection and carries the credential it gets back,
 * rather than reading a prop React has not re-rendered yet.
 */
describe('uploading a screenshot', () => {
  const file = () =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', { type: 'image/png' })

  it('creates the intake on first file selection and uploads', async () => {
    routes['/api/listing-screenshots'] = { ok: true, duplicate: false, count: 1 }
    render(<ListingIntakeForm />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input, 'no file input rendered').toBeTruthy()
    fireEvent.change(input, { target: { files: [file()] } })

    await waitFor(
      () => expect(calls.some(c => c.url.includes('/api/listing-screenshots'))).toBe(true),
      { timeout: 5000 },
    )
    // The intake must have been created first — nothing can own the file otherwise.
    const order = calls.map(c => c.url)
    expect(order[0]).toContain('/api/listing-intake')
  })

  /**
   * The parent's React state has not re-rendered when the first upload fires,
   * so reading the token from props would send an empty header on exactly the
   * request that matters. ensureIntake returns the credential with the id.
   */
  it('sends the token on the very first upload', async () => {
    routes['/api/listing-screenshots'] = { ok: true, duplicate: false, count: 1 }
    render(<ListingIntakeForm />)
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [file()] } })

    await waitFor(
      () => expect(calls.some(c => c.url.includes('/api/listing-screenshots'))).toBe(true),
      { timeout: 5000 },
    )
    const upload = calls.find(c => c.url.includes('/api/listing-screenshots'))!
    const headers = upload.init?.headers as Record<string, string>
    expect(headers['x-paqar-intake-token']).toBe('tok_secret_value')
  })

  it('re-extracts after upload so one summary appears', async () => {
    routes['/api/listing-screenshots'] = { ok: true, duplicate: false, count: 1 }
    render(<ListingIntakeForm />)
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [file()] } })

    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })
    expect(screen.getByText(/Honda · City · 2019/)).toBeTruthy()
  })

  it('never shows storage or HTTP language when an upload fails', async () => {
    delete routes['/api/listing-screenshots']   // -> 404
    render(<ListingIntakeForm />)
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [file()] } })

    await waitFor(
      () => expect(calls.some(c => c.url.includes('/api/listing-screenshots'))).toBe(true),
      { timeout: 5000 },
    )
    const body = document.body.textContent ?? ''
    for (const leak of ['404', 'storage', 'bucket', 'HTTP']) {
      expect(body, `leaked "${leak}"`).not.toContain(leak)
    }
  })
})

/**
 * The wait must look like a wait.
 *
 * It was a single 13px grey line, and in a real browser a buyer could not tell
 * anything was happening — reported directly from testing the deployed preview.
 * Reading a listing is a URL fetch plus an OCR call, up to a minute cold, so an
 * invisible spinner means people paste again or give up.
 */
describe('the loading state is visible', () => {
  /** Extraction is deliberately slow so the loading state can be observed. */
  function slowExtract() {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      calls.push({ url: u, init })
      if (u.includes('/extract')) {
        await new Promise(r => setTimeout(r, 120))
        return { ok: true, status: 200, json: async () => ({ summary: SUMMARY, ready: true, needScreenshots: false, ocrUnavailable: false }) }
      }
      if (u.includes('/api/listing-screenshots')) {
        return { ok: true, status: 200, json: async () => ({ ok: true, duplicate: false, count: 1 }) }
      }
      return { ok: true, status: 200, json: async () => ({ intakeId: 'intake_1', token: 'tok_secret_value' }) }
    }))
  }

  /** Uploads without touching `routes` — this suite owns its own stub. */
  const upload = () =>
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [pngFile()] } })

  it('announces itself to assistive tech', async () => {
    slowExtract()
    render(<ListingIntakeForm />)
    upload()

    const live = await screen.findByRole('status', undefined, { timeout: 5000 })
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toMatch(/Sedang baca iklan/i)
  })

  /** A buyer told "up to a minute" waits; one shown nothing assumes it broke. */
  it('sets an honest expectation about how long it takes', async () => {
    slowExtract()
    render(<ListingIntakeForm />)
    upload()

    const live = await screen.findByRole('status', undefined, { timeout: 5000 })
    expect(live.textContent).toMatch(/seminit/i)
    expect(live.textContent).toMatch(/Jangan tutup/i)
  })

  it('renders a spinner that respects reduced motion', async () => {
    slowExtract()
    render(<ListingIntakeForm />)
    upload()

    const live = await screen.findByRole('status', undefined, { timeout: 5000 })
    const spinner = live.querySelector('.animate-spin')
    expect(spinner, 'no spinner rendered').toBeTruthy()
    expect(spinner!.className).toContain('motion-reduce:animate-none')
  })

  /** Re-pasting mid-extraction starts a second run against the same intake. */
  it('locks the URL field while reading', async () => {
    slowExtract()
    render(<ListingIntakeForm />)
    upload()

    await screen.findByRole('status', undefined, { timeout: 5000 })
    expect((screen.getByLabelText(/Tampal link iklan/i) as HTMLInputElement).disabled).toBe(true)
  })

  it('clears once the summary lands', async () => {
    slowExtract()
    render(<ListingIntakeForm />)
    upload()

    await screen.findByText(/Paqar akan semak/i, undefined, { timeout: 5000 })
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByLabelText(/Tampal link iklan/i) as HTMLInputElement).disabled).toBe(false)
  })
})


/**
 * Screenshots are the PRIMARY input, and the order on screen says so.
 *
 * Most Malaysian buyers are on a phone, where screenshotting is one gesture and
 * copying a link is three. Screenshots are also the only path that works for
 * Carlist and Facebook, which no service can read.
 */
describe('screenshots lead', () => {
  it('renders the upload above the link field', () => {
    render(<ListingIntakeForm />)
    const body = document.body.innerHTML
    expect(body.indexOf('li-shots')).toBeLessThan(body.indexOf('li-url'))
  })

  it('labels the upload as the easy path and the link as an alternative', () => {
    render(<ListingIntakeForm />)
    expect(screen.getByText(/Muat naik screenshot iklan/i)).toBeTruthy()
    expect(screen.getByText(/Cara paling senang/i)).toBeTruthy()
    expect(screen.getByText(/^atau$/)).toBeTruthy()
    expect(screen.getByLabelText(/^Tampal link iklan$/i)).toBeTruthy()
  })
})
