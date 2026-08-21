import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  BASE_REPORT_CENTS, BASE_REPORT_LABEL, HISTORY_UPGRADE_OPERATIONAL,
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
 * The RM88 add-on is purchasable in production today, and the second human
 * review it now promises does not exist. Selling it would take money for a
 * revision nobody can produce.
 */
describe('the history add-on cannot be sold while undeliverable', () => {
  it('is switched off', () => {
    expect(HISTORY_UPGRADE_OPERATIONAL).toBe(false)
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
