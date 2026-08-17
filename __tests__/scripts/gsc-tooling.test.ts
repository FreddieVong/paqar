// @vitest-environment node
//
// The Search Console tooling is read-only and must stay that way, and the
// language it prints must claim only what the API can support.
//
// WHY THIS EXISTS. Both properties were violated in practice before being
// caught by measurement rather than by review:
//
//   1. The branded/non-branded split divided by the sum of the query rows the
//      script happened to hold — which was truncated at 100 — and reported the
//      branded share as the whole. It discarded 13 of 33 clicks and printed
//      "100% of clicks are branded".
//   2. The remainder was then described as "genuine anonymisation". Raising
//      rowLimit removes OUR truncation, not the API's discretion: Search
//      Console guarantees nothing about row completeness, so naming a cause is
//      asserting something unknown.
//   3. A Search Console click was called a conversion. A click is a search
//      visit; nothing is known about what the visitor did on arrival.
//
// A correct number under a wrong sentence is still a wrong report.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const VERIFY = 'scripts/gsc-verify.mjs'
const REPORT = 'scripts/gsc-report.mjs'
const SCRIPTS: Array<[string, string]> = [[VERIFY, read(VERIFY)], [REPORT, read(REPORT)]]

// ── Read-only, structurally ─────────────────────────────────────────────────

describe('the tooling cannot write to Search Console', () => {
  it.each(SCRIPTS)('%s requests only the read-only scope', (path, text) => {
    expect(text, path).toContain('https://www.googleapis.com/auth/webmasters.readonly')
    // The read/write scope must never appear.
    expect(text, path).not.toMatch(/auth\/webmasters(?!\.readonly)/)
  })

  it.each(SCRIPTS)('%s calls no write endpoint', (path, text) => {
    // Sitemap submission and indexing requests are the two that would matter.
    expect(text, path).not.toMatch(/method:\s*['"]PUT['"]/i)
    expect(text, path).not.toMatch(/method:\s*['"]DELETE['"]/i)
    expect(text, path).not.toMatch(/urlNotifications|indexing\.googleapis/i)
  })

  it.each(SCRIPTS)('%s keeps the credential outside the repository', (path, text) => {
    expect(text, path).toContain(".config', 'paqar'")
    expect(text, path).not.toMatch(/process\.cwd\(\)[^\n]*service-account/)
  })

  it('.gitignore covers a key dropped in the repo by mistake', () => {
    const ignore = read('.gitignore')
    expect(ignore).toMatch(/service-account\*?\.json/)
  })
})

// ── Secrets never reach output ──────────────────────────────────────────────

describe('the tooling never prints secret material', () => {
  it.each(SCRIPTS)('%s logs no private key, token or raw credential', (path, text) => {
    // Every console.log argument that mentions a secret-bearing identifier.
    for (const m of text.matchAll(/console\.(log|error)\(([^\n]*)\)/g)) {
      expect(m[2], `${path}: ${m[0].slice(0, 80)}`)
        .not.toMatch(/private_key|access_token|\btoken\b|JSON\.stringify\(key/)
    }
  })

  it.each(SCRIPTS)('%s reports API failures without echoing the response body', (path, text) => {
    // A Google error body can echo the signed assertion.
    expect(text, path).not.toMatch(/console\.(log|error)\([^\n]*await res\.text\(\)/)
  })
})

// ── Language the data can support ───────────────────────────────────────────

describe('the report claims only what the API supports', () => {
  const text = read(REPORT)

  it('does not name a cause for the unattributed remainder', () => {
    expect(text).not.toMatch(/genuine(ly)?\s+anonymis/i)
    expect(text).not.toMatch(/(solely|purely|only)\s+anonymis/i)
    expect(text).not.toMatch(/only remaining gap is/i)
  })

  it('uses the neutral wording instead', () => {
    expect(text).toContain('unattributed to returned query rows — anonymised or omitted by GSC')
  })

  it('states that rowLimit removes OUR truncation, not the API’s discretion', () => {
    const flat = text.replace(/\n\s*\/\/\s?/g, ' ')
    expect(flat).toMatch(/does not guarantee|no guarantee/i)
    expect(flat).toMatch(/25000|25,000/)
  })

  it('labels the branded split as observed within returned rows only', () => {
    expect(text).toContain('observed in returned query rows only')
  })

  it('states the shares do NOT sum to the total', () => {
    const flat = text.replace(/\n\s*\/\/\s?/g, ' ')
    expect(flat).toMatch(/do not add to 100/i)
    // A positive claim that they sum is the original defect returning.
    expect(flat).not.toMatch(/(?<!do not |don't |never |cannot )add(s)? (up )?to 100/i)
  })

  it('makes no 100%-branded assertion except as a withdrawn historical note', () => {
    for (const m of text.matchAll(/100\s?%[^.\n]{0,40}(branded|of clicks)/gi)) {
      const window = text.slice(Math.max(0, m.index! - 400), m.index! + 400)
      expect(window, `"${m[0]}" is not marked as withdrawn`)
        .toMatch(/withdrawn|was wrong|defect|earlier version|discarded|reported the branded share/i)
    }
  })

  it('never calls a Search Console click a conversion', () => {
    text.split('\n').forEach((line, i) => {
      if (!/\b(convert(s|ed|ing)?|conversion)\b/i.test(line)) return
      if (!/\bquer(y|ies)\b|non-branded click|GSC click|search console click/i.test(line)) return
      expect(line, `${REPORT}:${i + 1} — "${line.trim().slice(0, 80)}"`)
        .toMatch(/not an? (on-site )?conversion|reserved|rather than a conversion|visit, not/i)
    })
  })
})
