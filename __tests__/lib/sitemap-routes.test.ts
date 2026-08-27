// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MODEL_HUB_SLUGS } from '@/lib/model-hubs'
import { coveredYearSlugs } from '@/lib/market-coverage'
import { PAGE_REVISED } from '@/lib/seo/editorial-dates'

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

  it('leaves an unrevised editorial page on its curated date', () => {
    // Guard the guard: this must not become "everything is always fresh".
    //
    // The exemplar used to be /cara-beli-kereta-terpakai, asserted to predate
    // 2026. That page was genuinely revised on 2026-08-23, so the assertion
    // started failing on a date that had become TRUE — the guard was pinning
    // an example rather than the property. It now names a page with no entry
    // in PAGE_REVISED, which is what "unrevised" actually means.
    const untouched = ENTRIES.find(e => e.url.endsWith('/cara-semak-geran-kereta'))!
    expect(PAGE_REVISED['/cara-semak-geran-kereta'], 'pick a different exemplar').toBeUndefined()
    expect(new Date(untouched.lastModified!).getFullYear()).toBeLessThan(2026)
  })

  it('dates a revised page at its real revision, not at the curated default', () => {
    // Eight /faq/* guides were rewritten on 2026-08-27 — an invented per-state
    // JPJ fee table removed, a Honda City variant that never existed removed —
    // and the sitemap went on declaring the curated 2026-06-23 for all of them.
    // A truthful lastModified is worth most at exactly that moment.
    for (const [path, date] of Object.entries(PAGE_REVISED)) {
      const entry = ENTRIES.find(e => e.url === `${ORIGIN}${path}` || (path === '/' && e.url === ORIGIN))
      if (!entry) continue
      expect(new Date(entry.lastModified!).toISOString().slice(0, 10), `${path} ignores its revision date`)
        .toBe(date)
    }
  })

  it('never dates an editorial page at build time', () => {
    const hourAgo = Date.now() - 60 * 60 * 1000
    for (const e of ENTRIES) {
      const path = e.url.replace(ORIGIN, '') || '/'
      if (marketPaths.has(path)) continue
      expect(new Date(e.lastModified!).getTime(), `${path} is stamped with the build clock`)
        .toBeLessThan(hourAgo)
    }
  })
})

describe('the revision dates are usable as a claim', () => {
  it('names only paths the sitemap actually advertises', () => {
    const advertised = new Set(PATHS)
    const orphans = Object.keys(PAGE_REVISED).filter(p => !advertised.has(p))
    expect(orphans, `revision dates for URLs not in the sitemap: ${orphans.join(', ')}`).toEqual([])
  })

  it('claims no revision in the future', () => {
    const today = new Date().toISOString().slice(0, 10)
    const ahead = Object.entries(PAGE_REVISED).filter(([, d]) => d > today).map(([p]) => p)
    expect(ahead, `revised "in the future": ${ahead.join(', ')}`).toEqual([])
  })

  it('is a real ISO date, since it is emitted verbatim as dateModified', () => {
    for (const [path, date] of Object.entries(PAGE_REVISED)) {
      expect(date, path).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(date).getTime()), path).toBe(false)
    }
  })

  it('never dates a revision before the page was published', () => {
    // dateModified < datePublished is incoherent, and Google treats the pair
    // as one signal.
    for (const [path, published] of Object.entries(PUBLISHED)) {
      const revised = PAGE_REVISED[path]
      if (!revised) continue
      expect(revised >= published, `${path}: revised ${revised} predates published ${published}`).toBe(true)
    }
  })
})

/** datePublished as each page's Article node declares it. */
const PUBLISHED: Record<string, string> = {
  '/cara-beli-kereta-terpakai':            '2025-05-01',
  '/checklist-beli-kereta-terpakai':       '2025-05-01',
  '/risiko-beli-kereta-terpakai':          '2025-05-01',
  '/panduan-semak-saman':                  '2025-05-01',
  '/cara-semak-insurans-kereta':           '2025-05-01',
  '/laporan-pembeli-kereta-terpakai':      '2026-06-23',
  '/semak-accident-claim-insurans-kereta': '2026-06-23',
  '/faq/best-first-car-under-30k':         '2026-07-20',
  '/faq/honda-city-buying-guide':          '2026-07-20',
  '/faq/honda-city-vs-toyota-vios':        '2026-07-20',
  '/faq/how-to-negotiate-used-car':        '2026-07-20',
  '/faq/how-to-spot-flood-cars':           '2026-07-20',
  '/faq/roadtax-by-state':                 '2026-07-20',
  '/faq/toyota-vios-buying-guide':         '2026-07-20',
  '/faq/what-to-check-buying-used-car':    '2026-07-20',
}

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
