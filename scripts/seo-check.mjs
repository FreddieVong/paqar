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

// ── Report ──────────────────────────────────────────────────────────────────

console.log('SEO/GEO regression guard')
console.log('─'.repeat(60))
console.log(`public pages checked : ${pages.length}`)
console.log(`sitemap URLs         : ${sitemapUrls.length}`)
console.log(`JSON-LD blocks parsed: ${jsonLdBlocks}`)

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
