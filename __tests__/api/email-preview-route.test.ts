import { describe, it, expect, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

function setNodeEnv(value: string) {
  vi.stubEnv('NODE_ENV', value)
}

async function get(url: string) {
  // Re-import per call so the route reads the stubbed NODE_ENV.
  const { GET } = await import('@/app/api/dev/email-preview/route')
  return GET(new NextRequest(url))
}

describe('dev e-mail preview route', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('404s in production so the route never answers on a deployed site', async () => {
    setNodeEnv('production')
    const res = await get('http://localhost/api/dev/email-preview')
    expect(res.status).toBe(404)
  })

  it('renders the retarget e-mail in development', async () => {
    setNodeEnv('development')
    const res = await get('http://localhost/api/dev/email-preview')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).toContain('JUF222')
    expect(html).toContain('Semak JUF222')
  })

  it('uppercases a plate passed in the query string', async () => {
    setNodeEnv('development')
    const html = await (await get('http://localhost/api/dev/email-preview?plate=wxy1234')).text()
    expect(html).toContain('WXY1234')
    expect(html).not.toContain('JUF222')
  })

  it('renders the no-plate fallback when plate is empty', async () => {
    setNodeEnv('development')
    const html = await (await get('http://localhost/api/dev/email-preview?plate=')).text()
    expect(html).toContain('tentang kereta ini?')
    expect(html).not.toContain('NO.&nbsp;PENDAFTARAN')
  })
})
