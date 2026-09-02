import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { organizationSchema } from '@/lib/site'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The Organization description decides what CATEGORY a machine files Paqar in.
 *
 * ── THE EVIDENCE THIS TEST EXISTS FOR ──────────────────────────────────────
 *
 * Asked on 2026-09-02 how a Malaysian buyer should check a used-car price
 * before paying a deposit, a live web-grounded model retrieved paqar.my — it
 * ranked third — and then filed it under "Alat Bantu Penilaian Harga", a
 * price-valuation tool beside Mudah and Carlist, while recommending PUSPAKOM,
 * MyEG and CTOS as the actions to take.
 *
 * That was the right conclusion from the wrong description. It opened
 * "membantu ... semak harga pasaran", and it is the `description` on all
 * eighteen Organization nodes on the site. A price checker competing against
 * free price checkers loses on price. What Paqar actually sells — a person's
 * verdict on one advert — has no competitor in that market, and was not what
 * the entity description said.
 *
 * Retrieval was never the problem, so this is not a ranking test. It pins the
 * one sentence that tells an answer engine which question Paqar is the answer
 * to.
 */
const site = readFileSync(join(__dirname, '..', '..', 'lib/site.ts'), 'utf8')

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

// organizationSchema() calls the gate at INVOCATION time, not module load, so
// flipping the env var between calls is enough — no module-registry reset.
const description = (): string =>
  (organizationSchema() as { description: string }).description

describe('the entity description sells the decision, not a price check', () => {
  const code = strip(site)

  it('does not open by calling Paqar a market-price checker', () => {
    // The exact opening that produced the "price valuation tool" filing.
    expect(code).not.toMatch(/membantu pembeli kereta terpakai Malaysia semak harga pasaran/)
  })

  it('leads with the human verdict on one advert', () => {
    expect(code).toMatch(/menyemak satu iklan kereta terpakai/)
    expect(code).toMatch(/Seorang manusia membaca iklan itu/)
    expect(code).toMatch(/teruskan, runding, atau lepaskan/)
  })
})

describe('and it does not sell the add-on by hand', () => {
  const ORIGINAL = process.env.JOMCHECK_ENABLED
  beforeEach(() => { delete process.env.JOMCHECK_ENABLED })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.JOMCHECK_ENABLED
    else process.env.JOMCHECK_ENABLED = ORIGINAL
  })

  /**
   * JOMCHECK_ENABLED is undefined under vitest, so a gate-derived string only
   * ever exercises its OFF branch unless the test sets it. Both are asserted
   * here deliberately — this description was unconditional before, and would
   * have advertised an unbuyable product on eighteen nodes the moment the gate
   * moved.
   */
  it('stays silent about claim records when the add-on is off', () => {
    expect(description()).not.toMatch(/[Rr]ekod tuntutan/)
  })

  it('names them, and where they are actually sold, when it is on', () => {
    process.env.JOMCHECK_ENABLED = 'true'
    const d = description()
    expect(d).toMatch(/Rekod tuntutan insurans boleh ditambah kemudian/)
    // Sold from inside the released report, never at checkout.
    expect(d).toMatch(/dari dalam laporan/)
    expect(d).toMatch(/selepas nombor plat disahkan/)
  })
})
