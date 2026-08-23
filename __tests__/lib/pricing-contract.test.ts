import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  BASE_REPORT_CENTS, BASE_REPORT_LABEL, HISTORY_UPGRADE_OPERATIONAL,
  COMBINED_CENTS, JOMCHECK_UPGRADE_CENTS,
} from '@/lib/pricing'

const ROOT = join(__dirname, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, e)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(e)) out.push(rel)
  }
  return out
}

/** Strip comments — several files document the old pricing on purpose. */
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Internal operator tooling is excluded, and deliberately so.
 *
 * app/admin/ads and lib/meta-ads label HISTORICAL metrics — `purchasesRm12`
 * counts purchases that really were RM12. Renaming those would make the label
 * disagree with the data behind it and break continuity across the price
 * change, which is the opposite of the honesty this test exists to enforce.
 * Neither surface is ever shown to a buyer.
 */
const INTERNAL_ONLY = ['app/admin/', 'lib/meta-ads/']

const SOURCES = [...walk('app'), ...walk('components'), ...walk('lib')]
  .filter(f => !INTERNAL_ONLY.some(p => f.replace(/\\/g, '/').startsWith(p)))

describe('the price the buyer sees is the price they are charged', () => {
  it('the label is derived from the billed amount, not typed twice', () => {
    expect(BASE_REPORT_LABEL).toBe(`RM${BASE_REPORT_CENTS / 100}`)
  })

  /**
   * RM12 was the old base price. Any surviving instance in live copy would
   * advertise a price Paqar does not charge — and on the one page where a
   * stranger is asked to trust it.
   *
   * Car prices ("Harga: RM12–18k", "bawah RM12,000") are excluded: those are
   * real-world vehicle values, not Paqar's fee.
   */
  /**
   * Modules a buyer cannot reach.
   *
   * The two forms are superseded by ListingIntakeForm and carry DO NOT REVIVE
   * headers saying, in as many words, that their copy predates RM29 — editing
   * that copy would make those headers false while changing nothing anyone
   * sees. plate-first-cohort is a MEASUREMENT module whose RM12_CENTS defines a
   * historical cohort: rewriting it to 2900 would silently redefine which
   * customers the analysis is about.
   *
   * Scoped rather than deleted from the test, so the exemption is a stated
   * judgement with a reason attached instead of a quietly loosened regex.
   */
  const UNREACHABLE = new Set([
    'components/check/OverpricedCheckerForm.tsx',
    'components/check/PlateCheckerForm.tsx',
    'components/check/HomeCheckerTabs.tsx',
    'lib/measurement/plate-first-cohort.ts',
  ])

  it('no live copy advertises the old RM12 report price', () => {
    const offenders: string[] = []
    for (const f of SOURCES) {
      if (UNREACHABLE.has(relative('.', f))) continue
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      // RM12 NOT followed by a digit, comma, dash or 'k' — all of those are
      // real-world VEHICLE prices ("RM12,000", "RM12k", "RM12–18k"), not
      // Paqar's fee. Only a bare RM12 can be the old report price.
      if (/RM12(?![\d,k–\-])/.test(src)) offenders.push(relative('.', f))
    }
    expect(offenders, `stale RM12 in: ${offenders.join(', ')}`).toEqual([])
  })

  it('no live copy quotes the old RM19 default either', () => {
    const offenders: string[] = []
    for (const f of SOURCES) {
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      if (/Laporan Pembeli[^<]{0,20}RM19\b/.test(src)) offenders.push(relative('.', f))
    }
    expect(offenders).toEqual([])
  })
})

/**
 * The combined price was typed as 10000 — correct when the base was RM12, and
 * silently wrong the moment it became RM29. The checkout then showed
 * "Bayar RM29" beside "+RM88" and billed RM100. Freddie caught it on the live
 * page, which is the worst place to catch a price.
 */
describe('the total always equals its parts', () => {
  it('is derived, not typed', () => {
    expect(COMBINED_CENTS).toBe(BASE_REPORT_CENTS + JOMCHECK_UPGRADE_CENTS)
  })

  it('is computed in source, so it cannot be re-pinned by hand', () => {
    const src = readFileSync(join(ROOT, 'lib/pricing.ts'), 'utf8')
    expect(src).toMatch(/COMBINED_CENTS\s*=\s*BASE_REPORT_CENTS\s*\+\s*JOMCHECK_UPGRADE_CENTS/)
  })

  it('names no total in copy that the constants do not produce', () => {
    // A page that writes the total as a literal will disagree with the bill
    // the next time either price moves — which is exactly what happened.
    const page = readFileSync(join(ROOT, 'app/semak-accident-claim-insurans-kereta/page.tsx'), 'utf8')
    const visible = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(visible, 'a hardcoded total is back on the accident page')
      .not.toMatch(/RM\s?100\b/)
  })
})

/**
 * The checkout and the biller must agree about whether the add-on exists.
 *
 * PaymentForm computed its own availability from NEXT_PUBLIC_JOMCHECK_ENABLED
 * while the server used JOMCHECK_ENABLED. In production they disagreed: the
 * checkout showed the "+RM88" checkbox, and the server gate that decides what
 * is billed and fulfilled was shut. A buyer who ticked it was charged the base
 * price, told nothing, and got no claim records — their opt-in discarded in
 * silence.
 */
describe('one gate decides the add-on, not two', () => {
  const form = readFileSync(join(ROOT, 'components/report/PaymentForm.tsx'), 'utf8')

  it('the checkout reads no environment variable of its own', () => {
    expect(code(form), 'PaymentForm decides availability for itself again')
      .not.toMatch(/process\.env\.[A-Z_]*JOMCHECK/)
  })

  it('it is told by the server instead', () => {
    expect(form).toContain('historyAddOnAvailable')
  })

  it('and the server tells it with the same function that bills', () => {
    const page = readFileSync(join(ROOT, 'app/laporan-pembeli/[checkId]/page.tsx'), 'utf8')
    expect(page).toMatch(/historyAddOnAvailable=\{historyUpgradeAvailable\(\)\}/)

    const actions = readFileSync(join(ROOT, 'app/laporan-pembeli/[checkId]/_actions.ts'), 'utf8')
    expect(actions, 'billing uses a different gate from the checkout')
      .toContain('historyUpgradeAvailable()')
  })
})

describe('the history add-on cannot be sold while undeliverable', () => {
  /**
   * The invariant was never "the add-on is off" — it is "the add-on is on only
   * when the whole journey behind it exists". It was off because the second
   * human review did not exist. It does now, so the assertion moves to the
   * thing that actually matters: every step of that journey is present.
   *
   * Flipping the constant back to true with any of these missing is exactly
   * the silent failure the constant was created to prevent.
   */
  it('is on only while every step of the journey exists', () => {
    if (!HISTORY_UPGRADE_OPERATIONAL) return

    const review = readFileSync(join(ROOT, 'lib/db/report-review.ts'), 'utf8')
    // The records go back to a person...
    expect(review, 'no second-review queue').toContain('listReportsAwaitingHistoryReview')
    // ...who releases them, and only then.
    expect(review, 'no history release').toContain('releaseHistoryReview')
    expect(review).toContain("jomcheck_status: 'reviewed'")

    // The reviewer has somewhere to do it.
    expect(readFileSync(join(ROOT, 'app/admin/review/_actions.ts'), 'utf8'))
      .toContain('releaseHistoryAction')
    expect(readFileSync(join(ROOT, 'app/admin/review/page.tsx'), 'utf8'))
      .toContain('historyReview')

    // And the buyer sees the section only after that release — never on
    // 'success', which means the data arrived and nobody has read it yet.
    const report = readFileSync(join(ROOT, 'components/report/BuyerReportContent.tsx'), 'utf8')
    expect(report).toContain("jomcheckStatus === 'reviewed'")
    expect(report, 'raw records render before anyone reads them')
      .not.toContain("jomcheckStatus === 'success' && jomcheckData\n          ? <JomCheckSection")
  })

  it.each([
    'components/report/PaymentForm.tsx',
    'app/laporan-pembeli/[checkId]/page.tsx',
    'app/laporan-pembeli/[checkId]/selesai/page.tsx',
    'app/laporan-pembeli/[checkId]/_actions.ts',
    'app/semak-accident-claim-insurans-kereta/page.tsx',
    'lib/email/receipt.ts',
  ])('%s gates on deliverability, not only on configuration', (f) => {
    const src = readFileSync(join(ROOT, f), 'utf8')
    expect(src).toMatch(/historyUpgradeAvailable|HISTORY_UPGRADE_OPERATIONAL/)
  })

  /**
   * An env var alone is too weak: it can be flipped by someone who does not
   * know the review journey is missing, and the failure is silent — money
   * arrives and the buyer waits for a revision nobody can produce.
   */
  it('no surface relies on the env var by itself', () => {
    const offenders: string[] = []
    for (const f of SOURCES) {
      if (f.endsWith('lib/pricing.ts') || f.includes('jomcheck')) continue
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      for (const line of src.split('\n')) {
        if (/JOMCHECK_ENABLED\s*===\s*'true'/.test(line)
            && !/historyUpgradeAvailable|HISTORY_UPGRADE_OPERATIONAL/.test(line)) {
          offenders.push(`${relative('.', f)}: ${line.trim().slice(0, 70)}`)
        }
      }
    }
    expect(offenders, `ungated: ${offenders.join(' | ')}`).toEqual([])
  })
})

/**
 * The claim lookup is keyed on the registration number, and the webhook has
 * always known it — fulfilment fires on `add_jomcheck && plate`. Nothing
 * enforced the other half. A buyer with no plate (the default journey since
 * migration 032) could tick +RM88, be billed RM117, and have no fulfilment
 * alert raised at all: money taken, then silence, because nobody was told to
 * produce anything.
 */
describe('the add-on cannot be sold without a plate', () => {
  it('the biller refuses to charge for it', () => {
    const actions = readFileSync(join(ROOT, 'app/laporan-pembeli/[checkId]/_actions.ts'), 'utf8')
    expect(actions).toMatch(/const hasPlate\s*=\s*!!row\.check\.plate_encrypted/)
    expect(actions).toMatch(/effectiveAddJomCheck\s*=\s*jomcheckEnabled && hasPlate/)
  })

  it('and the checkout does not offer it', () => {
    const form = readFileSync(join(ROOT, 'components/report/PaymentForm.tsx'), 'utf8')
    expect(form).toMatch(/historyAddOnAvailable && hasPlate &&/)
  })

  it('but says why, so a buyer knows it is one field away', () => {
    const form = code(readFileSync(join(ROOT, 'components/report/PaymentForm.tsx'), 'utf8'))
    expect(form).toMatch(/historyAddOnAvailable && !hasPlate &&/)
    expect(form).toMatch(/nombor plat/i)
  })

  it('the webhook still guards its own half', () => {
    const hook = readFileSync(join(ROOT, 'app/api/webhooks/billplz/route.ts'), 'utf8')
    expect(hook).toMatch(/add_jomcheck && plate/)
  })
})
