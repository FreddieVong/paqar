// @vitest-environment node
//
// The direct-answer treatment, and the evidence that chose its targets.
//
// An earlier iteration aimed this work at twelve /harga-{model}-{year} pages.
// Search Console then showed those pages take roughly 46 impressions across 56
// days, five of 58 registering anything at all. These three pages take 674 in
// the same window at positions 8-13. The targeting is now measured rather than
// argued, and these tests hold the copy to the queries that justified it.
import { describe, it, expect } from 'vitest'
import { DIRECT_ANSWERS, DIRECT_ANSWER_PATHS, directAnswerFor } from '@/lib/direct-answers'
import { VARIANT_GUIDES } from '@/lib/variant-guides'

const entries = Object.entries(DIRECT_ANSWERS)

describe('targeting', () => {
  it('covers exactly the three measured pages', () => {
    expect(DIRECT_ANSWER_PATHS.sort()).toEqual([
      '/bandingkan/alza-vs-x50',
      '/varian/honda-city',
      '/varian/perodua-bezza',
    ])
  })

  it('carries no year page', () => {
    // The premise that failed. 5 of 58 year pages drew a single impression in
    // 28 days; no treatment earns anything from traffic that does not arrive.
    for (const p of DIRECT_ANSWER_PATHS) expect(p).not.toMatch(/^\/harga-[a-z0-9-]+-\d{4}$/)
  })

  it('records the query and measured position that justified each page', () => {
    for (const [path, a] of entries) {
      expect(a.query.length, path).toBeGreaterThan(3)
      // Every target was inside the top 15 when measured. A page further out
      // than that is a ranking problem, not a snippet problem.
      expect(a.measuredPos, path).toBeGreaterThan(0)
      expect(a.measuredPos, path).toBeLessThanOrEqual(15)
    }
  })

  it('returns null for a page without an entry, leaving it unchanged', () => {
    expect(directAnswerFor('/varian/perodua-myvi')).toBeNull()
    expect(directAnswerFor('/harga-myvi-2020')).toBeNull()
    expect(directAnswerFor('/bandingkan/bezza-vs-saga')).toBeNull()
  })
})

describe('the answer actually answers the query', () => {
  it.each(entries)('%s addresses the terms its query is asked in', (path, a) => {
    // Strip Malay question words; every remaining content word from the query
    // must appear somewhere in the visible block, or the page is answering a
    // different question from the one it ranks for.
    const stop = new Set(['beza', 'apa', 'dan', 'vs', 'atau', 'perbezaan'])
    const terms = a.query.toLowerCase().split(/\s+/).filter(t => t.length > 1 && !stop.has(t))
    const haystack = [a.heading, a.answer, a.columnA, a.columnB, a.suitsA, a.suitsB,
      ...a.rows.flatMap(r => [r.label, r.a, r.b])].join(' ').toLowerCase()
    for (const t of terms) expect(haystack, `${path}: missing "${t}"`).toContain(t)
  })

  it.each(entries)('%s answers before it asks — the bridge is a separate field', (_p, a) => {
    // The answer field must stand alone. A CTA inside it would put the ask
    // before the payoff, which is what earns a bounce.
    expect(a.answer).not.toMatch(/semak|paqar|klik|daftar/i)
    expect(a.bridge).toMatch(/semak/i)
  })

  it.each(entries)('%s gives a real comparison, not a stub', (_p, a) => {
    expect(a.rows.length).toBeGreaterThanOrEqual(5)
    for (const r of a.rows) {
      expect(r.a.length).toBeGreaterThan(2)
      expect(r.b.length).toBeGreaterThan(2)
    }
  })

  it.each(entries)('%s says who each option suits', (_p, a) => {
    expect(a.suitsA.length).toBeGreaterThan(20)
    expect(a.suitsB.length).toBeGreaterThan(20)
  })

  it.each(entries)('%s surfaces a concrete buyer caveat', (_p, a) => {
    expect(a.caveat.length).toBeGreaterThan(80)
  })
})

// ── Boundary ────────────────────────────────────────────────────────────────

describe('the treatment stays inside the free/paid boundary', () => {
  const all = entries.flatMap(([, a]) => [
    a.heading, a.answer, a.columnA, a.columnB, a.suitsA, a.suitsB, a.caveat, a.bridge,
    ...a.rows.flatMap(r => [r.label, r.a, r.b]),
  ])

  it('states no price of any kind', () => {
    // These pages are free surfaces. Every figure the RM12 report sells stays
    // out — and unlike the variant guides, this copy has no premium exemption.
    for (const line of all) expect(line, line.slice(0, 60)).not.toMatch(/RM\s?\d/i)
  })

  it('names no market statistic', () => {
    for (const line of all) {
      expect(line).not.toMatch(/harga tengah|median|julat pasaran|jurang harga/i)
      expect(line).not.toMatch(/\d+\s+(listing|iklan)\b/i)
    }
  })

  it('claims no complete accident history', () => {
    // Paqar checks available claim records. "Bebas kemalangan" would be a
    // promise the data cannot keep.
    for (const line of all) expect(line).not.toMatch(/bebas kemalangan|tiada kemalangan|sejarah penuh|dijamin/i)
  })

  it('promises no verdict the free check does not give', () => {
    for (const line of all) expect(line).not.toMatch(/laporan percuma|median percuma/i)
  })
})

// ── Facts trace back to the guides ──────────────────────────────────────────

describe('claims are consistent with the existing guides', () => {
  it('bezza: the cylinder counts match the variant guide', () => {
    const guide = JSON.stringify(VARIANT_GUIDES['perodua-bezza'])
    expect(guide).toContain('3 silinder')
    expect(guide).toContain('4 silinder')
    const a = DIRECT_ANSWERS['/varian/perodua-bezza']!
    expect(a.rows.find(r => r.label === 'Enjin')?.a).toContain('3 silinder')
    expect(a.rows.find(r => r.label === 'Enjin')?.b).toContain('4 silinder')
  })

  it('bezza: the e-hailing caveat matches the guide red flags', () => {
    const guide = VARIANT_GUIDES['perodua-bezza']!
    expect(guide.redFlags.join(' ')).toMatch(/e-hailing|Grab/i)
    expect(DIRECT_ANSWERS['/varian/perodua-bezza']!.caveat).toMatch(/Grab|e-hailing/i)
  })

  it('honda city: the flood caveat matches the guide red flags', () => {
    const guide = VARIANT_GUIDES['honda-city']!
    expect(guide.redFlags.join(' ')).toMatch(/banjir/i)
    expect(DIRECT_ANSWERS['/varian/honda-city']!.caveat).toMatch(/banjir/i)
  })

  it('honda city: E is recommended, consistent with bestValue', () => {
    expect(VARIANT_GUIDES['honda-city']!.bestValue).toBe('E')
    expect(DIRECT_ANSWERS['/varian/honda-city']!.suitsA).toMatch(/kebanyakan pembeli/i)
  })
})
