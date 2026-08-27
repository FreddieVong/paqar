// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { buildLlmsTxt } from '@/lib/seo/llms-txt'
import {
  BASE_REPORT_CENTS, COMBINED_CENTS, JOMCHECK_UPGRADE_CENTS,
  REFUND_WORKING_DAYS, REVIEW_SLA_HOURS, ringgit,
} from '@/lib/pricing'
import { LEGAL_NAME } from '@/lib/site'

/**
 * /llms.txt is the one asset written FOR machines that quote it.
 *
 * Nothing guarded it. It sat in public/ as 110 hand-typed lines and, five days
 * after it was last touched, was telling every model that reads it
 *
 *     "Paqar does not currently sell an accident or insurance-claim report."
 *
 * while the released report was selling exactly that for +RM88. A page that
 * says something false is read by the people it is wrong for; a file that says
 * something false is repeated by assistants to people who never visit the site
 * and have no way to check.
 *
 * These tests are therefore about CLAIMS, not formatting, and the load-bearing
 * one is the pair below that flips the availability gate and asserts the text
 * changes with it.
 */

const ROOT = join(__dirname, '..', '..')

/** Renders the file with the add-on gate forced to a known state. */
function withAddOn(enabled: boolean): string {
  process.env.JOMCHECK_ENABLED = enabled ? 'true' : 'false'
  return buildLlmsTxt()
}

const ORIGINAL = process.env.JOMCHECK_ENABLED
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.JOMCHECK_ENABLED
  else process.env.JOMCHECK_ENABLED = ORIGINAL
})

describe('llms.txt cannot describe a product the checkout is not selling', () => {
  it('names the add-on, its price and the total when it is on sale', () => {
    const txt = withAddOn(true)
    expect(txt).toContain(`+RM${ringgit(JOMCHECK_UPGRADE_CENTS)}`)
    expect(txt).toContain(`RM${ringgit(COMBINED_CENTS)}`)
    expect(txt).toContain('Semakan Accident/Claim Insurans')
  })

  it('denies selling it, and quotes no price, when it is off', () => {
    const txt = withAddOn(false)
    expect(txt).toContain('does not currently sell an accident or insurance-claim report')
    expect(txt, 'an add-on price survives the gate being shut')
      .not.toContain(`+RM${ringgit(JOMCHECK_UPGRADE_CENTS)}`)
    expect(txt, 'the combined total survives the gate being shut')
      .not.toContain(`RM${ringgit(COMBINED_CENTS)}`)
  })

  it('never both sells it and denies selling it', () => {
    for (const on of [true, false]) {
      const txt = withAddOn(on)
      const denies = txt.includes('does not currently sell an accident')
      const sells  = txt.includes(`+RM${ringgit(JOMCHECK_UPGRADE_CENTS)}`)
      expect(denies && sells, `both claims present with the gate ${on}`).toBe(false)
    }
  })
})

describe('the two payments are never described as one', () => {
  // Flattened: the file is hard-wrapped, so any phrase long enough to be worth
  // asserting on will straddle a line break.
  const txt = withAddOn(true).replace(/\s+/g, ' ')

  it('says in as many words that there are two', () => {
    expect(txt).toMatch(/TWO SEPARATE PRODUCTS, BOUGHT IN TWO SEPARATE PAYMENTS/)
    expect(txt).toContain('SECOND payment')
  })

  it('rejects the bundle reading explicitly, since that is the likely summary', () => {
    expect(txt).toMatch(/no bundle and no single combined checkout/i)
    expect(txt).toMatch(/one price, one payment or a bundle is wrong/i)
  })

  it('says where the add-on is sold, because it is not where a buyer would look', () => {
    // It was a checkout checkbox until 48db898. Copy that omits this sends a
    // buyer hunting for a control that no longer exists.
    expect(txt).toMatch(/only from inside the released/i)
    expect(txt).toMatch(/cannot be bought at checkout/i)
  })
})

describe('the prices are the ones the biller charges', () => {
  const txt = withAddOn(true)

  it('quotes the base report at the billed amount', () => {
    expect(txt).toContain(`RM${ringgit(BASE_REPORT_CENTS)}`)
  })

  it('quotes no price the constants do not produce', () => {
    const allowed = new Set([
      String(ringgit(BASE_REPORT_CENTS)),
      String(ringgit(JOMCHECK_UPGRADE_CENTS)),
      String(ringgit(COMBINED_CENTS)),
      '0', // the coverage check
    ])
    // Paqar's own fees only. Vehicle prices carry a separator or a 'k'
    // suffix ("RM30,000", "RM30k") and are not Paqar charging anyone.
    const quoted = [...txt.matchAll(/RM(\d+)(?![\d,k])/g)].map(m => m[1]!)
    const rogue  = [...new Set(quoted)].filter(v => !allowed.has(v))
    expect(rogue, `prices no constant produces: ${rogue.join(', ')}`).toEqual([])
  })

  it('carries no trace of the retired RM12 report or the RM100 bundle', () => {
    for (const on of [true, false]) {
      expect(withAddOn(on)).not.toMatch(/RM12\b|RM100\b/)
    }
  })
})

describe('it does not sell the product Paqar retired', () => {
  const txt = withAddOn(true).replace(/\s+/g, ' ')

  it('promises no instant valuation', () => {
    expect(txt).toMatch(/not an instant valuation/i)
    // And never asserts one anywhere, in either gate state.
    for (const on of [true, false]) {
      expect(withAddOn(on).replace(/\s+/g, ' ')).not.toMatch(/get an instant|instant (report|price|result)/i)
    }
  })

  it('offers no free price check', () => {
    expect(txt).toMatch(/not a free valuation and not a free price check/i)
    expect(txt, 'the coverage check must say what it withholds')
      .toMatch(/no verdict, no price, no median and no range/i)
  })

  it('describes the plate as optional and checked after payment', () => {
    expect(txt).toMatch(/plate\) number is OPTIONAL/)
    expect(txt).toMatch(/AFTER payment, not before/)
    expect(txt).toMatch(/cannot be described as a plate lookup/i)
  })

  it('asks for a listing link, which is what the form asks for', () => {
    expect(txt).toMatch(/LISTING LINK/)
  })

  it('does not let the plate-accepting API be mistaken for the product', () => {
    // /api/v1/valuation takes ?plate= and returns market statistics. It is the
    // one thing in this file a summariser could read back as "Paqar values a
    // car from its plate", which is the retired product exactly.
    expect(txt).toMatch(/free data endpoint, NOT the product/i)
    expect(txt).toMatch(/does not make Paqar a plate-lookup service/i)
  })
})

describe('it states who Paqar is and what is promised', () => {
  const txt = withAddOn(true).replace(/\s+/g, ' ')

  it('names the operating company', () => {
    expect(txt).toContain(LEGAL_NAME)
    expect(txt).toMatch(/data\s+controller/i)
  })

  it('publishes no registration number or registered address', () => {
    // Pending legal review. Name only.
    expect(txt).not.toMatch(/\b\d{6,}-[A-Z]\b/)           // 123456-X company number
    expect(txt).not.toMatch(/\b\d{12}\b/)                  // 202101012345 format
    expect(txt).not.toMatch(/Jalan|Lot \d|Selangor|Kuala Lumpur/)
  })

  it('names the human review and the SLA it is held to', () => {
    expect(txt).toMatch(/read and checked by a person/i)
    expect(txt).toContain(`${REVIEW_SLA_HOURS} hours`)
  })

  it('names the refund and how long it really takes', () => {
    // Billplz exposes no refund endpoint; every refund is a person moving
    // money. The copy may not imply otherwise.
    expect(txt).toMatch(/Full refund/i)
    expect(txt).toContain(`${REFUND_WORKING_DAYS} working days`)
    expect(txt).toMatch(/processed by a person, not automatically/i)
    expect(txt).not.toMatch(/instant refund|automatic refund|one-click/i)
  })

  it('keeps the limits that stop a clean result being misread', () => {
    expect(txt).toMatch(/NOT a government platform/)
    expect(txt).toMatch(/does not verify real mileage/i)
    expect(txt).toMatch(/prices sellers are ASKING/)
    expect(txt).toMatch(/not a physical inspection/i)
  })
})

/**
 * The valuation endpoint's caveat.
 *
 * ── WHY THIS IS PINNED ─────────────────────────────────────────────────────
 *
 * Verified against production on 2026-08-27, and it is the single most
 * dangerous thing this file documents. The published example
 *
 *     ?nvic=RTA12345&make=Honda&year=2020&model=City
 *
 * returns HTTP 200 and a complete valuation — and is NOT answering from that
 * NVIC. RTA12345 matches no row; `nvic=TOTALLY_FAKE` returns byte-identical
 * output. lib/db/vehicle-valuations falls back to make + year + model, ordered
 * by ascending wm_new_pr limit 1, so what comes back is the CHEAPEST variant
 * of that model-year.
 *
 * An assistant reading this file is exactly the consumer that trap is set for:
 * it gets an entry-trim figure with a confident shape and presents it as the
 * price of the car someone asked about. The caveat is the only thing standing
 * between that behaviour and a false claim attributed to Paqar, so it is
 * asserted rather than trusted to survive the next edit.
 *
 * The behaviour itself is not this change's to alter — an `as number` cast and
 * a silent fallback are API concerns, not SEO ones. What is owned here is that
 * the documentation matches what the endpoint really does.
 */
describe('the valuation API is documented as it actually behaves', () => {
  const txt = withAddOn(true).replace(/\s+/g, ' ')

  it('warns that a 200 does not mean the NVIC matched', () => {
    expect(txt).toMatch(/a 200 response does NOT mean the `nvic` matched/i)
  })

  it('names the cheapest-variant fallback, which is the part that misleads', () => {
    expect(txt).toMatch(/returns the CHEAPEST variant/i)
    expect(txt).toMatch(/entry-level trim/i)
  })

  it('spells out what each matchedBy value means, not just that it exists', () => {
    // A field name alone is not a guard. The consumer has to know that
    // `make_year_model` means "entry-level trim of that model-year".
    expect(txt).toMatch(/the NVIC matched a vehicle exactly/i)
    expect(txt).toMatch(/ENTRY-LEVEL/)
    expect(txt).toMatch(/not the car asked about/i)
  })

  it('does not claim model is optional, because omitting it 404s', () => {
    // An earlier pass "corrected" this to "model is optional and narrows the
    // match", reading the validation branch rather than the behaviour. The
    // validation does allow it; the lookup then fails. Live check:
    //   nvic+make+year        → 404
    //   nvic+make+year+model  → 200
    expect(txt).not.toMatch(/`model` is optional/i)
    expect(txt).toMatch(/without `model` the request returns 404/i)
  })

  it('names the field that says which vehicle answered', () => {
    // `matchedBy` was added to the response for this: prose telling a model to
    // be careful is weaker than a field it can branch on. Documenting the trap
    // was the stopgap; the endpoint now labels itself.
    expect(txt).toMatch(/`matchedBy` tells you which happened/i)
    expect(txt).toMatch(/must be read before quoting any figure/i)
    expect(txt).toMatch(/make_year_model/)
  })
})

describe('every URL it advertises resolves', () => {
  const txt = withAddOn(true)

  const staticRoutes = (): Set<string> => {
    const routes = new Set<string>(['/'])
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (!statSync(full).isDirectory()) continue
        if (entry.startsWith('[')) continue
        const path = entry.startsWith('(') ? prefix : `${prefix}/${entry}`
        if (existsSync(join(full, 'page.tsx'))) routes.add(path || '/')
        walk(full, path)
      }
    }
    walk(join(ROOT, 'app'), '')
    return routes
  }

  it('names no page that does not exist', () => {
    const STATIC = staticRoutes()
    const paths = [...txt.matchAll(/https:\/\/paqar\.my(\/[a-z0-9\-/]*)/g)].map(m => m[1]!)
    const dead = [...new Set(paths)]
      .filter(p => !STATIC.has(p))
      .filter(p => !p.startsWith('/api/'))            // route handlers, not pages
      .filter(p => !p.startsWith('/varian/'))         // dynamic
      .filter(p => !p.startsWith('/harga-kereta-terpakai/'))
    expect(dead, `llms.txt advertises dead URLs: ${dead.join(', ')}`).toEqual([])
  })

  it('is entirely on the canonical apex host', () => {
    expect(txt).not.toContain('https://www.paqar.my')
    expect(txt).not.toContain('http://paqar.my')
  })
})
