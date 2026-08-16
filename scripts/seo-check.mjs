#!/usr/bin/env node
// SEO/GEO regression guard. Runs against BUILD OUTPUT, not source.
//
// Why this exists: three real bugs shipped to production and sat there
// undetected, because none of them are logic bugs a unit test would catch —
// they are properties of generated output.
//
//   1. A canonical declared in app/layout.tsx was inherited by every page that
//      did not override it, so all 8 /faq/* pages told Google they were
//      duplicates of the homepage and should not be indexed. (fixed: db0ddec)
//   2. robots.txt named GPTBot/ClaudeBot/etc with `Allow: /` and no disallow
//      list. A crawler obeys exactly ONE user-agent group, so naming them to
//      "welcome" them granted access to /laporan-pembeli/ — paid customer
//      reports on claim-token URLs. (fixed: 526d403)
//   3. /harga-{model}-{year} accepted any 4-digit year, exposing ~160k
//      crawlable force-dynamic URLs. (fixed: 3ea928b)
//
// Run AFTER `next build`:  npm run seo:check
//
// Exits non-zero on any failure. Prints what it checked either way — a guard
// that passes silently is indistinguishable from a guard that did nothing.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT      = process.cwd()
const APP_DIR   = join(ROOT, '.next/server/app')
const ORIGIN    = 'https://paqar.my'

// Route prefixes that are intentionally not indexable. Must stay in sync with
// the disallow list in app/robots.ts.
const PRIVATE_PREFIXES = ['/check/', '/laporan-pembeli/', '/dashboard/', '/auth/', '/api/', '/semak-saman-kereta/']

// Paths that must be blocked for EVERY crawler group, including named AI bots.
const MUST_BE_BLOCKED = ['/laporan-pembeli/', '/dashboard/', '/auth/', '/check/']

const failures = []
const notes    = []
function fail(check, detail) { failures.push({ check, detail }) }

// ── Preconditions ───────────────────────────────────────────────────────────

if (!existsSync(APP_DIR)) {
  console.error('✗ No build output at .next/server/app')
  console.error('  Run `next build` first — this guard inspects generated HTML, not source.')
  process.exit(2)
}

// ── Collect built pages ─────────────────────────────────────────────────────

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (entry.endsWith('.html')) acc.push(full)
  }
  return acc
}

/**
 * Rewrites from next.config.mjs, applied in reverse: build output is keyed by
 * the INTERNAL route, but canonicals (correctly) name the PUBLIC URL.
 *
 * Without this, every prerendered year page reads as a canonical mismatch —
 * .next/server/app/harga-model/city-2021.html canonicalises to
 * /harga-city-2021, which is exactly right and what the sitemap declares.
 * The check only started seeing these once the route gained
 * generateStaticParams and began emitting HTML at build time.
 */
const REWRITES = [
  { internal: /^\/harga-model\/(.+)$/, public: (m) => `/harga-${m[1]}` },
]

function fileToRoute(file) {
  const rel = relative(APP_DIR, file).replace(/\.html$/, '')
  if (rel === 'index') return '/'
  const route = '/' + rel
  for (const rw of REWRITES) {
    const m = route.match(rw.internal)
    if (m) return rw.public(m)
  }
  return route
}

const pages = walk(APP_DIR)
  .map(file => ({ file, route: fileToRoute(file) }))
  .filter(p => !p.route.startsWith('/_'))
  .filter(p => !PRIVATE_PREFIXES.some(prefix => (p.route + '/').startsWith(prefix)))
  .filter(p => !['/admin', '/dashboard', '/auth', '/check'].some(x => p.route === x || p.route.startsWith(x + '/')))

if (pages.length === 0) fail('build output', 'no public pages found — is this a real build?')

// ── 1. Canonical integrity ──────────────────────────────────────────────────
// The db0ddec bug: pages inheriting the homepage canonical.

for (const { file, route } of pages) {
  const html = readFileSync(file, 'utf8')
  const m = html.match(/<link rel="canonical" href="([^"]+)"/)

  if (!m) {
    // Not fatal on its own (Google self-canonicalises), but on an indexable
    // page it is a missed signal worth surfacing.
    notes.push(`no canonical: ${route}`)
    continue
  }

  const canonical = m[1].replace(/\/$/, '') || ORIGIN
  const expected  = route === '/' ? ORIGIN : ORIGIN + route

  if (canonical !== expected) {
    fail('canonical', `${route} canonicalises to ${canonical} (expected ${expected})`)
  }
}

// ── 2. robots.txt ───────────────────────────────────────────────────────────

const robotsPath = join(APP_DIR, 'robots.txt.body')
if (!existsSync(robotsPath)) {
  fail('robots.txt', 'not generated')
} else {
  const robots = readFileSync(robotsPath, 'utf8')

  // Parse into user-agent groups. A crawler obeys exactly one group, so each
  // group must independently carry the full set of restrictions.
  const groups = []
  let current = null
  for (const raw of robots.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const [k, ...rest] = line.split(':')
    const key = k.trim().toLowerCase()
    const val = rest.join(':').trim()
    if (key === 'user-agent') {
      current = { agent: val, allow: [], disallow: [] }
      groups.push(current)
    } else if (current && key === 'allow')    current.allow.push(val)
    else if (current && key === 'disallow')   current.disallow.push(val)
  }

  if (groups.length === 0) fail('robots.txt', 'no user-agent groups parsed')

  for (const g of groups) {
    for (const blocked of MUST_BE_BLOCKED) {
      if (!g.disallow.includes(blocked)) {
        fail('robots.txt', `User-agent "${g.agent}" does not disallow ${blocked} — a named group replaces '*', it does not inherit from it`)
      }
    }
  }
}

// ── 3. Sitemap integrity ────────────────────────────────────────────────────

const sitemapPath = join(APP_DIR, 'sitemap.xml.body')
let sitemapUrls = []
if (!existsSync(sitemapPath)) {
  fail('sitemap.xml', 'not generated')
} else {
  const xml = readFileSync(sitemapPath, 'utf8')
  sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])

  if (sitemapUrls.length === 0) fail('sitemap.xml', 'contains no URLs')

  for (const url of sitemapUrls) {
    if (!url.startsWith(ORIGIN)) {
      fail('sitemap.xml', `URL is not on ${ORIGIN}: ${url}`)
      continue
    }
    const path = url.slice(ORIGIN.length) || '/'

    // A sitemap must never advertise a path robots.txt forbids.
    if (PRIVATE_PREFIXES.some(prefix => (path + '/').startsWith(prefix))) {
      fail('sitemap.xml', `advertises a robots-disallowed path: ${path}`)
    }
  }
}

// ── 4. Metadata completeness ────────────────────────────────────────────────

for (const { file, route } of pages) {
  const html = readFileSync(file, 'utf8')

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim()
  if (!title) fail('metadata', `${route} has no <title>`)

  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim()
  if (!desc) fail('metadata', `${route} has no meta description`)
}

// ── 4b. Uniqueness ──────────────────────────────────────────────────────────
//
// Two pages sharing a title tell Google they are the same page. The risk lives
// in the generated families — 58 year pages, 14 hubs, 7 comparisons — where a
// template that forgets to interpolate produces dozens of identical strings.

{
  const seenTitle = new Map()
  const seenDesc  = new Map()
  for (const { file, route } of pages) {
    const html  = readFileSync(file, 'utf8')
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim()
    const desc  = html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim()
    if (title) (seenTitle.get(title) ?? seenTitle.set(title, []).get(title)).push(route)
    if (desc)  (seenDesc.get(desc)   ?? seenDesc.set(desc, []).get(desc)).push(route)
  }
  for (const [title, routes] of seenTitle) {
    if (routes.length > 1) fail('duplicate title', `${routes.length} pages share "${title.slice(0, 60)}": ${routes.slice(0, 4).join(', ')}`)
  }
  for (const [desc, routes] of seenDesc) {
    if (routes.length > 1) fail('duplicate description', `${routes.length} pages share a description: ${routes.slice(0, 4).join(', ')}`)
  }
}

// ── 4c. Open Graph integrity ────────────────────────────────────────────────
//
// THE DEFECT THIS EXISTS FOR. Next.js replaces `openGraph` wholesale when a
// child declares one and INHERITS it wholesale when a child does not. Measured
// on 2026-08-15 against 116 built pages, that produced two opposite failures
// which between them covered every page on the site:
//
//   · 7 /faq/* guides declared no openGraph, so og:url, og:title and
//     og:description were the HOMEPAGE's. Each guide told Facebook and
//     WhatsApp that it was the homepage.
//   · 30 pages declared their own, which erased the root's locale and image —
//     og:locale was missing on 108 pages, og:image on 27.
//
// The root layout's canonical carried a long comment warning about exactly
// this inheritance trap. It was written for `alternates` and never applied to
// `openGraph`. These checks close that gap at the only layer that can see it.

for (const { file, route } of pages) {
  const html = readFileSync(file, 'utf8')
  const og = (prop) => html.match(new RegExp(`<meta property="og:${prop}" content="([^"]*)"`))?.[1]

  const ogUrl = og('url')
  if (!ogUrl) {
    fail('open graph', `${route} has no og:url`)
  } else {
    if (!ogUrl.startsWith(ORIGIN)) fail('open graph', `${route} og:url is not absolute on ${ORIGIN}: ${ogUrl}`)
    // The homepage-inheritance bug, caught by shape rather than by memory.
    if (route !== '/' && ogUrl.replace(/\/$/, '') === ORIGIN) {
      fail('open graph', `${route} claims the homepage as its og:url — it is inheriting the root layout's`)
    }
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    if (canonical && canonical.replace(/\/$/, '') !== ogUrl.replace(/\/$/, '')) {
      fail('open graph', `${route} og:url (${ogUrl}) disagrees with canonical (${canonical})`)
    }
  }

  if (og('locale') !== 'ms_MY') fail('open graph', `${route} og:locale is "${og('locale') ?? 'absent'}", expected ms_MY`)

  const ogImage = og('image')
  if (!ogImage) fail('open graph', `${route} has no og:image`)
  else if (!/^https?:\/\//.test(ogImage)) fail('open graph', `${route} og:image is not absolute: ${ogImage}`)
}

// ── 4d. Structured-data claim safety ────────────────────────────────────────
//
// Google's structured-data policies forbid markup that is not supported by
// visible page content. These are the fabrications that would be most tempting
// and most damaging: ratings and reviews Paqar has never collected, and an
// availability/price promise for a product that cannot currently be bought.

for (const { file, route } of pages) {
  const html = readFileSync(file, 'utf8')
  for (const block of [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => m[1])) {
    if (/"aggregateRating"|"ratingValue"|"reviewCount"|"@type"\s*:\s*"Review"/.test(block)) {
      fail('structured data', `${route} emits a rating or review Paqar has not collected`)
    }
    if (/"priceValidUntil"|"shippingDetails"|"hasMerchantReturnPolicy"/.test(block)) {
      fail('structured data', `${route} emits merchant fields unrelated to Paqar`)
    }
  }
}

// ── 5. JSON-LD validity ─────────────────────────────────────────────────────

let jsonLdBlocks = 0
for (const { file, route } of pages) {
  const html = readFileSync(file, 'utf8')
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => m[1])

  for (const block of blocks) {
    jsonLdBlocks++
    let parsed
    try {
      parsed = JSON.parse(block)
    } catch (err) {
      fail('json-ld', `${route} has unparseable JSON-LD: ${err.message}`)
      continue
    }
    // A block is either a single node, an array of nodes, or a @graph
    // container. In @graph form the wrapper legitimately carries @context
    // with no @type of its own — the types live on the graph nodes — so
    // requiring @type on the wrapper would flag valid markup.
    const blocks_ = Array.isArray(parsed) ? parsed : [parsed]
    for (const entry of blocks_) {
      if (!entry['@context']) fail('json-ld', `${route} JSON-LD block missing @context`)

      const nodes = Array.isArray(entry['@graph']) ? entry['@graph'] : [entry]
      if (Array.isArray(entry['@graph']) && entry['@graph'].length === 0) {
        fail('json-ld', `${route} has an empty @graph`)
      }
      for (const node of nodes) {
        if (!node['@type']) {
          fail('json-ld', `${route} JSON-LD node missing @type`)
        }
      }
    }
  }
}

// ── Free/paid boundary ──────────────────────────────────────────────────────
//
// THE DEFECT THIS EXISTS FOR. Paqar's free tier is a qualitative verdict, a
// qualitative explanation and a confidence band. The RM12 report is the
// numbers: median, range, price gap, negotiation room, trade-in evidence.
//
// The price templates were publishing the paid half for nothing, at scale:
//
//   /harga-{model}-{year}      min, max, median, listing count and a threshold
//                              derived from the max — 58 pages, repeated inside
//                              FAQPage JSON-LD, and the median again in a
//                              /kira-ansuran-kereta?harga= query string
//   /harga-kereta-terpakai/*   a min-max range per year per model, 14 hubs
//   /harga-{brand}-terpakai    a rounded min-max span per model, 6 pages
//   /bandingkan/*              both models' ranges per year, 7 pages
//   /varian/*                  each trim's price, the step up to it, and the
//                              spread across the ladder
//
// A unit test cannot catch this: the leak is what a template interpolates, and
// it is only visible once rendered. So this scans the built HTML.
//
// WHAT IS DELIBERATELY ALLOWED. Paqar's own product prices (RM12, RM88, RM100),
// because a page must be able to say what it costs. And hand-written trim
// premiums on /varian/* ("biasanya RM3–5k atas E"), which are editorial priors
// about how much a trim typically costs above another — not derived from a
// market-price distribution, and not something that reveals any specific car's
// market position. They are listed here rather than silently skipped so the
// decision stays visible; if they should also go, tighten VARIANT_PREMIUM_OK.

const BOUNDARY_TEMPLATES = [
  { name: 'year page',   test: r => /^\/harga-[a-z0-9-]+-\d{4}$/.test(r) },
  { name: 'model hub',   test: r => r.startsWith('/harga-kereta-terpakai/') },
  { name: 'brand hub',   test: r => /^\/harga-[a-z]+-terpakai$/.test(r) },
  { name: 'comparison',  test: r => r.startsWith('/bandingkan/') },
  { name: 'variant',     test: r => r.startsWith('/varian/') },
]

/** Paqar's own prices. A page may always state what it charges. */
const PRODUCT_PRICE = /^(12|88|100)(\.00)?$/

/**
 * The public market teaser, allowed on Tier A YEAR PAGES only.
 *
 * Two numbers, both exact multiples of RM5,000, from the interquartile range of
 * the cleaned cohort rounded outward. The multiple-of-5,000 test is what makes
 * this exemption safe to write down: an exact median (RM34,400), a raw bound
 * (RM28,800) or a derived threshold (RM47,000) cannot pass it, so the exemption
 * cannot be widened into the figures it exists to keep out.
 *
 * See lib/market-teaser.ts for why a band is published at all.
 */
const TEASER_BAND_OK = n => Number.isInteger(n) && n >= 5000 && n % 5000 === 0

/**
 * Manufacturer list prices on /varian/*.
 *
 * wm_new_pr is the published new-car price a trim launched at — public
 * reference information from Perodua and Honda, not a used-market figure and
 * not derived from any distribution. The page labels it twice, and the derived
 * gaps between trims stay removed.
 *
 * Bounded to a plausible new-car range so the exemption cannot quietly cover a
 * used-market figure that happens to appear in the same template.
 */
const NEW_CAR_PRICE_OK = n => Number.isInteger(n) && n >= 20_000 && n <= 600_000

/**
 * Hand-written trim premiums and decision thresholds, allowed only on
 * /varian/*: "RM3–5k atas E", "berbaloi jika bezanya kurang dari RM4k".
 *
 * These are editorial priors about what a trim is worth relative to another —
 * not derived from a market-price distribution, and they reveal nothing about
 * any specific car's market position. The shape is deliberately narrow (at most
 * two digits, always suffixed k) and __tests__/app/free-paid-boundary.test.ts
 * asserts that every RM figure in lib/variant-guides.ts matches it, so the
 * exemption cannot widen without a test failing.
 */
const VARIANT_PREMIUM_OK = /^\d{1,2}(?:[–-]\d{1,2})?k$/

/**
 * Budget brackets that name an editorial guide rather than a cohort.
 *
 * "Kereta pertama terbaik bawah RM30k" is the title of /faq/best-first-car-
 * under-30k. Allowed only where the page actually links that guide, so the
 * exemption cannot quietly cover a real figure that happens to be 30k.
 */
const EDITORIAL_BRACKET = /^30k$/

// Matches an RM figure in visible text or JSON-LD: RM12, RM 34,400, RM3–5k.
//
// The range branch is FIRST and that ordering is load-bearing: with the plain
// branch first, "RM1–2k" matched as "RM1" and the trim-premium exemption below
// never fired, reporting six false positives on its first run.
const RM_FIGURE = /RM\s?(\d{1,2}[–-]\d{1,2}k|[\d,]+(?:\.\d+)?k?)/gi

let boundaryPagesScanned = 0

for (const { file, route } of pages) {
  const template = BOUNDARY_TEMPLATES.find(t => t.test(route))
  if (!template) continue
  boundaryPagesScanned++

  const html = readFileSync(file, 'utf8')
  // Strip the RSC payload: it repeats rendered strings in escaped JSON, so a
  // single leak would be reported twice with unreadable context. The visible
  // markup and the JSON-LD are what a reader and a crawler actually get.
  //
  // THEN strip Next's empty comment separators. React emits `<!-- -->` between
  // adjacent text nodes, so an interpolated figure renders as
  // `RM<!-- -->34,400` — and RM_FIGURE, which expects a digit after RM, saw
  // nothing. This guard was blind to exactly the leak it exists to catch:
  // every figure it did catch was a hand-written string literal. Found when the
  // variant list prices, which ARE interpolated, failed to appear in a
  // rendered-output inventory.
  const visible = html
    .replace(/<script[^>]*id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<!--\s*-->/g, '')

  const offenders = new Set()
  for (const m of visible.matchAll(RM_FIGURE)) {
    const figure = m[1].replace(/,/g, '')
    if (PRODUCT_PRICE.test(figure)) continue
    if (template.name === 'variant' && VARIANT_PREMIUM_OK.test(m[1])) continue
    if (template.name === 'variant' && NEW_CAR_PRICE_OK(Number(figure))) continue
    if (template.name === 'year page' && TEASER_BAND_OK(Number(figure))) continue
    if (EDITORIAL_BRACKET.test(m[1]) && visible.includes('best-first-car-under-30k')) continue
    offenders.add(m[0].trim())
  }

  if (offenders.size) {
    fail('free/paid boundary', `${route} (${template.name}) renders market figures: ${[...offenders].slice(0, 6).join(', ')}`)
  }

  // ── Sample-size disclosure ────────────────────────────────────────────────
  //
  // A count is evidence too, and it carries no RM, so it needs its own check.
  //
  // WHAT THIS FORBIDS: the size of the statistical sample behind a published
  // figure. "Berdasarkan 14 listing" invites a reader to audit Paqar's cohort,
  // and next to a band it is the missing piece that makes the band estimable.
  // On a PRERENDERED SEO SURFACE there is no legitimate count of any kind, so
  // the rule here is deliberately absolute rather than clever: these templates
  // publish a band and prose, and nothing that counts anything.
  //
  // WHAT THIS DOES NOT REACH, BY DESIGN: the free-check RESULT. A separately
  // planned feature will show an action count there — "Ada 10 listing yang
  // lebih murah di pasaran" — which is a count of QUALIFYING ALTERNATIVES, not
  // of the sample behind a statistic. It exposes no price, no median, no range
  // and not the cohort size.
  //
  // That feature is not blocked by this guard and needs no exemption added to
  // it, for a structural reason worth stating so nobody adds one: this guard
  // reads BUILD OUTPUT. The result renders client-side after a submission, so
  // it is never in prerendered HTML. The scope of this rule is "no count on a
  // prerendered SEO surface", not "no count anywhere in Paqar".
  //
  // If that ever changes — if a count is server-rendered onto one of these
  // templates — it must fail here, and the fix is a review, not a wider regex.
  if (/\b\d+\s+(listing|iklan)\b/i.test(visible)) {
    fail('free/paid boundary', `${route} (${template.name}) states a listing count`)
  }

  // The median used to travel to the loan calculator in a query string.
  if (/kira-ansuran-kereta\?harga=/.test(visible)) {
    fail('free/paid boundary', `${route} (${template.name}) passes a market price in a query string`)
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

console.log('SEO/GEO regression guard')
console.log('─'.repeat(60))
console.log(`public pages checked : ${pages.length}`)
console.log(`sitemap URLs         : ${sitemapUrls.length}`)
console.log(`JSON-LD blocks parsed: ${jsonLdBlocks}`)
console.log(`boundary pages scanned: ${boundaryPagesScanned}`)
console.log(`Open Graph + uniqueness: checked on all ${pages.length}`)

if (notes.length) {
  console.log(`\nnotes (${notes.length}) — not failures:`)
  for (const n of notes) console.log(`  · ${n}`)
}

if (failures.length) {
  console.log(`\n✗ ${failures.length} failure(s):\n`)
  for (const f of failures) console.log(`  [${f.check}] ${f.detail}`)
  console.log('')
  process.exit(1)
}

console.log('\n✓ all checks passed')
