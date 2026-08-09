import { describe, it, expect, vi } from 'vitest'
import { coveredYearSlugs, MARKET_COVERAGE } from '@/lib/market-coverage'
import { parseSlug } from '@/lib/year-model-slug'

// The page module is server-only and reaches the DB layer at import time.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { SCRAPER_URL: '', SCRAPER_API_KEY: '' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient:       () => ({ from: () => ({}) }),
  createCachedServiceClient: () => ({ from: () => ({}) }),
}))

const { generateStaticParams } = await import('@/app/harga-model/[slug]/page')

describe('year page generateStaticParams', () => {
  it('returns exactly the ordered coverage slug list', () => {
    // Full ordered comparison against the same source the sitemap and the
    // warm-cache cron read. A page prerendered here that the cron never warms
    // would build empty and stay empty until someone checked that exact car.
    expect(generateStaticParams()).toEqual(coveredYearSlugs().map((slug) => ({ slug })))
  })

  it('prerenders 58 year pages', () => {
    expect(generateStaticParams()).toHaveLength(58)
  })

  it('contains no duplicate slug', () => {
    const slugs = generateStaticParams().map(p => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('emits params the page parser actually accepts', () => {
    // The route sees the REWRITTEN slug ('city-2021'), not the public path
    // ('/harga-city-2021'). A param the parser rejects would notFound() at
    // build time, so this is the contract between the two.
    for (const { slug } of generateStaticParams()) {
      expect(parseSlug(slug), `parseSlug rejected '${slug}'`).not.toBeNull()
    }
  })

  it('parses hyphenated model keys correctly', () => {
    // 'hr-v-2023' must split as modelKey 'hr-v' + year '2023', not 'hr' + …
    expect(parseSlug('hr-v-2023')).toEqual({ modelKey: 'hr-v', year: '2023' })
    expect(generateStaticParams()).toContainEqual({ slug: 'hr-v-2023' })
  })

  it('every generated slug maps to a model the coverage list declares', () => {
    const yearKeys = new Set(MARKET_COVERAGE.map(m => m.yearKey))
    for (const { slug } of generateStaticParams()) {
      const parsed = parseSlug(slug)!
      expect(yearKeys.has(parsed.modelKey), `${slug} → unknown model '${parsed.modelKey}'`).toBe(true)
    }
  })

  it('every generated slug is a year the cron actually warms for that model', () => {
    const warm = new Set(
      MARKET_COVERAGE.flatMap(m => m.years.map(y => `${m.yearKey}-${y}`)),
    )
    for (const { slug } of generateStaticParams()) {
      expect(warm.has(slug), `${slug} is prerendered but never warmed`).toBe(true)
    }
  })

  it('matches the year-page URLs the sitemap declares', () => {
    const fromParams  = generateStaticParams().map(p => `/harga-${p.slug}`).sort()
    const fromSitemap = coveredYearSlugs().map(s => `/harga-${s}`).sort()
    expect(fromParams).toEqual(fromSitemap)
  })
})
