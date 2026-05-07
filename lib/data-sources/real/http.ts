const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
}

/**
 * Fetch a government portal page/form with browser-like headers and a timeout.
 * Returns null on any network error, timeout, or non-2xx response — never throws.
 */
export async function govFetch(
  url:       string,
  init:      RequestInit = {},
  timeoutMs: number      = 10_000,
): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      signal:  controller.signal,
      headers: { ...BROWSER_HEADERS, ...init.headers },
    })
    clearTimeout(timer)
    return res.ok ? res : null
  } catch {
    clearTimeout(timer)
    return null
  }
}

/**
 * Extract a hidden form field value from an HTML string.
 * Used to capture CSRF tokens before form submission.
 */
export function extractInputValue(html: string, name: string): string | null {
  const re = new RegExp(`<input[^>]+name=["']${name}["'][^>]+value=["']([^"']*)["']`, 'i')
  const m  = re.exec(html) ?? new RegExp(`<input[^>]+value=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i').exec(html)
  return m?.[1] ?? null
}

/** Strip HTML tags and decode basic HTML entities. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}
