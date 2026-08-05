import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// Free answers WHETHER the price is right. Paid answers WHAT TO DO about it.
//
// The line moved because two things were on the wrong side: the comparable
// count (which describes Paqar's sample rather than the buyer's car, and which
// no layperson finds impressive at any value), and the range (which made
// "Lihat harga pasaran sebenar" a false promise).
//
// These are source-level guards. The behavioural proof lives in the API tests;
// this catches a figure being reintroduced into a component by hand.

const FREE_UI = [
  'components/check/OverpricedCheckerForm.tsx',
  'components/report/FreePriceEvidence.tsx',
]

/** Strip comments — several of these files document the removed markup on purpose. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('free UI renders no market figures', () => {
  it.each(FREE_UI)('%s interpolates no price field', (path) => {
    const src = code(read(path))
    for (const field of ['minPrice', 'maxPrice', 'medianPrice', 'listingCount']) {
      expect(src, `${path} still references ${field}`).not.toContain(field)
    }
  })

  it.each(FREE_UI)('%s renders no "N iklan/listing" phrasing', (path) => {
    const src = code(read(path))
    expect(src).not.toMatch(/Berdasarkan \{/)
    expect(src).not.toMatch(/iklan setanding (ditemui|dijumpai)/)
    expect(src).not.toMatch(/listing pasaran terkini/)
  })

  it.each(FREE_UI)('%s builds no RM figure from the API response', (path) => {
    const src = code(read(path))
    // Echoing the buyer's OWN asking price back is fine — the collapsed summary
    // and the loan-calculator link both do it. What must never appear is an RM
    // amount derived from the market response.
    for (const line of src.split('\n')) {
      if (!/RM\$?\{/.test(line)) continue
      expect(line, `market-derived RM figure: ${line.trim()}`)
        .not.toMatch(/dataResult|data\.(min|max|median|listing)/)
    }
  })

  it('the model checker no longer suggests an opening offer', () => {
    const src = code(read('components/check/OverpricedCheckerForm.tsx'))
    for (const gone of ['NegotiationNudge', 'computeSuggestedOffer', 'suggestedOffer', 'Potensi jimat']) {
      expect(src, `still present: ${gone}`).not.toContain(gone)
    }
  })
})

describe('free APIs return a judgement, not data', () => {
  const routes = [
    'app/api/price-check/route.ts',
    'app/api/checks/[id]/price-evidence/route.ts',
  ]

  it.each(routes)('%s serialises no market figure', (path) => {
    const src = code(read(path))
    // The fields may be COMPUTED (they drive confidence and eligibility) but
    // must never appear as a response key.
    for (const key of ['medianPrice:', 'minPrice:', 'maxPrice:', 'listingCount:']) {
      expect(src, `${path} serialises ${key}`).not.toContain(key)
    }
  })

  it('the response type has no numeric market fields', () => {
    const src = code(read('types/api.ts'))
    const block = src.split('export type PriceCheckResult')[1]!.split('\n}')[0]!
    for (const field of ['medianPrice', 'minPrice', 'maxPrice', 'listingCount']) {
      expect(block, `PriceCheckResult still declares ${field}`).not.toContain(field)
    }
    // What it does keep.
    for (const kept of ['verdict', 'verdictStatus', 'confidence']) {
      expect(block).toContain(kept)
    }
  })
})

describe('the count still works internally', () => {
  it('confidence and eligibility are still derived from it', () => {
    const src = read('lib/comparables.ts')
    expect(src).toContain('export function comparableConfidence')
    expect(src).toContain('cohort.count')
  })

  it('the free routes still call both helpers', () => {
    for (const path of ['app/api/price-check/route.ts', 'app/api/checks/[id]/price-evidence/route.ts']) {
      const src = read(path)
      expect(src).toContain('comparableConfidence(cohort.count)')
      expect(src).toContain('evaluateVerdictEligibility')
    }
  })
})

describe('paid surfaces keep every figure', () => {
  const report = read('components/report/BuyerReportContent.tsx')

  it('the report still shows the median, the chips and the count', () => {
    expect(report).toContain('Harga tengah pasaran')
    expect(report).toContain('Anggaran trade-in')
    expect(report).toMatch(/listing serupa di pasaran/)
  })

  it('the report keeps its own provisional caution with the count', () => {
    expect(report).toMatch(/Anggaran awal — hanya \{mPrices\.length\} iklan setanding/)
  })

  it('the public valuation API still returns marketCount for citation', () => {
    // Deliberate exception: a published contract whose audience is integrators
    // and LLMs, where the count ADDS credibility. TRANSPARENCY.md instructs
    // LLMs to quote it.
    expect(read('app/api/v1/valuation/route.ts')).toContain('marketCount')
    expect(read('docs/api/openapi.json')).toContain('marketCount')
  })
})

describe('CTA copy is true now that figures are paid', () => {
  it('both paths promise the market price and the offer amount', () => {
    expect(read('components/report/BuyerReportPitch.tsx')).toContain('Lihat harga pasaran sebenar')
    expect(read('components/check/OverpricedCheckerForm.tsx'))
      .toContain('Lihat harga pasaran sebenar dan jumlah yang patut anda tawarkan — RM12')
  })

  it('the homepage does not advertise the range as free', () => {
    // This block carries a "Percuma" badge and listed "Harga tengah & julat
    // pasaran" — promising for free exactly what the CTA now sells.
    const home = read('app/page.tsx')
    const block = home.split("'Keputusan harga percuma',")[1]!.split('].map')[0]!
    expect(block).not.toContain('julat pasaran')
    expect(block).not.toContain('Harga tengah')
  })

  it('no free surface claims to show the real market price', () => {
    for (const path of FREE_UI) {
      const src = code(read(path))
      // "Harga pasaran: RM…" was the line that made the CTA a lie.
      expect(src).not.toMatch(/Harga pasaran: /)
    }
  })
})

describe('confidence carries the provisional signal', () => {
  it.each(FREE_UI)('%s has no separate provisional caution', (path) => {
    const src = code(read(path))
    expect(src).not.toMatch(/verdictStatus === 'provisional'/)
    expect(src).not.toContain('isProvisional')
  })

  it.each(FREE_UI)('%s low-confidence copy explains itself', (path) => {
    expect(read(path)).toContain('Anggaran awal sahaja')
  })
})
