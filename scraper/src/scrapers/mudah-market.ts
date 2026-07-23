import { withPage }     from '../browser.js'
import { dedupeAndCap } from './listing-utils.js'

export interface MarketListing {
  price:   number
  title:   string
  url:     string
  year:    string | null
  mileage: string | null
}

export interface MudahMarketResult {
  listings:  MarketListing[]
  searchUrl: string
  error?:    string
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
): Promise<MudahMarketResult> {
  const keyword   = [make, cleanKeyword(model), year].filter(Boolean).join(' ')
  const searchUrl = `https://www.mudah.my/Malaysia/Cars-for-sale?q=${encodeURIComponent(keyword)}`
  const listings: MarketListing[] = []

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

            const priceMatch = context.match(/RM\s*([\d,]+)/)
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
    return { listings: [], searchUrl, error: String(err) }
  }

  return { listings: dedupeAndCap(listings), searchUrl }
}
