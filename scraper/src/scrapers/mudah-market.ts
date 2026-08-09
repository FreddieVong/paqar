import { withPage }     from '../browser.js'
import { dedupeAndCap } from './listing-utils.js'

export interface MarketListing {
  price:   number
  title:   string
  url:     string
  year:    string | null
  mileage: string | null
}

/**
 * TODO — capture a stable SELLER IDENTITY. Not yet implemented; note only.
 *
 * WHY
 *
 * Paqar reports confidence from the number of comparables, but what a buyer
 * actually wants to know is how many INDEPENDENT sellers are asking that price.
 * Ten listings from one dealer's forecourt is one opinion about the market, not
 * ten. Today the two are indistinguishable, so confidence overstates itself
 * whenever a dealer holds several of the same model.
 *
 * WHAT IS MISSING
 *
 * The title carries the seller TYPE — "Verified Dealer", "Direct Owner",
 * "Mudah Certified" — and nothing else. There is no identity, so two dealers
 * advertising the same physical car and two genuinely separate cars look
 * identical downstream. lib/comparables.ts can therefore only collapse exact
 * REPOSTS (same slug + price + mileage band + transmission), which measured at
 * 3 listings in 833. Seller-level weighting is not implementable app-side.
 *
 * WHAT TO CAPTURE
 *
 * This scraper already intercepts Mudah's listing JSON (see the response
 * handler below) and discards everything except the five fields above. The
 * seller fields are almost certainly already in that payload. Log one raw
 * listing object and look for, in order of preference:
 *
 *   1. a numeric account/store/seller id — stable across reposts and renames;
 *   2. the seller's store URL — stable, and derivable into an id;
 *   3. the shop/company display NAME — usable but weakest: dealers rename, and
 *      "Direct Owner" listings share a blank or generic value, so a null and an
 *      empty string must never be treated as the same seller.
 *
 * ACCEPTANCE
 *
 * The field must be stable across two scrapes a week apart for a listing that
 * has not changed, and must differ between two listings known to be from
 * different dealers. Anything that fails either test will silently merge
 * sellers, which is worse than the current overcount.
 *
 * INTERACTION WITH THE CAP
 *
 * dedupeAndCap() caps each cohort at 15. Once sellers are known, the cap should
 * arguably apply per seller rather than per cohort — otherwise one dealer with
 * 15 cars can still fill a cohort on its own and seller counting will just
 * report "1".
 */

export interface MudahMarketResult {
  listings:  MarketListing[]
  searchUrl: string
  error?:    string
  debug?: {
    pageTitle:  string
    pageUrl:    string
    priceCount: number
    jsonSeen:   number
    domFound:   number
    bodyText:   string
  }
}

function cleanKeyword(model: string): string {
  // "730Li" → "730", "Q5 TFSI" → "Q5", "7 Series" → "7 Series" (kept whole when numeric prefix is short)
  const numPrefix = model.match(/^\d+/)?.[0]
  if (numPrefix && numPrefix.length >= 3) return numPrefix  // "730", "320" etc. — specific enough
  return model.split(/[\s-]/)[0] ?? model                  // first word: "Q5", "COOPER", "7" (will be length-filtered)
}

export async function scrapeMudahMarket(
  make: string,
  model: string,
  year: string,
  debug = false,
): Promise<MudahMarketResult> {
  const keyword   = [make, cleanKeyword(model), year].filter(Boolean).join(' ')
  const searchUrl = `https://www.mudah.my/Malaysia/Cars-for-sale?q=${encodeURIComponent(keyword)}`
  const listings: MarketListing[] = []
  const diag = { pageTitle: '', pageUrl: '', priceCount: 0, jsonSeen: 0, domFound: 0, bodyText: '' }

  try {
    await withPage(async (page) => {
      // Intercept any JSON API responses that contain listing prices
      const captured: MarketListing[] = []
      page.on('response', async (response) => {
        if (!response.url().includes('mudah') || response.status() !== 200) return
        const ct = response.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        try {
          const json = await response.json() as Record<string, unknown>
          // Mudah API response shape: { data: { listings: [ { price, name, adid, ... } ] } }
          const items: unknown[] =
            (json?.data as Record<string,unknown>)?.listings as unknown[] ??
            json?.listings as unknown[] ??
            json?.results as unknown[] ?? []
          if (items.length) diag.jsonSeen += items.length
          for (const item of items.slice(0, 30)) {
            const i     = item as Record<string, unknown>
            const price = Number(i?.price ?? i?.asking_price ?? 0)
            if (!price || price < 5_000 || price > 2_000_000) continue
            // Try all common field names for listing title
            const title = String(i?.subject ?? i?.name ?? i?.title ?? i?.headline ?? '')
            captured.push({
              price,
              title:   title.slice(0, 100),
              url:     i?.url ? String(i.url) : `https://www.mudah.my/m/${i?.adid ?? ''}`,
              year:    String(i?.year ?? i?.manufacture_year ?? '').slice(0, 4) || null,
              mileage: i?.mileage ? String(i.mileage) : null,
            })
          }
        } catch { /* non-fatal */ }
      })

      // 'load' fires once all resources are loaded; then wait for listings to render
      await page.goto(searchUrl, { waitUntil: 'load', timeout: 25_000 })

      // Mudah hydrates result cards progressively, and on a slow container a
      // fixed wait reads the DOM mid-render (Railway captured 2 cards where a
      // local run captured 12). Poll the RM-price count until it stops growing
      // for 2 consecutive polls, capped at 20s.
      let priceCount = 0
      for (let i = 0, prev = -1, stable = 0; i < 20 && stable < 2; i++) {
        await new Promise(r => setTimeout(r, 1_000))
        priceCount = await page.evaluate(
          () => document.body?.innerText?.match(/RM\s?[\d,]{4,}/g)?.length ?? 0
        ).catch(() => 0)
        if (priceCount === prev && priceCount > 0) stable++
        else { stable = 0; prev = priceCount }
      }

      // Log what page we actually got — helps diagnose blocks/captchas
      const pageTitle = await page.title()
      const pageUrl   = page.url()
      diag.pageTitle  = pageTitle
      diag.pageUrl    = pageUrl
      diag.priceCount = priceCount
      if (debug) diag.bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 600) ?? '').catch(() => '')
      console.log('[mudah-market] page:', pageTitle, pageUrl, 'rm-prices:', priceCount)

      if (captured.length > 0) {
        // Higher cap: consumption-side year/outlier filters discard non-matching
        // listings, so more raw captures = more true comparables surviving
        listings.push(...captured.slice(0, 25))
        return
      }

      const makeKw  = make.split(/[\s-]/)[0].toUpperCase()
      const modelKw = cleanKeyword(model).toUpperCase()

      // Fallback: parse DOM — walk up from each link to find card context with price
      const extracted = await page.evaluate(
        ([mkw, mdkw]: [string, string]) => {
          const results: { price: number; title: string; url: string }[] = []
          const seen = new Set<string>()

          document.querySelectorAll('a[href]').forEach((el) => {
            const href = (el as HTMLAnchorElement).href
            if (!href || href === window.location.href) return
            // Skip nav/footer/non-listing links
            if (/\?(q=|cat=|type=)/.test(href) && !href.match(/adid|\/m\//)) return

            // Walk up to find a card with an RM price
            let context = ''
            let node: HTMLElement | null = el as HTMLElement
            for (let i = 0; i < 6 && node; i++) {
              const t = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
              if (/RM\s*[\d,]+/.test(t) && t.length < 500) { context = t; break }
              node = node.parentElement
            }
            if (!context) return

            // Comma-grouped so a glued year ("RM 40,5002018") doesn't get
            // swallowed into a 405002018 garbage price — mirrors parsePrice()
            // in listing-utils.ts (tested; can't be imported into evaluate)
            const priceMatch = context.match(/RM\s*(\d{1,3}(?:,\d{3})+)/)
            if (!priceMatch) return
            const price = parseInt((priceMatch[1] ?? '').replace(/,/g, ''), 10)
            if (!price || price < 5_000 || price > 2_000_000) return

            // Context must mention make; and model if keyword is long enough to be specific
            const upper = context.toUpperCase()
            if (!upper.includes(mkw)) return
            if (mdkw.length >= 2 && !upper.includes(mdkw)) return

            if (seen.has(href)) return
            seen.add(href)
            results.push({ price, title: context.slice(0, 120), url: href })
          })
          return results.slice(0, 25)
        },
        [makeKw, modelKw] as [string, string]
      )
      diag.domFound = extracted.length

      // Also log raw HTML snippet for debugging if nothing found
      if (extracted.length === 0) {
        const snippet = await page.evaluate(() => document.body?.innerHTML?.slice(0, 500) ?? '')
        console.log('[mudah-market] dom snippet:', snippet)
      }

      for (const item of extracted) {
        listings.push({
          price:   item.price,
          title:   item.title,
          url:     item.url,
          // Mudah titles glue year to neighbouring text — try free-standing
          // year first, then year-followed-by-cc ("...699992021 1329cc"),
          // then year-followed-by-transmission ("...18RIM2011Auto80k-85k")
          year:    item.title.match(/\b(19|20)\d{2}\b/)?.[0]
                ?? item.title.match(/((?:19|20)\d{2})(?=\d{3,4}\s*cc)/i)?.[1]
                ?? item.title.match(/((?:19|20)\d{2})(?=\s*(?:auto|manual))/i)?.[1]
                ?? null,
          mileage: item.title.match(/([\d,]+)\s*km/i)?.[1] ?? null,
        })
      }
    })
  } catch (err) {
    return { listings: [], searchUrl, error: String(err), debug: debug ? diag : undefined }
  }

  return { listings: dedupeAndCap(listings), searchUrl, debug: debug ? diag : undefined }
}
