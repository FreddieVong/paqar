// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ONE UNPAID PURCHASE INTENT, ONE PAYABLE BILL.
 *
 * initiateBuyerReport minted a fresh Billplz bill on every attempt. Two real
 * external buyers did exactly that in production:
 *
 *   ch_IIdRO_f9NT   2 bills, 87 seconds apart   (RM100)
 *   ch_dMZPklIrDW   3 bills, across ~4 minutes  (RM12)
 *
 * NEITHER WAS PAID. Nobody was charged twice; this is a surface, not an
 * incident. But each extra bill stays independently payable, so a buyer
 * holding several live links can pay more than one.
 *
 * The reuse must not reintroduce the problem migration 028 fixed for the
 * upgrade: every superseded bill has to stay reconcilable. On the base path it
 * always did, because each bill owns its own row — reuse adds no row and
 * rewrites no id, so that stays true.
 */

const billplz = vi.hoisted(() => ({ created: 0, state: null as unknown }))
const db      = vi.hoisted(() => ({
  reusable: null as null | { id: string; billId: string; billUrl: string },
  hasPaid:  false,
  inserts:  0,
  insertThrows: false,
}))
const money = vi.hoisted(() => ({ events: [] as { op: string; level?: string }[] }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { BILLPLZ_COLLECTION_ID_BUYER: 'c', BILLPLZ_COLLECTION_ID: 'c' } }))
vi.mock('@/lib/billplz', () => ({
  createBill: async () => { billplz.created += 1; return { id: `new_bill_${billplz.created}`, url: `https://billplz.test/new_${billplz.created}` } },
  getBill:    async () => billplz.state,
}))
vi.mock('@/lib/db/buyer-reports', () => ({
  checkHasPaidReport:  async () => db.hasPaid,
  getReusableBaseBill: async () => db.reusable,
  createBuyerReport:   async () => {
    if (db.insertThrows) throw new Error('PGRST 42703')
    db.inserts += 1
    return { id: `report_${db.inserts}` }
  },
  getBuyerReport: async () => null,
  markUpgradePaidByReportId: async () => false,
  setUpgradeBillId: async () => {},
  setVehicleApiData: async () => {},
}))
vi.mock('@/lib/observability', () => ({
  reportMoneyPathFailure: (op: string, _c: unknown, level?: string) => { money.events.push({ op, level }) },
}))
vi.mock('@/lib/db/checks', () => ({
  getCheck: async () => ({ check: { id: 'ch_1', status: 'complete', plate_encrypted: 'enc', claim_token: 't', user_id: null } }),
}))

// The offer gate recomputes sellability server-side before any bill is created
// (see lib/server/offer-for-check). These suites exercise BILL mechanics, not
// the gate, so they present a check that can be sold. The gate's own behaviour
// — including that it fails closed — is covered in checkout-offer-gate.
vi.mock('@/lib/server/offer-for-check', () => ({
  resolveOfferForCheck: vi.fn(async () => ({
    status: 'resolved' as const,
    offer:  { available: true as const, low: 40_000, high: 45_000 },
  })),
}))

vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WXY1234' }))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/db/market-prices', () => ({ fetchAndCacheMarketPrices: async () => {} }))
vi.mock('@/lib/db/vehicle-valuations', () => ({ getValuationByNvic: async () => null }))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleData: async () => null }))
vi.mock('@/lib/attribution-request', () => ({ currentAttribution: async () => ({ sessionId: null, attribution: {} }) }))
vi.mock('@/lib/db/ad-attribution', () => ({ recordCheckoutAttribution: async () => {}, recordAdEvent: async () => ({ status: 'duplicate' }), markCapiSent: async () => {} }))
vi.mock('@/lib/meta-capi', () => ({ sendMetaEvent: async () => false }))
vi.mock('@/lib/market-keyword', () => ({ buildMarketModelKeyword: () => 'myvi' }))
vi.mock('@/lib/phone-my', () => ({ normaliseMyMobile: () => null }))
vi.mock('@/lib/checkout-event-id', () => ({ checkoutEventId: () => 'evt' }))
vi.mock('@/lib/attribution', () => ({ eventId: { checkoutStarted: () => 'evt' } }))

const { initiateBuyerReport } = await import('@/app/laporan-pembeli/[checkId]/_actions')

const futureDate = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const pastDate   = () => { const d = new Date(); d.setDate(d.getDate() - 3); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

const go = () => initiateBuyerReport({
  checkId: 'ch_1', claimToken: 't', buyerEmail: 'b@example.com', baseUrl: 'https://paqar.my',
})

beforeEach(() => {
  billplz.created = 0
  billplz.state = { id: 'old_bill', paid: false, state: 'due', amount: 1200, paidAt: null, dueAt: futureDate() }
  db.reusable = null
  db.hasPaid = false
  db.inserts = 0
  db.insertThrows = false
  money.events = []
})

describe('1-4: a repeat attempt gets the SAME bill', () => {
  it('1: the first checkout creates exactly one bill', async () => {
    const r = await go()
    expect(billplz.created).toBe(1)
    expect(r.billUrl).toBe('https://billplz.test/new_1')
  })

  it('2-4: a second attempt reuses the outstanding payable bill', async () => {
    // Covers "10 seconds later", "refresh / navigate back" and "4 minutes
    // later" identically — they are all just another call with a durable row.
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    const r = await go()
    expect(billplz.created, 'no second Billplz bill').toBe(0)
    expect(r.billUrl).toBe('https://billplz.test/old')
    expect(r.error).toBeNull()
  })

  it('reuse creates no additional buyer_reports row', async () => {
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    await go()
    expect(db.inserts).toBe(0)
  })
})

describe('5: an already-paid entitlement never mints another bill', () => {
  it('checkHasPaidReport blocks before anything else happens', async () => {
    db.hasPaid = true
    const r = await go()
    expect(billplz.created).toBe(0)
    expect(r.error).toMatch(/sudah dibayar/)
  })

  it('a bill Billplz calls paid, with no paid row, is escalated not resold', async () => {
    // The webhook was missed. Selling the same report again would take a
    // second RM12 for something already bought.
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: true, state: 'paid', amount: 1200, paidAt: '2026-08-10', dueAt: futureDate() }
    const r = await go()
    expect(billplz.created).toBe(0)
    expect(r.billUrl).toBeUndefined()
    expect(money.events.map(e => e.op)).toContain('base_bill_already_paid_on_retry')
  })
})

describe('6-7: a dead bill is replaced, and the old one stays reconcilable', () => {
  it('6: a deleted bill is replaced', async () => {
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'deleted', amount: 1200, paidAt: null, dueAt: futureDate() }
    const r = await go()
    expect(billplz.created).toBe(1)
    expect(r.billUrl).toBe('https://billplz.test/new_1')
    const replaced = money.events.find(e => e.op === 'base_bill_unpayable_replaced')
    expect(replaced?.level, 'designed behaviour, not an alarm').toBe('info')
  })

  it('7: replacement writes a NEW row and never rewrites the old bill id', async () => {
    // This is what keeps a late payment on the superseded bill resolvable
    // through getBuyerReportByBillId — the failure mode 028 had to fix for the
    // upgrade path, which overwrote a single column instead.
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'deleted', amount: 1200, paidAt: null, dueAt: futureDate() }
    await go()
    expect(db.inserts, 'the replacement gets its own row').toBe(1)
  })
})

describe('when Billplz cannot be reached', () => {
  it('reuses the existing link rather than minting a second live bill', async () => {
    // A status call that times out is not evidence the bill is dead. Handing
    // back a link that probably works beats creating another payable one.
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = null
    const r = await go()
    expect(billplz.created).toBe(0)
    expect(r.billUrl).toBe('https://billplz.test/old')
  })
})

describe('13: the orphan interval is made visible', () => {
  it('a bill created then a failed row insert raises a money-path error', async () => {
    // The bill exists and is payable, and the write that was meant to make it
    // ours failed. Nothing can undo the bill, so the id must be shouted — it
    // is the only thing that makes manual recovery possible.
    db.insertThrows = true
    const r = await go()
    expect(billplz.created).toBe(1)
    expect(r.error).toMatch(/Ralat membuat pembayaran/)
    const orphan = money.events.find(e => e.op === 'base_bill_orphaned')
    expect(orphan, 'an unrecorded payable bill must never be silent').toBeDefined()
    expect(orphan?.level, 'money at risk — default error level').toBeUndefined()
  })
})

describe('the amount decides whether a bill may be reused', () => {
  it('an RM12 bill is not handed to a buyer who now wants the RM100 bundle', async () => {
    // getReusableBaseBill filters on amount_cents, so a mismatched product
    // simply finds nothing and falls through to a new bill. Reusing here would
    // take RM12 for a RM100 product.
    db.reusable = null            // what the amount filter returns for a mismatch
    const r = await go()
    expect(billplz.created).toBe(1)
    expect(r.error).toBeNull()
  })
})

describe('14: two concurrent checkouts do not mint two bills', () => {
  it('simultaneous attempts for one check share a single bill', async () => {
    // The durable row handles retries minutes apart — the shape actually seen
    // in production. This closes the same-instant window where both requests
    // read "no reusable bill" before either has written one.
    const results = await Promise.all([go(), go(), go(), go(), go()])
    expect(billplz.created, 'one bill, not five').toBe(1)
    const urls = new Set(results.map(r => r.billUrl))
    expect(urls.size, 'every caller gets the same link').toBe(1)
  })

  it('a settled checkout does not block the next one', async () => {
    await go()
    const first = billplz.created
    db.reusable = null
    await go()
    expect(billplz.created).toBeGreaterThan(first)
  })

  it('the base and bundle products are keyed apart', async () => {
    // A buyer switching from RM12 to RM100 must not be handed the RM12 bill
    // merely because it is in flight.
    await Promise.all([
      initiateBuyerReport({ checkId: 'ch_1', claimToken: 't', buyerEmail: 'b@example.com', baseUrl: 'https://paqar.my' }),
      initiateBuyerReport({ checkId: 'ch_1', claimToken: 't', buyerEmail: 'b@example.com', baseUrl: 'https://paqar.my', addJomCheck: true }),
    ])
    expect(billplz.created).toBe(2)
  })
})

describe('due_at is NOT an expiry — a past-due bill is still reused', () => {
  /**
   * CORRECTED. An earlier version of this change treated a past due_at as
   * expiry and minted a replacement. That was wrong, and it was a regression:
   * the Billplz API documentation states plainly that "the due_at value does
   * not affect the bill's payability and is only for informational reference."
   *
   * Paqar never sends a due_at, so Billplz defaults it to the bill's own
   * creation day and EVERY unpaid bill looks overdue within a day — all 11
   * unpaid external bills in production do. Reading that as expiry would have
   * minted a second bill for precisely the buyer this reuse exists to serve:
   * the one who left yesterday and came back today.
   *
   * The only thing that stops a bill being payable is state 'deleted', which
   * needs an explicit merchant DELETE that Paqar never performs.
   */
  it('due yesterday: same bill reused, NO second bill', async () => {
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'due', amount: 1200, paidAt: null, dueAt: pastDate() }
    const r = await go()
    expect(billplz.created, 'a payable bill must not be replaced').toBe(0)
    expect(r.billUrl).toBe('https://billplz.test/old')
  })

  it('due months ago: still reused', async () => {
    // e3268aa4f509f2bb in production was created 2026-06-16, due 2026-6-17,
    // and remains state 'due'.
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'due', amount: 1200, paidAt: null, dueAt: '2026-6-17' }
    const r = await go()
    expect(billplz.created).toBe(0)
    expect(r.billUrl).toBe('https://billplz.test/old')
  })

  it('due today: reused', async () => {
    const d = new Date()
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'due', amount: 1200, paidAt: null,
                      dueAt: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
    await go()
    expect(billplz.created).toBe(0)
  })

  it('no due_at at all: reused', async () => {
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'due', amount: 1200, paidAt: null, dueAt: null }
    await go()
    expect(billplz.created).toBe(0)
  })

  it('state is the ONLY thing that ends reuse: deleted replaces', async () => {
    db.reusable = { id: 'report_1', billId: 'old_bill', billUrl: 'https://billplz.test/old' }
    billplz.state = { id: 'old_bill', paid: false, state: 'deleted', amount: 1200, paidAt: null, dueAt: pastDate() }
    const r = await go()
    expect(billplz.created).toBe(1)
    expect(r.billUrl).toBe('https://billplz.test/new_1')
  })
})
