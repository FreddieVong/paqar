// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scrubUrl, scrubEvent } from '@/lib/sentry-scrub'
import type { ErrorEvent } from '@sentry/nextjs'

/**
 * A claim_token must never reach Sentry.
 *
 * It is not analytics decoration — it is the credential the paid report
 * authorises on, and it lives in the QUERY STRING of every report URL:
 *
 *   /laporan-pembeli/ch_abc123?claim_token=6f1e...
 *
 * The previous beforeSend walked only `event.request.data`, so any error on a
 * report page shipped a live, working credential to Sentry: in the issue's URL
 * field, in the next request's Referer, and in every navigation breadcrumb.
 * Anyone who could read the Sentry project could open a customer's paid report.
 */

const TOKEN = '6f1e2d3c-4b5a-6789-0abc-def012345678'
const ev = (e: Partial<ErrorEvent>) => scrubEvent(e as ErrorEvent)

describe('scrubUrl', () => {
  it('redacts the claim token from an absolute URL', () => {
    const out = scrubUrl(`https://paqar.my/laporan-pembeli/ch_1?claim_token=${TOKEN}`)
    expect(out).not.toContain(TOKEN)
    expect(out).toContain('claim_token=%5BFiltered%5D')
  })

  it('keeps a relative URL relative', () => {
    const out = scrubUrl(`/laporan-pembeli/ch_1?claim_token=${TOKEN}&source=plate`)
    expect(out.startsWith('/laporan-pembeli/ch_1')).toBe(true)
    expect(out).not.toContain(TOKEN)
    // Non-sensitive parameters survive — they are what makes the report useful.
    expect(out).toContain('source=plate')
  })

  it('redacts a plate and leaves the rest of the path intact', () => {
    const out = scrubUrl('/check/ch_1?plate=WXY1234&asking_price=45000')
    expect(out).not.toContain('WXY1234')
    expect(out).toContain('asking_price=45000')
  })

  it('leaves a clean URL byte-identical', () => {
    const clean = 'https://paqar.my/harga-myvi-2021'
    expect(scrubUrl(clean)).toBe(clean)
  })

  it('still redacts something that is not a parseable URL', () => {
    const out = scrubUrl(`navigated to ?claim_token=${TOKEN} from home`)
    expect(out).not.toContain(TOKEN)
  })

  it('handles an empty value', () => {
    expect(scrubUrl('')).toBe('')
  })
})

describe('scrubEvent covers every field a token travels in', () => {
  it('redacts request.url', () => {
    const out = ev({ request: { url: `https://paqar.my/laporan-pembeli/ch_1?claim_token=${TOKEN}` } })
    expect(JSON.stringify(out)).not.toContain(TOKEN)
  })

  it('redacts a string query_string', () => {
    const out = ev({ request: { query_string: `claim_token=${TOKEN}&source=plate` } })
    expect(JSON.stringify(out)).not.toContain(TOKEN)
    expect(out.request!.query_string).toContain('source=plate')
  })

  it('redacts an object query_string', () => {
    const out = ev({ request: { query_string: { claim_token: TOKEN, source: 'plate' } as never } })
    expect(JSON.stringify(out)).not.toContain(TOKEN)
  })

  it('redacts the Referer header, whatever its casing', () => {
    for (const header of ['Referer', 'referer']) {
      const out = ev({ request: { headers: { [header]: `https://paqar.my/laporan-pembeli/ch_1?claim_token=${TOKEN}` } } })
      expect(JSON.stringify(out), header).not.toContain(TOKEN)
    }
  })

  it('redacts navigation breadcrumbs', () => {
    const out = ev({
      breadcrumbs: [
        { category: 'navigation', data: { from: '/', to: `/laporan-pembeli/ch_1?claim_token=${TOKEN}` } },
        { category: 'console', message: `fetching /api/checks/ch_1?claim_token=${TOKEN}` },
      ],
    })
    expect(JSON.stringify(out)).not.toContain(TOKEN)
  })

  it('still redacts the request body it always did', () => {
    const out = ev({ request: { data: { plate: 'WXY1234', claim_token: TOKEN, brand: 'Perodua' } } })
    const data = out.request!.data as Record<string, unknown>
    expect(data.plate).toBe('[Filtered]')
    expect(data.claim_token).toBe('[Filtered]')
    // Non-sensitive fields must survive, or the report becomes undebuggable.
    expect(data.brand).toBe('Perodua')
  })

  it('redacts the newer PII columns too', () => {
    const out = ev({ request: { data: { buyer_phone: '60123456789', lead_email: 'a@b.com', plate_hash: 'deadbeef' } } })
    const data = out.request!.data as Record<string, unknown>
    expect(data.buyer_phone).toBe('[Filtered]')
    expect(data.lead_email).toBe('[Filtered]')
    expect(data.plate_hash).toBe('[Filtered]')
  })

  it('leaves an event with nothing sensitive untouched', () => {
    const out = ev({ request: { url: 'https://paqar.my/harga-myvi-2021' }, extra: { cohortSize: 12 } })
    expect(out.request!.url).toBe('https://paqar.my/harga-myvi-2021')
    expect((out.extra as Record<string, unknown>).cohortSize).toBe(12)
  })

  it('drops the event rather than transmitting it un-scrubbed if it throws', () => {
    // Returning a partially-scrubbed event on failure would be the one outcome
    // worse than losing the report.
    const hostile = { get request() { throw new Error('boom') } } as unknown as ErrorEvent
    expect(scrubEvent(hostile)).toBeNull()
  })
})

describe('both Sentry configs use the shared scrubber', () => {
  it('neither reimplements its own beforeSend', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = join(__dirname, '..', '..')
    for (const f of ['sentry.client.config.ts', 'sentry.server.config.ts']) {
      const src = readFileSync(join(root, f), 'utf-8')
      expect(src, f).toContain('beforeSend: scrubEvent')
      expect(src, f).not.toMatch(/beforeSend\(event\)\s*\{/)
    }
  })
})

describe('the server SDK is actually initialised', () => {
  /**
   * @sentry/nextjs v8+ stopped injecting sentry.server.config.ts through
   * webpack. The file is loaded ONLY because instrumentation.ts imports it, and
   * its absence is completely silent: Sentry.init() never runs, captureException
   * becomes a no-op, Sentry.flush() resolves false, and every server-side
   * exception vanishes. Confirmed in production on 2026-08-09 — the scrubber was
   * present in 2 client bundles and 0 server bundles, so the payment webhook,
   * receipt delivery and report-page errors had never reached Sentry.
   *
   * The client config is still auto-detected, which is exactly why the gap was
   * invisible: browser errors worked the whole time.
   */
  it('instrumentation.ts imports the server config', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'instrumentation.ts'), 'utf-8')
    expect(src).toMatch(/import\(['"]\.\/sentry\.server\.config['"]\)/)
  })

  it('imports it inside the nodejs runtime guard', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'instrumentation.ts'), 'utf-8')
    const block = src.split("NEXT_RUNTIME === 'nodejs'")[1] ?? ''
    expect(block).toContain('sentry.server.config')
  })

  it('initialises Sentry before validating env, so a startup failure is reportable', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'instrumentation.ts'), 'utf-8')
    expect(src.indexOf('sentry.server.config')).toBeLessThan(src.indexOf('./lib/env'))
  })
})

describe('all three runtimes are covered', () => {
  const root = join(__dirname, '..', '..')
  const instrumentation = readFileSync(join(root, 'instrumentation.ts'), 'utf-8')

  it('an edge config exists and uses the shared scrubber', () => {
    const src = readFileSync(join(root, 'sentry.edge.config.ts'), 'utf-8')
    expect(src).toContain('beforeSend: scrubEvent')
    expect(src).not.toMatch(/beforeSend\(event\)\s*\{/)
  })

  it('instrumentation loads it under the edge runtime guard', () => {
    // Nothing imports the edge config implicitly. Without this line an
    // exception in middleware — which runs on every non-static, non-API
    // request — is silently discarded.
    const block = instrumentation.split("NEXT_RUNTIME === 'edge'")[1] ?? ''
    expect(block).toContain('sentry.edge.config')
  })

  it('keeps middleware off the tracing path', () => {
    // Middleware is the hottest code in the app. Sampling traces there would
    // add overhead to every page view to measure the least interesting work.
    // Errors are what was missing; traces are not worth the cost here.
    const src = readFileSync(join(root, 'sentry.edge.config.ts'), 'utf-8')
    expect(src).toMatch(/tracesSampleRate:\s*0\b/)
  })

  it('the scrubber uses no Node built-ins, so it runs on Edge', () => {
    // URL, URLSearchParams and RegExp only. A node:crypto or node:fs import
    // here would fail the Edge build rather than degrade quietly.
    const src = readFileSync(join(root, 'lib/sentry-scrub.ts'), 'utf-8')
    expect(src).not.toMatch(/from\s+['"]node:/)
    expect(src).not.toMatch(/require\(['"]node:/)
  })

  it('every runtime config routes through the one scrubber', () => {
    for (const f of ['sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']) {
      expect(readFileSync(join(root, f), 'utf-8'), f).toContain('beforeSend: scrubEvent')
    }
  })
})
