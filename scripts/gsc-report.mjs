#!/usr/bin/env node
// Search Console data pull. READ-ONLY.
//
// scripts/gsc-verify.mjs answers "is access working?". This answers the
// questions docs/seo/REVENUE-PILOT-2026-08-14.md could not: every ranking
// figure in that report is marked [user-supplied] because it was transcribed
// from an export and never verified. This is what turns them [measured].
//
// SCOPE: https://www.googleapis.com/auth/webmasters.readonly — the same
// read-only scope. It queries Search Analytics and inspects URLs. It cannot
// submit a sitemap, request indexing, or change a setting, because the token
// it mints is never granted those capabilities.
//
// SECRETS: the key never appears in output. Errors report an HTTP status and a
// short code, never a response body — a Google error body can echo the signed
// assertion.
//
// Usage:
//   node scripts/gsc-report.mjs                  28 days vs the prior 28
//   node scripts/gsc-report.mjs --days 7         7 days vs the prior 7
//   node scripts/gsc-report.mjs --inspect <url>  index status for one URL
//   node scripts/gsc-report.mjs --json           machine-readable

import { readFileSync, existsSync } from 'fs'
import { createSign } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'

const SCOPE     = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API       = 'https://www.googleapis.com/webmasters/v3'
const INSPECT   = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'
const DEFAULT_KEY_PATH = join(homedir(), '.config', 'paqar', 'gsc-service-account.json')

const argv     = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const DAYS     = Number(argv[argv.indexOf('--days') + 1]) || 28
const INSPECT_URL = argv.includes('--inspect') ? argv[argv.indexOf('--inspect') + 1] : null

function die(message, hint) {
  console.error(`✗ ${message}`)
  if (hint) console.error(`\n${hint}`)
  process.exit(1)
}

// ── Auth ────────────────────────────────────────────────────────────────────

function loadKey() {
  const path = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE || DEFAULT_KEY_PATH
  const raw = existsSync(path) ? readFileSync(path, 'utf8') : process.env.GSC_SERVICE_ACCOUNT_JSON
  if (!raw) die('No Search Console credential found.', 'Run scripts/gsc-verify.mjs for setup guidance.')
  try { return JSON.parse(raw) } catch { die('Credential is not valid JSON') }
}

const b64url = buf => Buffer.from(buf).toString('base64url')

async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: key.client_email, scope: SCOPE, aud: key.token_uri || TOKEN_URL, iat: now, exp: now + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const assertion = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`

  const res = await fetch(key.token_uri || TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) {
    let code = ''
    try { code = (await res.json()).error ?? '' } catch { /* ignore */ }
    die(`Token request failed (HTTP ${res.status}${code ? `, ${code}` : ''})`)
  }
  const { access_token } = await res.json()
  if (!access_token) die('Token response contained no access_token')
  return access_token
}

async function api(token, url, body) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    // Status and reason only. A Google error body can echo the assertion.
    let reason = ''
    try { reason = (await res.json())?.error?.status ?? '' } catch { /* ignore */ }
    die(`API call failed (HTTP ${res.status}${reason ? `, ${reason}` : ''}) on ${new URL(url).pathname}`)
  }
  return res.json()
}

// ── Dates ───────────────────────────────────────────────────────────────────
//
// Search Console data lags ~2 days. Ending "today" would compare a full prior
// window against a partial current one and manufacture a decline.
const iso = d => d.toISOString().slice(0, 10)
const daysAgo = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d }

const LAG = 2
const curEnd   = iso(daysAgo(LAG))
const curStart = iso(daysAgo(LAG + DAYS - 1))
const prvEnd   = iso(daysAgo(LAG + DAYS))
const prvStart = iso(daysAgo(LAG + DAYS * 2 - 1))

const query = (token, site, body) =>
  api(token, `${API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, body)

const totals = rows => rows.reduce((a, r) => ({
  clicks: a.clicks + (r.clicks ?? 0),
  impressions: a.impressions + (r.impressions ?? 0),
}), { clicks: 0, impressions: 0 })

const pct = (now, before) => before === 0 ? (now === 0 ? '—' : '+∞') : `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%`
const n = v => (v ?? 0).toLocaleString('en-MY')
const pos = v => v == null ? '—' : v.toFixed(1)

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const key = loadKey()
  const token = await accessToken(key)

  const { siteEntry = [] } = await api(token, `${API}/sites`)
  const site = siteEntry.map(s => s.siteUrl).find(u => u.includes('paqar.my'))
  if (!site) die('No paqar.my property available to this service account.')

  if (INSPECT_URL) {
    const r = await api(token, INSPECT, { inspectionUrl: INSPECT_URL, siteUrl: site })
    const i = r.inspectionResult?.indexStatusResult ?? {}
    if (JSON_OUT) return console.log(JSON.stringify(r, null, 2))
    console.log(`URL inspection — ${INSPECT_URL}`)
    console.log('─'.repeat(64))
    console.log(`verdict          : ${i.verdict ?? '—'}`)
    console.log(`coverage         : ${i.coverageState ?? '—'}`)
    console.log(`indexing allowed : ${i.indexingState ?? '—'}`)
    console.log(`robots.txt       : ${i.robotsTxtState ?? '—'}`)
    console.log(`canonical (Paqar): ${i.userCanonical ?? '—'}`)
    console.log(`canonical (Google): ${i.googleCanonical ?? '—'}`)
    console.log(`last crawled     : ${i.lastCrawlTime ?? 'never'}`)
    console.log(`crawled as       : ${i.crawledAs ?? '—'}`)
    console.log(`referring URLs   : ${(i.referringUrls ?? []).length}`)
    console.log(`sitemaps listing : ${(i.sitemap ?? []).join(', ') || 'none'}`)
    return
  }

  const [curAll, prvAll, curQ, curP, prvP] = await Promise.all([
    query(token, site, { startDate: curStart, endDate: curEnd, dimensions: [], rowLimit: 1 }),
    query(token, site, { startDate: prvStart, endDate: prvEnd, dimensions: [], rowLimit: 1 }),
    query(token, site, { startDate: curStart, endDate: curEnd, dimensions: ['query'], rowLimit: 25000 }),
    query(token, site, { startDate: curStart, endDate: curEnd, dimensions: ['page'],  rowLimit: 200 }),
    query(token, site, { startDate: prvStart, endDate: prvEnd, dimensions: ['page'],  rowLimit: 200 }),
  ])

  if (JSON_OUT) {
    return console.log(JSON.stringify({ site, window: { curStart, curEnd, prvStart, prvEnd }, curAll, prvAll, curQ, curP, prvP }, null, 2))
  }

  const c = curAll.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: null }
  const p = prvAll.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: null }

  console.log(`Search Console — ${site}`)
  console.log('='.repeat(72))
  console.log(`current  ${curStart} .. ${curEnd}   (${DAYS} days)`)
  console.log(`previous ${prvStart} .. ${prvEnd}`)
  console.log('')
  console.log('                     current      previous     change')
  console.log(`  clicks        ${n(c.clicks).padStart(12)} ${n(p.clicks).padStart(13)} ${pct(c.clicks, p.clicks).padStart(10)}`)
  console.log(`  impressions   ${n(c.impressions).padStart(12)} ${n(p.impressions).padStart(13)} ${pct(c.impressions, p.impressions).padStart(10)}`)
  console.log(`  CTR           ${((c.ctr ?? 0) * 100).toFixed(2).padStart(11)}% ${((p.ctr ?? 0) * 100).toFixed(2).padStart(12)}%`)
  console.log(`  avg position  ${pos(c.position).padStart(12)} ${pos(p.position).padStart(13)}`)

  // Branded vs non-branded — the split that decides whether SEO is working at
  // all. A site can look healthy on totals while every click is its own name.
  //
  // RECONCILED AGAINST THE TRUE TOTAL, and this is not a detail. The query
  // rows NEVER sum to the unfiltered total. An earlier version of this block
  // divided by the sum of the rows it had and reported the branded share as
  // the whole — a claim that silently discarded 13 of 33 clicks and was
  // repeated into a report before anyone checked it. (WITHDRAWN — see the
  // correction in docs/seo/REVENUE-PILOT-2026-08-14.md.)
  //
  // WHY THE ROWS DO NOT SUM. Raising rowLimit to 25000 removes OUR explicit
  // 100-row truncation. It does not make the row set complete: the Search
  // Console API gives no guarantee that every query row is returned, and rows
  // may be anonymised or omitted for reasons it does not disclose. So the
  // remainder is labelled for what is known about it — unattributed to the
  // returned query rows — and NOT asserted to be anonymisation alone.
  //
  // The percentages below are shares of the TRUE total, so branded and
  // non-branded do not add to 100 and the remainder is shown as its own line.
  // Branded and observed non-branded describe the RETURNED ROWS ONLY; neither
  // may be read as a share of all traffic. The honest statement is "zero
  // OBSERVED non-branded clicks", never "zero non-branded clicks".
  const branded = (curQ.rows ?? []).filter(r => /paqar/i.test(r.keys[0]))
  const nonBranded = (curQ.rows ?? []).filter(r => !/paqar/i.test(r.keys[0]))
  const bT = totals(branded), nT = totals(nonBranded)
  const attributedClicks = bT.clicks + nT.clicks
  const attributedImpr   = bT.impressions + nT.impressions
  const unattributedClicks = (c.clicks ?? 0) - attributedClicks
  const unattributedImpr   = (c.impressions ?? 0) - attributedImpr
  const share = v => (c.clicks ? `${Math.round((v / c.clicks) * 100)}%` : '—')
  console.log('')
  console.log(`Branded vs non-branded — observed in returned query rows only (${(curQ.rows ?? []).length} distinct queries returned)`)
  console.log(`  branded             ${n(bT.clicks).padStart(6)} clicks  ${n(bT.impressions).padStart(8)} impr   ${share(bT.clicks).padStart(5)} of all clicks`)
  console.log(`  non-branded (obs.)  ${n(nT.clicks).padStart(6)} clicks  ${n(nT.impressions).padStart(8)} impr   ${share(nT.clicks).padStart(5)} of all clicks`)
  console.log(`  UNATTRIBUTED        ${n(unattributedClicks).padStart(6)} clicks  ${n(unattributedImpr).padStart(8)} impr   ${share(unattributedClicks).padStart(5)} of all clicks`)
  console.log(`                      └─ unattributed to returned query rows — anonymised or omitted by GSC`)
  console.log(`                         (may be branded or non-branded; the API does not guarantee every row)`)
  if (nT.clicks === 0) {
    console.log(`  → zero OBSERVED non-branded clicks among ${n(attributedClicks)} query-attributed of ${n(c.clicks)} total.`)
    console.log(`    Not "zero non-branded clicks" — ${n(unattributedClicks)} are unattributed and unclassifiable.`)
  }

  console.log('')
  console.log('Top non-branded queries by impressions')
  console.log('  clicks  impr    ctr    pos   query')
  for (const r of nonBranded.sort((a, b) => b.impressions - a.impressions).slice(0, 20)) {
    console.log(`  ${n(r.clicks).padStart(6)} ${n(r.impressions).padStart(5)} ${(r.ctr * 100).toFixed(1).padStart(6)}% ${pos(r.position).padStart(6)}   ${r.keys[0]}`)
  }

  // Page families — the unit the pilot is measured in.
  const fam = u => {
    const path = (() => { try { return new URL(u).pathname } catch { return u } })()
    if (path === '/') return '/ (home)'
    if (/^\/harga-[a-z0-9-]+-\d{4}$/.test(path)) return '/harga-{model}-{year}'
    for (const pre of ['/varian/', '/bandingkan/', '/harga-kereta-terpakai/', '/faq/']) if (path.startsWith(pre)) return pre + '*'
    if (/^\/harga-[a-z]+-terpakai$/.test(path)) return '/harga-{brand}-terpakai'
    return path
  }
  const roll = rows => {
    const out = {}
    for (const r of rows ?? []) {
      const k = fam(r.keys[0])
      out[k] ??= { clicks: 0, impressions: 0, posSum: 0, posW: 0, n: 0 }
      out[k].clicks += r.clicks; out[k].impressions += r.impressions; out[k].n++
      out[k].posSum += (r.position ?? 0) * (r.impressions || 1); out[k].posW += (r.impressions || 1)
    }
    return out
  }
  const cur = roll(curP.rows), prv = roll(prvP.rows)
  console.log('')
  console.log('By page family — current vs previous')
  console.log('  pages  clicks  impr    avg pos   Δ clicks   Δ impr    family')
  for (const [k, v] of Object.entries(cur).sort((a, b) => b[1].impressions - a[1].impressions)) {
    const q = prv[k] ?? { clicks: 0, impressions: 0 }
    console.log(`  ${String(v.n).padStart(5)} ${n(v.clicks).padStart(7)} ${n(v.impressions).padStart(6)} ${(v.posSum / v.posW).toFixed(1).padStart(9)} ${pct(v.clicks, q.clicks).padStart(10)} ${pct(v.impressions, q.impressions).padStart(9)}    ${k}`)
  }

  console.log('')
  console.log('Top pages by impressions')
  console.log('  clicks  impr    ctr    pos   page')
  for (const r of (curP.rows ?? []).sort((a, b) => b.impressions - a.impressions).slice(0, 20)) {
    let path = r.keys[0]; try { path = new URL(path).pathname } catch { /* keep */ }
    console.log(`  ${n(r.clicks).padStart(6)} ${n(r.impressions).padStart(5)} ${(r.ctr * 100).toFixed(1).padStart(6)}% ${pos(r.position).padStart(6)}   ${path}`)
  }
}

main().catch(err => die(`Unexpected failure: ${err?.message ?? 'unknown error'}`))
