// @vitest-environment node
//
// Guards what a searcher actually sees for the two templates that rank.
//
// WHAT CHANGED AND WHY. This file used to assert one thing: character counts,
// against 60 for titles and 155 for descriptions, as though those were rules
// Google enforces. They are not — Google truncates on rendered pixel width,
// which varies by device, and it rewrites descriptions it dislikes regardless
// of length. Testing the count alone let a real regression through: clamping
// the /varian/* descriptions to 155 brought every one inside budget and cut
// the buyer advice out of three of the four. Honda City lost its hybrid
// service-record caveat, Bezza lost the whole 1.0 G caveat, Alphard lost both
// its SC and Executive Lounge guidance. Every length assertion passed.
//
// So the assertions here are about meaning first — the primary query survives,
// the copy is unique per page, it makes no price claim, it is a complete
// thought — and length only as a loose upper bound to catch a description
// ballooning back to 280 characters. The bounds are deliberately generous and
// labelled as heuristics, not rules.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { VARIANT_GUIDES } from '@/lib/variant-guides'
import { variantLabelListFrom } from '@/lib/variant-label'
import { clampMetaDescription } from '@/lib/meta-description'

const ROOT = process.cwd()

// Render heuristics, not Google rules. Wide enough that sensible copy never
// trips them, tight enough to catch a description that has doubled.
const TITLE_SANITY_MAX       = 65
const DESCRIPTION_SANITY_MAX = 165

// ── /bandingkan/* ───────────────────────────────────────────────────────────

function comparisons(): Array<{ slug: string; a: string; b: string }> {
  const src = readFileSync(join(ROOT, 'app/bandingkan/[slug]/page.tsx'), 'utf8')
  const re = /'([a-z0-9-]+)':\s*\{\s*titleA:\s*'([^']+)',\s*titleB:\s*'([^']+)'/g
  const out: Array<{ slug: string; a: string; b: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push({ slug: m[1]!, a: m[2]!, b: m[3]! })
  return out
}

// Mirrors generateMetadata in app/bandingkan/[slug]/page.tsx.
const comparisonTitle = (a: string, b: string) => `${a} vs ${b} — Harga Terpakai | Paqar`

describe('comparison titles', () => {
  const pairs = comparisons()

  it('finds every configured comparison', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(7)
  })

  it('keeps both model names, which is what the query matches', () => {
    // Real queries from Search Console: "saga vs bezza", "alza vs x50".
    for (const { a, b } of pairs) {
      const title = comparisonTitle(a, b)
      expect(title).toContain(a)
      expect(title).toContain(b)
    }
  })

  it('leads with the model names rather than the brand promise', () => {
    for (const { a, b } of pairs) {
      const title = comparisonTitle(a, b)
      expect(title.indexOf(a)).toBe(0)
      expect(title.indexOf(b)).toBeLessThan(title.indexOf('Harga'))
    }
  })

  it('keeps the commercial intent — these pages exist to answer a price question', () => {
    for (const { a, b } of pairs) expect(comparisonTitle(a, b)).toContain('Harga')
  })

  it('gives every comparison a distinct title', () => {
    const titles = pairs.map(p => comparisonTitle(p.a, p.b))
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('stays within a sane render budget', () => {
    for (const { a, b } of pairs) {
      expect(comparisonTitle(a, b).length).toBeLessThanOrEqual(TITLE_SANITY_MAX)
    }
  })
})

// ── /varian/* ───────────────────────────────────────────────────────────────

const guides = Object.entries(VARIANT_GUIDES)

describe('variant guide descriptions', () => {
  it('finds the real guides', () => {
    expect(guides.length).toBeGreaterThanOrEqual(4)
  })

  it.each(guides)('%s names its model', (_slug, guide) => {
    expect(guide.metaDescription).toContain(guide.model)
  })

  it.each(guides)('%s is a complete thought, not a truncation', (_slug, guide) => {
    // The clamp defect showed up exactly here: a cut description ends
    // mid-clause. A real sentence ends in terminal punctuation.
    expect(guide.metaDescription.trim()).toMatch(/[.!?]$/)
  })

  it.each(guides)('%s survives the clamp unchanged', (_slug, guide) => {
    // If the clamp still has work to do on a purpose-written description, the
    // description is too long and is losing meaning again.
    expect(clampMetaDescription(guide.metaDescription)).toBe(guide.metaDescription)
  })

  it.each(guides)('%s states no price', (_slug, guide) => {
    // Figures are what the RM12 report sells. A description must not quote one.
    expect(guide.metaDescription).not.toMatch(/RM\s?\d/i)
  })

  it.each(guides)('%s keeps the buyer recommendation', (_slug, guide) => {
    // "Untuk kebanyakan pembeli" is the phrase carrying the actual advice —
    // the part the clamp used to remove.
    expect(guide.metaDescription).toMatch(/Untuk kebanyakan pembeli|paling berbaloi/i)
  })

  it('gives every guide a distinct description', () => {
    const all = guides.map(([, g]) => g.metaDescription)
    expect(new Set(all).size).toBe(all.length)
  })

  it('stays within a sane render budget', () => {
    for (const [slug, g] of guides) {
      expect(g.metaDescription.length, `${slug} description`).toBeLessThanOrEqual(DESCRIPTION_SANITY_MAX)
    }
  })
})

describe('variant guide titles', () => {
  const titleFor = (guide: (typeof guides)[number][1]) => {
    const newest = guide.generations[guide.generations.length - 1]
    return `${guide.model} Varian Mana Patut Beli? ${variantLabelListFrom(newest?.variants ?? [])} | Paqar`
  }

  it('gives every guide a distinct title', () => {
    const all = guides.map(([, g]) => titleFor(g))
    expect(new Set(all).size).toBe(all.length)
  })

  it.each(guides)('%s lists variants from its newest generation', (_slug, guide) => {
    expect(titleFor(guide)).toContain(' vs ')
  })
})

// ── The contradiction this file exists to prevent ───────────────────────────

describe('the variant list and the recommendation must agree', () => {
  // THE REAL DEFECT. Honda City's newest generation lists a variant named
  // "S / E". variantLabel keeps the first of a slash pair — correct for
  // "Advance / AV", one trim with two names — so the page rendered
  // "S vs V vs RS e:HEV" while its own description recommended "varian E".
  // A searcher saw a recommendation for a trim absent from the list, in the
  // SERP, on a page averaging position 10.6.
  it('honda-city shows the E it recommends', () => {
    const guide  = VARIANT_GUIDES['honda-city']!
    const newest = guide.generations[guide.generations.length - 1]!
    const labels = variantLabelListFrom(newest.variants)

    expect(labels).toContain('S/E')
    expect(guide.metaDescription).toContain('varian E')
    // Both halves now name E.
    expect(labels).toMatch(/E/)
  })

  it('every guide recommending a lettered trim shows that trim in its list', () => {
    for (const [slug, guide] of guides) {
      const newest = guide.generations[guide.generations.length - 1]!
      const labels = variantLabelListFrom(newest.variants)
      const match  = guide.metaDescription.match(/varian ([A-Z](?:\/[A-Z])?)\b/)
      if (!match) continue
      expect(labels, `${slug}: description recommends "${match[1]}" but the list is "${labels}"`)
        .toContain(match[1]!)
    }
  })
})
