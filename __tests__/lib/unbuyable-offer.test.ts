// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * No page may quote a price for something nothing in the app can sell.
 *
 * The Accident/Claim add-on lives behind the JOMCHECK_ENABLED deploy flag.
 * With the flag off, PaymentForm renders no bundle checkbox and
 * initiateJomCheckUpgrade refuses outright — there is no route to purchase at
 * any price. /semak-accident-claim-insurans-kereta nonetheless quoted "RM100"
 * unconditionally in its hero offer block AND in structured data: a
 * schema.org Offer with availability InStock, plus an FAQ answer naming the
 * price. Both are things Google may surface directly in a result.
 *
 * The page itself is never gated — it sits in the sitemap at priority 0.9 and
 * the explanatory content is what ranks. Only the offer is.
 */

const ROOT = join(__dirname, '..', '..')
const SRC  = readFileSync(join(ROOT, 'app/semak-accident-claim-insurans-kereta/page.tsx'), 'utf-8')

describe('the RM100 offer is gated on the flag that makes it buyable', () => {
  it('reads the same deliverability gate the checkout and upgrade paths read', () => {
    // The env flag alone is no longer sufficient anywhere. It can be flipped by
    // someone unaware that the second human review the add-on promises does not
    // exist, and the failure is silent — money arrives, and the buyer waits for
    // a revision nobody can produce. historyUpgradeAvailable() requires BOTH.
    expect(SRC).toContain('historyUpgradeAvailable()')
    expect(SRC).not.toMatch(/JOMCHECK_ON = process\.env\.JOMCHECK_ENABLED === 'true'/)
  })

  it('gates the visible offer block', () => {
    expect(SRC).toMatch(/\{JOMCHECK_ON \? \(/)
    expect(SRC).toContain('Semakan Accident/Claim Insurans belum dibuka')
  })

  it('gates the schema.org Offer, not just the markup', () => {
    // An InStock Offer in JSON-LD is a price promise independent of the page
    // body, and can be surfaced without anyone reading the page.
    // The whole Service node — the provider object nests, so slice to the next
    // top-level graph entry rather than to the first closing brace.
    const serviceNode = SRC.split("'@type': 'Service'")[1]!.split("'@type': 'FAQPage'")[0]!
    expect(serviceNode).toContain('InStock')
    expect(serviceNode).toContain('JOMCHECK_ON')
  })

  it('gates the FAQ answer that names the price', () => {
    expect(SRC).toMatch(/\.\.\.\(JOMCHECK_ON \? \[\{[\s\S]{0,200}Berapa harga Semakan/)
  })

  it('still offers the product that IS buyable when the flag is off', () => {
    expect(SRC).toContain('/laporan-pembeli-kereta-terpakai')
  })

  it('does not gate the page itself', () => {
    // Deindexing a ranking URL to fix a pricing claim would be the wrong trade.
    expect(SRC).not.toMatch(/if \(!JOMCHECK_ON\) (return )?notFound\(\)/)
    expect(SRC).toContain('Semak rekod claim insurans kereta terpakai')
  })
})

describe('the RM12 report never claims to include accident history', () => {
  it('keeps the two products distinct wherever the add-on is described', () => {
    // Product rule: RM12 and the premium accident capability must never be
    // conflated. The offer block is explicit that RM100 is RM12 PLUS the check.
    expect(SRC).toContain('Semua dalam Laporan Pembeli RM29, ditambah semakan rekod claim insurans.')
  })

  it('states the data limits alongside the claim', () => {
    expect(SRC).toContain('Tidak semua kemalangan mempunyai rekod claim insurans')
  })
})

describe('the search-result snippet does not promise the price either', () => {
  it('gates the meta description', () => {
    // Naming RM100 in the description promises it to people who never open the
    // page — the snippet IS the offer as far as a searcher is concerned.
    const block = SRC.split('export const metadata')[1]!.split('\n}')[0]!
    expect(block).toContain('JOMCHECK_ON')
    expect(block).toMatch(/description: JOMCHECK_ON/)
  })

  it('gates the OpenGraph description too', () => {
    const og = SRC.split('openGraph:')[1]!.split('images:')[0]!
    expect(og).toContain('JOMCHECK_ON')
  })

  /** The two `: `…`` lines: the gated-off meta description and og:description. */
  const offBranches = () =>
    SRC.split('export const metadata')[1]!.split('\n}')[0]!
       .split('\n')
       .filter(l => l.trimStart().startsWith(': `'))

  it('still describes what the page is about when the flag is off', () => {
    // Asserted on the CLAIM, not on one phrasing of it. This pinned the exact
    // opener "Ketahui apa yang boleh..." and failed when the sentence was
    // shortened to fit Google's 155-character snippet — a change that left the
    // property being guarded (the page still says what it is for when nothing
    // can be bought) completely intact.
    const describes = offBranches().some(l => /boleh dan tidak boleh disemak/i.test(l))
    expect(describes, 'the gate-off description no longer describes the page').toBe(true)
  })

  it('and quotes no price in that state', () => {
    const branches = offBranches()
    expect(branches.length, 'expected a gated description and og:description').toBe(2)
    for (const line of branches) {
      expect(line, 'a price survives the gate being shut').not.toMatch(/RM|COMBINED_CENTS|ringgit\(/)
    }
  })

  it('declares the flag exactly once', () => {
    expect(SRC.match(/const JOMCHECK_ON =/g) ?? []).toHaveLength(1)
  })
})
