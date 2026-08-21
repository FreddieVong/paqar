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
  'components/report/CoverageSignal.tsx',
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
    'app/api/checks/[id]/coverage/route.ts',
    // Where both of them actually compute it. A figure could only reach a
    // response through here.
    'lib/coverage.ts',
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
  })
})

describe('the count still works internally', () => {
  it('confidence and eligibility are still derived from it', () => {
    const src = read('lib/comparables.ts')
    expect(src).toContain('export function comparableConfidence')
    expect(src).toContain('cohort.count')
  })

  it('the paid report still derives confidence from it', () => {
    // The count did not stop mattering — it stopped being FREE. Every figure
    // it drives now lives behind the paywall.
    const src = read('components/report/BuyerReportContent.tsx')
    expect(src).toContain('comparableConfidence')
  })

  /**
   * Neither free surface issues a verdict any more — they answer coverage.
   * Confidence is a property OF a verdict, so computing one on either would
   * mean a verdict had crept back in.
   */
  it('the shared coverage assessment derives eligibility but never a confidence', () => {
    const src = read('lib/coverage.ts')
    expect(src).toContain('evaluateVerdictEligibility')
    expect(src).not.toContain('comparableConfidence')
  })

  it('and neither free route computes one behind its back', () => {
    for (const path of ['app/api/price-check/route.ts', 'app/api/checks/[id]/coverage/route.ts']) {
      expect(code(read(path)), `${path} computes a confidence`).not.toContain('comparableConfidence')
    }
  })
})

describe('paid surfaces keep every figure', () => {
  const report = read('components/report/BuyerReportContent.tsx')

  it('the report still shows the median, the chips and the count', () => {
    expect(report).toContain('Harga tengah iklan setanding')
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
  it('the paid pitch promises a price figure and the offer amount', () => {
    // Rescoped from "harga pasaran sebenar" (the REAL market price) to the
    // median of the comparable adverts Paqar actually found. The PROMISE is
    // unchanged — a figure plus the amount to offer. See lib/verdict-copy.
    //
    // ONE path now, not two. This asserted the same sentence on
    // OverpricedCheckerForm, which is superseded by ListingIntakeForm and
    // mounted nowhere; requiring current copy in a component no buyer reaches
    // tests the repository rather than the product.
    expect(read('components/report/BuyerReportPitch.tsx')).toContain('Lihat harga tengah iklan setanding')
  })

  it('the homepage advertises no free tier at all', () => {
    // Stronger than the assertion this replaces. That one checked a "Percuma"
    // feature block did not promise the figures the CTA sold. There is no free
    // block left to check: the free verdict was the product being given away,
    // and removing it is the whole point of the RM29 change.
    const home = read('app/page.tsx')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')   // JSX comments
      .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
    expect(home).not.toContain('Semak Harga Percuma')
    expect(home).not.toContain('percuma')
    expect(home).not.toContain('Percuma')
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

  it('/tentang no longer describes a free verdict tier', () => {
    // This used to assert the free block promised a VERDICT and not the
    // figures behind it. There is no free verdict left to describe: giving it
    // away while charging for the footnotes is what made the old product
    // indefensible, so the pre-payment step now only says whether Paqar can
    // help at all.
    const src = read('app/tentang/page.tsx')
    const block = src.split('Semakan awal — sebelum bayar')[1]!.split('Laporan Pembeli — RM29')[0]!

    // /iklan setanding/ is deliberately NOT banned here, unlike in the other
    // free-tier assertions. It was on the list because promising comparable
    // adverts for free leaked what the report sold. Naming the set WITHOUT
    // quantifying it is now the honest description of coverage itself — the
    // same distinction VERDICT_BASIS_LINE already draws. What must stay out is
    // any actual figure, and any verdict.
    const FIGURES = [/jurang RM/i, /harga tengah/i, /julat pasaran/i]
    for (const claim of [...FIGURES, /murah, wajar, atau mahal/i]) {
      expect(block, `/tentang pre-payment block still claims ${claim}`).not.toMatch(claim)
    }
    // What it MUST say: Paqar refuses the sale when it cannot deliver.
    expect(block).toMatch(/tidak jual/i)
  })

  it('EVERY copy of the homepage objection answer stays consistent', () => {
    // The homepage answers this TWICE: once in the JSON-LD FAQPage graph and
    // once in the visible "Ada soalan?" accordion. A first-occurrence split
    // once passed while the accordion still carried a corrected claim, caught
    // only by grepping the BUILT output — hence iterating every occurrence.
    //
    // The question itself changed. "Apakah beza semakan percuma dan laporan
    // RM12?" described a boundary that no longer exists; the objection worth
    // answering on the homepage is now the one a tester actually raised.
    const src = read('app/page.tsx')
    const answers = src.split('Kenapa tak semak sendiri di Mudah atau Carlist?').slice(1)
    expect(answers.length, 'expected both the JSON-LD and the visible FAQ').toBe(2)

    for (const [i, raw] of answers.entries()) {
      const answer = raw.split('},')[0]!
      // The answer must not resurrect a free tier…
      expect(answer, `answer #${i + 1} implies a free tier`).not.toMatch(/percuma/i)
      // …and must name what Paqar actually adds over a listings portal.
      expect(answer, `answer #${i + 1} does not say what Paqar adds`)
        .toMatch(/langkah seterusnya|keputusan/i)
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
    // The label moved to Nav itself. NavAuthLink used to render a SECOND
    // "Laporan Saya" pointing at /auth, so the header showed the same label
    // twice with different destinations — one of them a login wall for a
    // product sold without accounts. It now renders nothing when logged out.
    const nav = code(read('components/layout/Nav.tsx'))
    expect(nav).toContain('Laporan Saya')
    expect(nav).toContain('/laporan-saya')
    expect(nav, 'nav still offers a login the product does not have').not.toContain('Log Masuk')

    const authLink = code(read('components/layout/NavAuthLink.tsx'))
    expect(authLink, 'duplicate "Laporan Saya" is back').not.toContain('Laporan Saya')
  })

  it('/auth promises no notification the product does not send', () => {
    // Document-EXPIRY mail ships (/api/cron/check-expiries). "Notifikasi jika
    // ada perubahan" — price/listing change alerts — does not exist anywhere.
    const src = code(read('components/auth/AuthShell.tsx'))
    expect(src).not.toMatch(/notifikasi jika ada perubahan/i)
    expect(src).toContain('Tiada kata laluan diperlukan')
  })
})

/**
 * Confidence used to be the free surface's honesty valve: a verdict was shown,
 * and a "Anggaran awal sahaja" caution beside it said how much to trust it.
 *
 * There is no free verdict any more, so there is nothing to qualify — and a
 * confidence badge with no judgement beside it would be the comparable count
 * wearing a different hat, describing the size of Paqar's sample rather than
 * anything about the buyer's car.
 */
describe('the free surface carries no confidence signal at all', () => {
  /**
   * Scoped to what is actually MOUNTED. OverpricedCheckerForm still carries
   * its RM12-era confidence copy, and it is unreachable — nothing renders it
   * but HomeCheckerTabs, which nothing renders either. Both carry DO NOT
   * REVIVE headers saying so. Asserting against a component no buyer can see
   * would either force a cosmetic edit to dead code or, worse, invite deleting
   * the assertion. What matters is that it stays unreachable, which the next
   * test pins.
   */
  const MOUNTED_FREE_UI = ['components/report/CoverageSignal.tsx']

  it.each(MOUNTED_FREE_UI)('%s has no provisional or confidence caution', (path) => {
    const src = code(read(path))
    expect(src).not.toMatch(/verdictStatus === 'provisional'/)
    expect(src).not.toContain('isProvisional')
    expect(src).not.toContain('Keyakinan data')
    expect(src).not.toContain('Anggaran awal')
  })

  it('the paid report keeps it, where a judgement stands beside it', () => {
    expect(read('components/report/BuyerReportContent.tsx')).toMatch(/Anggaran awal/)
  })

  it('the retired verdict-era forms are still mounted nowhere', () => {
    // They pre-date RM29, call /api/price-check expecting a `verdict` field it
    // no longer returns, and would put a free verdict back on screen. Reviving
    // one is the cheapest way to undo this entire change.
    const { readdirSync, statSync, readFileSync } = require('node:fs') as typeof import('node:fs')
    const ROOT_DIR = join(__dirname, '..', '..')
    const files: string[] = []
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        if (e === 'node_modules' || e === '.next') continue
        const full = join(d, e)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx$/.test(e)) files.push(full)
      }
    }
    walk(join(ROOT_DIR, 'app')); walk(join(ROOT_DIR, 'components'))

    for (const retired of ['OverpricedCheckerForm', 'PlateCheckerForm', 'HomeCheckerTabs']) {
      const mounters = files.filter(f => {
        if (f.endsWith(`${retired}.tsx`)) return false
        // A JSX mount, not an import or a comment.
        return new RegExp(`<${retired}[\\s/>]`).test(readFileSync(f, 'utf8'))
      }).map(f => f.replace(ROOT_DIR + '/', ''))
      // HomeCheckerTabs mounts the two forms; it is itself mounted nowhere, so
      // the chain is dead at the root.
      const live = mounters.filter(m => !m.endsWith('HomeCheckerTabs.tsx'))
      expect(live, `${retired} is reachable again`).toEqual([])
    }
  })
})

/**
 * The FAQ states the boundary, so it is a place the boundary can be broken.
 * It is the first thing a buyer reads about what their money buys, and the
 * proof beat renders a locked claim-history row a few centimetres above it.
 *
 * THE BOUNDARY MOVED. It used to sit between a free VERDICT and the paid
 * figures behind it — and giving away the answer while charging for the
 * footnotes is what a tester objected to and what the RM29 product exists to
 * correct. The free surface now answers COVERAGE: whether Paqar has enough
 * comparable adverts to decide at all. So these tests assert the new line, not
 * a relaxed version of the old one.
 */
describe('the homepage FAQ states the paid boundary in both directions', () => {
  const faq = readFileSync(join(ROOT, 'lib/faq/home.ts'), 'utf8')
  const freeSentence = () => faq.slice(faq.indexOf('Semakan percuma'), faq.indexOf('Laporan Pembeli (RM29)'))

  it('gives the free tier coverage only — no verdict and no figures', () => {
    expect(faq).toContain('Semakan percuma beritahu sama ada Paqar ada cukup iklan setanding')
    // The VERDICT is now paid, so its words must not appear on the free side
    // either — they are the answer, not a figure.
    for (const paid of ['harga tengah', 'julat', 'trade-in', 'skrip', 'murah', 'wajar', 'mahal']) {
      expect(freeSentence().toLowerCase(), `free tier claims "${paid}"`).not.toContain(paid)
    }
  })

  it('says plainly that the free answer contains no price', () => {
    expect(freeSentence()).toMatch(/tiada harga, tiada keputusan/)
  })

  it('attributes the decision and the guidance to RM29', () => {
    const paidSentence = faq.slice(faq.indexOf('Laporan Pembeli (RM29)'))
    for (const paid of ['iklan setanding', 'patut ditawarkan', 'ditanya penjual', 'bayar deposit']) {
      expect(paidSentence).toContain(paid)
    }
  })

  it('names the human, which is the part no free tier and no assistant provides', () => {
    expect(faq).toMatch(/orang kami baca iklan yang anda hantar/)
  })

  it('keeps claim and odometer history out of the base report', () => {
    expect(faq).toMatch(/tidak termasuk rekod tuntutan kemalangan atau bacaan odometer/)
    expect(faq).toContain('+RM88')
  })
})
