import 'server-only'
import { screenUrl } from '@/lib/listing-fetch'
import { extractFromHtml, type ExtractedListing } from '@/lib/listing-extract'

/**
 * Read one listing page through the scraper service.
 *
 * ── WHY NOT FROM HERE ──────────────────────────────────────────────────────
 *
 * Vercel cannot read these pages: Mudah returns 403 to non-browser clients and
 * its robots.txt forbids automated access. The scraper service already runs a
 * real browser against Mudah for comparables — the pipeline the coverage gate
 * depends on — so reading one advert is access it already performs, not new
 * access invented here.
 *
 * ── SSRF IS STILL SCREENED HERE ────────────────────────────────────────────
 *
 * Handing a stranger's URL to another service does not remove the problem, it
 * moves it. screenUrl runs first — scheme, credentials, host allowlist, literal
 * private addresses — so the scraper is never asked to fetch something the app
 * would itself refuse. The scraper re-checks the host independently, because a
 * service that trusts its caller is one bug away from being an open proxy.
 *
 * ── THE URL IS NEVER LOGGED ────────────────────────────────────────────────
 *
 * It identifies the specific car a specific buyer is considering. Only outcomes
 * are recorded, here and in the scraper.
 */

const TIMEOUT_MS = 30_000

export type ScrapeOutcome =
  | { ok: true;  extracted: ExtractedListing }
  | { ok: false; reason: 'unsupported' | 'unreachable' | 'blocked' | 'timeout'
                       | 'not_configured' | 'not_authorised' }

export async function extractListingViaScraper(rawUrl: string): Promise<ScrapeOutcome> {
  const screened = screenUrl(rawUrl)
  if (!screened.ok) return { ok: false, reason: 'unsupported' }

  const base = process.env.SCRAPER_URL
  const key  = process.env.SCRAPER_API_KEY
  if (!base || !key) return { ok: false, reason: 'not_configured' }

  let payload: { ok?: boolean; title?: string; text?: string; meta?: Record<string, string>; error?: string }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/extract/listing`, {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body:    JSON.stringify({ url: screened.url.toString() }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })
    // A WRONG KEY IS NOT AN OUTAGE, and folding it into 'unreachable' cost
    // real time: the service answers /health perfectly while every authed
    // route 401s, so it looks alive and behaves dead. Only the log can tell
    // the operator which it is, so it says so — loudly, because nothing
    // self-heals from a stale credential.
    if (res.status === 401 || res.status === 403) {
      console.error('[listing-scraper] scraper rejected our API key', {
        status: res.status,
        hint: 'SCRAPER_API_KEY must equal the API_KEY set on the Railway service',
      })
      return { ok: false, reason: 'not_authorised' }
    }
    // 404 means the endpoint is not deployed, which is also a deployment fact
    // rather than an outage — the service is up, this route is not on it.
    if (res.status === 404) {
      console.error('[listing-scraper] /extract/listing is not deployed on the scraper', {
        hint: 'redeploy the scraper; check /health version',
      })
      return { ok: false, reason: 'not_configured' }
    }
    if (!res.ok) return { ok: false, reason: res.status === 400 ? 'unsupported' : 'unreachable' }
    payload = await res.json()
  } catch (err) {
    return { ok: false, reason: (err as Error).name === 'TimeoutError' ? 'timeout' : 'unreachable' }
  }

  if (!payload.ok) {
    return { ok: false, reason: payload.error?.startsWith('http_4') ? 'blocked' : 'unreachable' }
  }

  // Rebuild a minimal document so ONE extractor serves both paths. A second
  // parser for scraper output would drift from the first, and the rules that
  // stop a monthly instalment becoming an asking price live in that one.
  //
  // ONE og:description, not two.
  //
  // The site's own tags were emitted first and the page text appended after as
  // a second og:description — and lib/listing-extract's meta() takes the FIRST
  // match. So on every site that publishes an og:description of its own (which
  // is most of them) the page text was shadowed and never read. Measured on a
  // real Mudah advert: brand, model and price came through from the curated
  // description while the year and the mileage, both present in the page text
  // twelve words later, came back missing — and year is required for coverage,
  // so the buyer was asked to type in details Paqar already had.
  //
  // The two are merged instead of one replacing the other. The site's
  // description is curated and higher signal; the page text is richer. Losing
  // either costs a field.
  const siteMeta = Object.entries(payload.meta ?? {})
    .filter(([k]) => k.toLowerCase() !== 'og:description')
  const metaTags = siteMeta
    .map(([k, v]) => `<meta property="${esc(k)}" content="${esc(v)}">`)
    .join('\n')
  const siteDescription = payload.meta?.['og:description'] ?? ''
  const description = `${siteDescription} ${(payload.text ?? '').slice(0, 1500)}`.trim()
  const html = `<html><head><title>${esc(payload.title ?? '')}</title>${metaTags}`
    + `<meta property="og:description" content="${esc(description)}">`
    + `</head><body></body></html>`

  return { ok: true, extracted: extractFromHtml(html) }
}

/** Values come from a third-party page — never interpolated raw. */
function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
