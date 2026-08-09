// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MODEL_HUB_SLUGS } from '@/lib/model-hubs'
import { coveredYearSlugs } from '@/lib/market-coverage'

/**
 * Every URL in the sitemap must resolve to a page that exists.
 *
 * scripts/seo-check.mjs already checks that no sitemap URL is robots-disallowed,
 * but nothing checked that the URLs resolve at all — and most of the file is
 * hand-typed slug arrays (comparisons, FAQ guides, variant guides, brand hubs).
 * A renamed or deleted page leaves a URL here that answers 404, which is the
 * worst thing to hand a crawler: it spends budget on it and learns to trust the
 * sitemap less.
 *
 * Static routes are resolved against the app/ directory. Dynamic ones are
 * resolved against the exact generator each route uses, so this test fails if a
 * sitemap entry and its generateStaticParams ever disagree.
 */

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { SCRAPER_URL: '', SCRAPER_API_KEY: '' } }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient:       () => ({ from: () => ({}) }),
  createCachedServiceClient: () => ({ from: () => ({}) }),
}))

const sitemap = (await import('@/app/sitemap')).default
const { VARIANT_GUIDES } = await import('@/lib/variant-guides')
const comparisonParams = (await import('@/app/bandingkan/[slug]/page')).generateStaticParams

const ROOT    = join(__dirname, '..', '..')
const APP_DIR = join(ROOT, 'app')
const ORIGIN  = 'https://paqar.my'

/** Static routes: an app/ directory holding a page.tsx, ignoring dynamic segments. */
function staticRoutes(): Set<string> {
  const routes = new Set<string>(['/'])
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (!statSync(full).isDirectory()) continue
      // [slug] segments are covered by the generator checks below, and
      // (groups) do not appear in the URL.
      if (entry.startsWith('[')) continue
      const path = entry.startsWith('(') ? prefix : `${prefix}/${entry}`
      if (existsSync(join(full, 'page.tsx'))) routes.add(path || '/')
      walk(full, path)
    }
  }
  walk(APP_DIR, '')
  return routes
}

const STATIC = staticRoutes()
const ENTRIES = sitemap()
const PATHS = ENTRIES.map(e => e.url.replace(ORIGIN, '') || '/')

/** Paths served by a dynamic route, keyed by the prefix that owns them. */
const DYNAMIC: { prefix: string; paths: string[] }[] = [
  { prefix: '/harga-kereta-terpakai/', paths: MODEL_HUB_SLUGS.map(s => `/harga-kereta-terpakai/${s}`) },
  // The rewrite in next.config.mjs maps /harga-:slug to /harga-model/:slug.
  { prefix: '/harga-',                 paths: coveredYearSlugs().map(s => `/harga-${s}`) },
  { prefix: '/varian/',                paths: Object.keys(VARIANT_GUIDES).map(s => `/varian/${s}`) },
  { prefix: '/bandingkan/',            paths: comparisonParams().map(p => `/bandingkan/${p.slug}`) },
]

describe('the sitemap is well formed', () => {
  it('declares a meaningful number of URLs', () => {
    expect(PATHS.length).toBeGreaterThan(80)
  })

  it('has no duplicate URL', () => {
    const dupes = PATHS.filter((p, i) => PATHS.indexOf(p) !== i)
    expect([...new Set(dupes)]).toEqual([])
  })

  it('is entirely on the canonical origin, with no trailing slashes', () => {
    for (const e of ENTRIES) {
      expect(e.url.startsWith(ORIGIN), e.url).toBe(true)
      expect(e.url.endsWith('/'), `${e.url} has a trailing slash`).toBe(false)
    }
  })

  it('advertises nothing robots.txt disallows', () => {
    for (const p of PATHS) {
      for (const blocked of ['/check/', '/laporan-pembeli/', '/dashboard/', '/auth/', '/api/', '/admin/']) {
        expect((p + '/').startsWith(blocked), `${p} is robots-disallowed`).toBe(false)
      }
    }
  })
})

describe('every sitemap URL resolves to a real page', () => {
  it('names no route that does not exist', () => {
    const dead = PATHS.filter(p => {
      if (STATIC.has(p)) return false
      return !DYNAMIC.some(d => p.startsWith(d.prefix) && d.paths.includes(p))
    })
    expect(dead, `sitemap URLs with no page behind them: ${dead.join(', ')}`).toEqual([])
  })

  it('lists every model hub that exists', () => {
    // The reverse direction: a hub built but never advertised is invisible.
    for (const slug of MODEL_HUB_SLUGS) {
      expect(PATHS, `hub ${slug} missing from the sitemap`).toContain(`/harga-kereta-terpakai/${slug}`)
    }
  })

  it('lists every variant guide that exists', () => {
    for (const slug of Object.keys(VARIANT_GUIDES)) {
      expect(PATHS, `variant guide ${slug} missing from the sitemap`).toContain(`/varian/${slug}`)
    }
  })

  it('lists every warm year page', () => {
    for (const slug of coveredYearSlugs()) {
      expect(PATHS, `year page ${slug} missing from the sitemap`).toContain(`/harga-${slug}`)
    }
  })
})

describe('lastModified tells the truth about freshness', () => {
  const marketPaths = new Set([
    ...coveredYearSlugs().map(s => `/harga-${s}`),
    ...MODEL_HUB_SLUGS.map(s => `/harga-kereta-terpakai/${s}`),
  ])

  it('dates the market pages at build time, not at a frozen literal', () => {
    // These render from market_price_cache, refreshed daily by the cron and
    // re-rendered hourly by ISR. lastModified sat at 2026-06-23 for weeks while
    // the numbers on the page moved — a weekly changeFrequency next to a
    // months-old lastModified is a contradiction Google reads as noise.
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    for (const e of ENTRIES) {
      const path = e.url.replace(ORIGIN, '')
      if (!marketPaths.has(path)) continue
      expect(new Date(e.lastModified!).getTime(), `${path} is stale-dated`).toBeGreaterThan(dayAgo)
    }
  })

  it('leaves the editorial pages on their curated dates', () => {
    // Guard the guard: this must not become "everything is always fresh".
    const guide = ENTRIES.find(e => e.url.endsWith('/cara-beli-kereta-terpakai'))!
    expect(new Date(guide.lastModified!).getFullYear()).toBeLessThan(2026)
  })
})

describe('every generated page is advertised', () => {
  it('lists every comparison page', () => {
    for (const { slug } of comparisonParams()) {
      expect(PATHS, `comparison ${slug} missing from the sitemap`).toContain(`/bandingkan/${slug}`)
    }
  })

  it('lists every FAQ guide', () => {
    const faqDir = join(APP_DIR, 'faq')
    const guides = readdirSync(faqDir)
      .filter(e => statSync(join(faqDir, e)).isDirectory() && existsSync(join(faqDir, e, 'page.tsx')))
    expect(guides.length).toBeGreaterThan(0)
    for (const slug of guides) {
      expect(PATHS, `FAQ guide ${slug} missing from the sitemap`).toContain(`/faq/${slug}`)
    }
  })
})
