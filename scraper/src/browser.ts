import { chromium, type Browser, type BrowserContext } from 'playwright'

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
]

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser
  browser = await chromium.launch({
    headless: true,
    args: BROWSER_ARGS,
  })
  browser.on('disconnected', () => { browser = null })
  return browser
}

export async function newContext(): Promise<BrowserContext> {
  const b = await getBrowser()
  return b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ms-MY',
    extraHTTPHeaders: {
      'Accept-Language': 'ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  })
}

/** Run scraper fn inside a fresh context, always close it afterwards. */
export async function withPage<T>(
  fn: (page: import('playwright').Page) => Promise<T>
): Promise<T> {
  const ctx  = await newContext()
  const page = await ctx.newPage()
  try {
    return await fn(page)
  } finally {
    await ctx.close().catch(() => {})
  }
}
