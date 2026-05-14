import { withPage } from '../browser.js'

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
  // "Q5 TFSI STANDARD" → "Q5", "730Li" → "730"
  return model.match(/^\d+/)?.[0] ?? model.split(/[\s-]/)[0] ?? model
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
          for (const item of items.slice(0, 10)) {
            const i = item as Record<string, unknown>
            const price = Number(i?.price ?? i?.asking_price ?? 0)
            if (!price || price < 1000) continue
            captured.push({
              price,
              title:   String(i?.name ?? i?.title ?? '').slice(0, 100),
              url:     i?.url ? String(i.url) : `https://www.mudah.my/m/${i?.adid ?? ''}`,
              year:    String(i?.year ?? i?.manufacture_year ?? '').slice(0, 4) || null,
              mileage: i?.mileage ? String(i.mileage) : null,
            })
          }
        } catch { /* non-fatal */ }
      })

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })

      // Wait briefly for API responses to arrive
      await page.waitForTimeout(3_000)

      if (captured.length > 0) {
        listings.push(...captured.slice(0, 5))
        return
      }

      // Fallback: parse DOM for RM prices in listing links
      const extracted = await page.evaluate(() => {
        const results: { price: number; title: string; url: string }[] = []
        document.querySelectorAll('a[href]').forEach((el) => {
          const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
          const priceMatch = text.match(/RM\s*([\d,]+)/)
          if (!priceMatch) return
          const price = parseInt((priceMatch[1] ?? '').replace(/,/g, ''), 10)
          if (!price || price < 5_000 || price > 2_000_000) return
          const href = (el as HTMLAnchorElement).href
          if (!href.includes('mudah.my')) return
          results.push({ price, title: text.slice(0, 100), url: href })
        })
        return results.slice(0, 10)
      })

      for (const item of extracted) {
        listings.push({
          price:   item.price,
          title:   item.title,
          url:     item.url,
          year:    item.title.match(/\b(19|20)\d{2}\b/)?.[0] ?? null,
          mileage: item.title.match(/([\d,]+)\s*km/i)?.[1] ?? null,
        })
      }
    })
  } catch (err) {
    return { listings: [], searchUrl, error: String(err) }
  }

  // Deduplicate by price, keep cheapest first
  const seen = new Set<number>()
  const deduped = listings.filter(l => {
    if (seen.has(l.price)) return false
    seen.add(l.price)
    return true
  }).sort((a, b) => a.price - b.price).slice(0, 5)

  return { listings: deduped, searchUrl }
}
