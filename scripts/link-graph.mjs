#!/usr/bin/env node
// Internal link graph report. Runs against BUILD OUTPUT, not source.
//
// Why this exists: the 2026-08-14 audit found no technical fault behind the
// 79 URLs Search Console reports as "Discovered – currently not indexed" —
// every sitemap URL returned 200, self-canonical, titled, described. What it
// did find was a link graph in which half the sitemap was reachable almost
// nowhere: 58 year pages averaging 1.8 internal inbound links each.
//
// A sitemap asserts a page EXISTS. Internal links assert it MATTERS. A page
// with the first and not the second is exactly what Google leaves in
// "Discovered". That remains a hypothesis rather than a proven sole cause —
// this script exists so the hypothesis can be tested against a measurement
// instead of an impression, before and after a change.
//
// Run AFTER `next build`:  node scripts/link-graph.mjs
//                          node scripts/link-graph.mjs --json
//
// Reports, per the audit's open questions:
//   · internal inbound-link count per page
//   · click depth from the homepage
//   · orphans (0 inbound) and near-orphans (<= 2 inbound)
//   · anchor-text distribution
//   · pages reachable ONLY via the sitemap
//
// This is a REPORT, not a gate. It never exits non-zero on graph shape —
// there is no threshold here that is right for every page, and a guard that
// fails a build over a judgement call would be worse than no guard. Exit 2
// means it could not run at all.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT    = process.cwd()
const APP_DIR = join(ROOT, '.next/server/app')
const ORIGIN  = 'https://paqar.my'
const JSON_OUT = process.argv.includes('--json')

// Mirrors scripts/seo-check.mjs. Kept as a copy rather than shared: these two
// scripts answer different questions and one must not start failing because
// the other's notion of "private" moved.
const PRIVATE_PREFIXES = ['/check/', '/laporan-pembeli/', '/dashboard/', '/auth/', '/api/', '/semak-saman-kereta/']

if (!existsSync(APP_DIR)) {
  console.error('✗ No build output at .next/server/app')
  console.error('  Run `next build` first — this reads generated HTML, not source.')
  process.exit(2)
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (entry.endsWith('.html')) acc.push(full)
  }
  return acc
}

// Build output is keyed by INTERNAL route; the public URL is what links and
// the sitemap name. Same table as seo-check.mjs, same reason.
const REWRITES = [{ internal: /^\/harga-model\/(.+)$/, public: m => `/harga-${m[1]}` }]

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

const isPublic = route =>
  !route.startsWith('/_') &&
  !PRIVATE_PREFIXES.some(p => (route + '/').startsWith(p)) &&
  !['/admin', '/dashboard', '/auth', '/check'].some(x => route === x || route.startsWith(x + '/'))

const pages = walk(APP_DIR).map(file => ({ file, route: fileToRoute(file) })).filter(p => isPublic(p.route))

if (pages.length === 0) {
  console.error('✗ no public pages found — is this a real build?')
  process.exit(2)
}

// ── Extract links ───────────────────────────────────────────────────────────

/**
 * Anchor text with tags stripped and whitespace collapsed.
 *
 * Next.js renders nested spans inside many links, and the RSC payload repeats
 * the same href in a JSON blob further down the document. Only <a href> in the
 * rendered markup counts as a link a crawler follows, so the payload is not
 * parsed — matching on the tag is what keeps this honest.
 */
const ANCHOR = /<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi

function normalise(href) {
  if (!href) return null
  let h = href.trim()
  if (h.startsWith(ORIGIN)) h = h.slice(ORIGIN.length) || '/'
  if (!h.startsWith('/')) return null           // external, mailto:, tel:, #
  h = h.split('#')[0].split('?')[0]             // fragments and queries are the same page
  if (h.length > 1) h = h.replace(/\/$/, '')
  return h || '/'
}

const known = new Set(pages.map(p => p.route))
const inbound = new Map(pages.map(p => [p.route, []]))   // route -> [{from, anchor}]
const outbound = new Map(pages.map(p => [p.route, new Set()]))

for (const { file, route } of pages) {
  const html = readFileSync(file, 'utf8')
  ANCHOR.lastIndex = 0
  let m
  const seenOnPage = new Set()
  while ((m = ANCHOR.exec(html))) {
    const target = normalise(m[1])
    if (!target || target === route) continue
    if (!known.has(target)) continue           // only edges between built public pages
    // Visible text, falling back to aria-label where the visible text carries
    // no meaning on its own. The year chips on the brand hubs are the real
    // case: the pill reads "2021" by design, and the label is what a screen
    // reader announces and what the link actually means.
    const visible = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const ariaMatch = m[0].match(/\baria-label="([^"]+)"/)
    const anchor = (!visible || /^\d+$/.test(visible)) && ariaMatch ? ariaMatch[1] : visible
    // One page linking the same target five times is one relationship, not
    // five. Counting repeats would let a nav bar drown out real editorial links.
    const dedupe = `${target} -> ${anchor}`
    if (seenOnPage.has(dedupe)) continue
    seenOnPage.add(dedupe)
    inbound.get(target).push({ from: route, anchor })
    outbound.get(route).add(target)
  }
}

// ── Site-wide links (nav/footer) ────────────────────────────────────────────
// A link present on essentially every page carries no editorial signal about
// any single target. Reporting inbound counts without separating these would
// show every footer page as "well linked" and hide the real shape.

const SITEWIDE_THRESHOLD = 0.8
const sitewide = new Set(
  [...inbound.entries()]
    .filter(([, links]) => new Set(links.map(l => l.from)).size >= pages.length * SITEWIDE_THRESHOLD)
    .map(([route]) => route)
)

const editorialInbound = new Map(
  [...inbound.entries()].map(([route, links]) => [
    route,
    sitewide.has(route) ? [] : links.filter(l => !sitewide.has(l.from) || l.from === '/'),
  ])
)

// ── Click depth from the homepage ───────────────────────────────────────────

const depth = new Map([['/', 0]])
let frontier = ['/']
while (frontier.length) {
  const next = []
  for (const route of frontier) {
    for (const target of outbound.get(route) ?? []) {
      if (depth.has(target)) continue
      depth.set(target, depth.get(route) + 1)
      next.push(target)
    }
  }
  frontier = next
}

// ── Sitemap ─────────────────────────────────────────────────────────────────

const sitemapPath = join(APP_DIR, 'sitemap.xml.body')
let sitemapRoutes = new Set()
if (existsSync(sitemapPath)) {
  const xml = readFileSync(sitemapPath, 'utf8')
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const r = normalise(m[1])
    if (r) sitemapRoutes.add(r)
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

const rows = pages.map(({ route }) => ({
  route,
  inbound:          new Set(inbound.get(route).map(l => l.from)).size,
  editorialInbound: new Set(editorialInbound.get(route).map(l => l.from)).size,
  outbound:         (outbound.get(route) ?? new Set()).size,
  depth:            depth.has(route) ? depth.get(route) : null,
  inSitemap:        sitemapRoutes.has(route),
  sitewide:         sitewide.has(route),
})).sort((a, b) => a.editorialInbound - b.editorialInbound || a.route.localeCompare(b.route))

const family = r => {
  if (r === '/') return '/ (home)'
  for (const p of ['/varian/', '/bandingkan/', '/harga-kereta-terpakai/', '/faq/']) if (r.startsWith(p)) return p + '*'
  if (/^\/harga-[a-z0-9-]+-\d{4}$/.test(r)) return '/harga-{model}-{year}'
  if (/^\/harga-[a-z]+-terpakai$/.test(r)) return '/harga-{brand}-terpakai'
  return '(other)'
}

if (JSON_OUT) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), pages: rows.length, rows }, null, 2))
  process.exit(0)
}

const orphans     = rows.filter(r => r.editorialInbound === 0)
const nearOrphans = rows.filter(r => r.editorialInbound > 0 && r.editorialInbound <= 2)
const sitemapOnly = rows.filter(r => r.inSitemap && r.inbound === 0)

console.log('Internal link graph')
console.log('===================')
console.log(`pages analysed        ${rows.length}`)
console.log(`sitemap URLs          ${sitemapRoutes.size}`)
console.log(`site-wide targets     ${sitewide.size}  (nav/footer — excluded from editorial counts)`)
console.log('')
console.log('Editorial inbound links (site-wide nav/footer excluded)')
console.log(`  orphans (0)         ${orphans.length}`)
console.log(`  near-orphans (1-2)  ${nearOrphans.length}`)
console.log(`  reachable only via sitemap (0 inbound of any kind)  ${sitemapOnly.length}`)
console.log('')

console.log('By family')
console.log('  family                     n   mean-editorial-inbound   min   max   mean-depth')
const byFamily = {}
for (const r of rows) (byFamily[family(r.route)] ??= []).push(r)
for (const [fam, list] of Object.entries(byFamily).sort((a, b) => b[1].length - a[1].length)) {
  const vals   = list.map(r => r.editorialInbound)
  const mean   = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  const depths = list.map(r => r.depth).filter(d => d !== null)
  const dmean  = depths.length ? (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1) : '—'
  console.log(`  ${fam.padEnd(26)} ${String(list.length).padStart(3)}   ${mean.padStart(20)}   ${String(Math.min(...vals)).padStart(3)}   ${String(Math.max(...vals)).padStart(3)}   ${dmean.padStart(10)}`)
}
console.log('')

if (orphans.length) {
  console.log(`Orphans — no editorial inbound link (${orphans.length})`)
  for (const r of orphans) console.log(`  depth=${r.depth ?? '∞'}  sitemap=${r.inSitemap ? 'yes' : 'no '}  ${r.route}`)
  console.log('')
}

console.log('Anchor-text distribution (editorial links only, top 25)')
const anchors = {}
for (const [, links] of editorialInbound) for (const l of links) {
  const a = l.anchor || '(empty)'
  anchors[a] = (anchors[a] ?? 0) + 1
}
const anchorList = Object.entries(anchors).sort((a, b) => b[1] - a[1])
for (const [a, n] of anchorList.slice(0, 25)) {
  console.log(`  ${String(n).padStart(4)}  ${a.length > 78 ? a.slice(0, 75) + '...' : a}`)
}
console.log(`  ${anchorList.length} distinct anchors over ${anchorList.reduce((s, [, n]) => s + n, 0)} editorial links`)
console.log('')

const empties = anchorList.filter(([a]) => a === '(empty)').reduce((s, [, n]) => s + n, 0)
if (empties) console.log(`  ⚠ ${empties} editorial links have empty anchor text (image-only or icon links)`)

console.log('Least-linked pages (editorial inbound, ascending — first 30)')
for (const r of rows.slice(0, 30)) {
  console.log(`  ${String(r.editorialInbound).padStart(3)} in  ${String(r.outbound).padStart(3)} out  depth=${String(r.depth ?? '∞').padStart(2)}  ${r.inSitemap ? '' : '(not in sitemap) '}${r.route}`)
}
