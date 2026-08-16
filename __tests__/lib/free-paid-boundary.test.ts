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
    expect(report).toMatch(/iklan setanding yang kami jumpa/)
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
  it('both paths promise a price figure and the offer amount', () => {
    // Rescoped from "harga pasaran sebenar" (the REAL market price) to the
    // median of the comparable adverts Paqar actually found. The PROMISE is
    // unchanged — a figure plus the amount to offer — and both paths still
    // make the same one. See lib/verdict-copy.
    expect(read('components/report/BuyerReportPitch.tsx')).toContain('Lihat harga tengah iklan setanding')
    expect(read('components/check/OverpricedCheckerForm.tsx'))
      .toContain('Lihat harga tengah iklan setanding dan jumlah yang patut anda tawarkan — RM12')
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

/**
 * The UI moved before the PROSE did.
 *
 * The homepage card dropped "Harga tengah & julat pasaran" from the free list
 * and the test above locked that in — but two surfaces kept describing the old
 * product in sentences, which no assertion read:
 *
 *   /tentang          "bagi keputusan: murah, wajar, atau mahal — dengan
 *                      jurang RM dari harga tengah pasaran"
 *   homepage JSON-LD  "Semakan percuma beri keputusan harga dan jurang RM dari
 *                      harga tengah pasaran"
 *
 * The JSON-LD one is the worse of the two: it is a FAQPage answer, so it was
 * shipped to Google as the canonical description of what free includes, while
 * the page it sits on said otherwise.
 *
 * These read the free-tier passage only — both files legitimately describe the
 * PAID tier in the very next sentence, and a file-wide ban would forbid that.
 */
describe('prose describing the free tier promises no paid figure', () => {
  const FREE_CLAIMS = [/jurang RM/i, /harga tengah/i, /julat pasaran/i, /iklan setanding/i]

  it('/tentang describes free as a verdict, not a gap', () => {
    const src = read('app/tentang/page.tsx')
    // The free block runs from its heading to the RM12 heading below it.
    const block = src.split('Semak harga pasaran — percuma')[1]!.split('Laporan Pembeli — RM12')[0]!
    for (const claim of FREE_CLAIMS) {
      expect(block, `/tentang free block still claims ${claim}`).not.toMatch(claim)
    }
    expect(block).toMatch(/murah, wajar, atau mahal/)
  })

  it('the homepage answer exists exactly once, so it cannot be half-corrected', () => {
    // This test used to iterate TWO copies: the JSON-LD FAQPage graph and the
    // visible accordion both carried the answer, and a first-occurrence split
    // once passed while the accordion still said "jurang RM dari harga tengah
    // pasaran". The duplication is now gone — lib/faq/home.ts is the only copy
    // and app/page.tsx renders it twice from that one array — so the guard
    // becomes: there is one source, and its free half is clean.
    expect(read('app/page.tsx')).not.toContain('Apakah beza semakan percuma dan laporan RM12?')

    const faq = read('lib/faq/home.ts')
    const answers = faq.split('Apakah beza semakan percuma dan laporan RM12?').slice(1)
    expect(answers.length, 'one source of truth').toBe(1)

    const freeHalf = answers[0]!.split('Laporan Pembeli (RM12)')[0]!
    for (const claim of FREE_CLAIMS) {
      expect(freeHalf, `the free half still describes free as ${claim}`).not.toMatch(claim)
    }
  })
})

describe('the paywall shows the product before asking for money', () => {
  it('the RM12 pitch links to the sample report', () => {
    const src = read('components/report/BuyerReportPitch.tsx')
    expect(src).toContain('SampleReportLink')
  })

  it('the link opens in a new tab so checkout state survives', () => {
    const src = read('components/report/SampleReportLink.tsx')
    expect(src).toContain('/contoh-laporan')
    expect(src).toContain("target=\"_blank\"")
    expect(src).toContain('rel="noopener noreferrer"')
  })

  it('it fires one diagnostic event and never reaches Meta', () => {
    const src = read('components/report/SampleReportLink.tsx')
    expect(src).toContain('analytics.sampleReportClicked')
    // Meta CAPI needs an explicit trackAdEvent call — this must not have one,
    // or the sample click becomes a conversion signal in the ad account.
    expect(src).not.toContain('trackAdEvent')
    expect(read('lib/analytics.ts')).toContain("posthog.capture('sample_report_clicked'")
  })
})

describe('nav does not contradict "Tanpa daftar"', () => {
  it('the logged-out nav link names the reports, not an account', () => {
    const src = code(read('components/layout/NavAuthLink.tsx'))
    expect(src).toContain('Laporan Saya')
    expect(src, 'nav still offers a login the product does not have').not.toContain('Log Masuk')
  })

  it('/auth promises no notification the product does not send', () => {
    // Document-EXPIRY mail ships (/api/cron/check-expiries). "Notifikasi jika
    // ada perubahan" — price/listing change alerts — does not exist anywhere.
    const src = code(read('components/auth/AuthShell.tsx'))
    expect(src).not.toMatch(/notifikasi jika ada perubahan/i)
    expect(src).toContain('Tiada kata laluan diperlukan')
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

/**
 * The FAQ now states the boundary, so it becomes a place the boundary can be
 * broken. The free/RM12 answer is the first thing a buyer reads about what
 * their money buys, and the proof beat renders a locked RM88 history row a few
 * centimetres above it.
 */
describe('the homepage FAQ states the paid boundary in both directions', () => {
  const faq = readFileSync(join(ROOT, 'lib/faq/home.ts'), 'utf8')

  it('gives the free tier a verdict, an explanation and a confidence — no figures', () => {
    expect(faq).toContain('Semakan percuma beri keputusan harga — murah, wajar atau mahal — dengan penjelasan dan tahap keyakinan data.')
    // No median, range, gap, offer or trade-in attributed to the free check.
    const freeSentence = faq.slice(faq.indexOf('Semakan percuma beri'), faq.indexOf('Laporan Pembeli (RM12)'))
    for (const paid of ['harga tengah', 'julat', 'trade-in', 'skrip']) {
      expect(freeSentence.toLowerCase()).not.toContain(paid)
    }
  })

  it('attributes every figure to RM12', () => {
    const paidSentence = faq.slice(faq.indexOf('Laporan Pembeli (RM12)'))
    for (const paid of ['harga tengah', 'julat', 'trade-in', 'skrip rundingan']) {
      expect(paidSentence).toContain(paid)
    }
  })

  it('keeps claim and odometer history out of RM12', () => {
    expect(faq).toMatch(/RM12 tidak termasuk rekod tuntutan kemalangan atau bacaan odometer/)
    expect(faq).toContain('+RM88')
  })
})
