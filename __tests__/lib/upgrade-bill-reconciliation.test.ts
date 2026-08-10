// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * THE INVARIANT: every bill Paqar creates must remain reconcilable if Billplz
 * later marks it paid.
 *
 * THE DEFECT
 *
 * initiateJomCheckUpgrade minted a fresh Billplz bill on every click and
 * setUpgradeBillId overwrote buyer_reports.upgrade_bill_id with it. Billplz
 * bills stay payable until paid, so the previous bill lived on while Paqar
 * forgot it:
 *
 *   1. buyer pays RM12, clicks "add RM88"   -> bill A, upgrade_bill_id = A
 *   2. abandons Billplz, clicks again       -> bill B, upgrade_bill_id = B
 *   3. pays bill A from browser history
 *   4. webhook: getBuyerReportByUpgradeBillId(A) -> null
 *   5. RM88 received, premium entitlement never granted
 *
 * TWO LAYERS
 *
 *   prevention     a retry hands back the SAME bill, so two outstanding bills
 *                  cannot exist (needs upgrade_bill_url, migration 028)
 *   reconciliation an orphaned bill is resolved through checkout_attributions,
 *                  whose billplz_bill_id is UNIQUE and written per bill — this
 *                  covers bills created BEFORE the migration, which carry an id
 *                  but no URL
 */

const fake = new FakeSupabase()
const createBill = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fake,
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
const getBill = vi.fn()
vi.mock('@/lib/billplz', () => ({ createBill, getBill }))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WXY1234', hash: (v: string) => `h(${v})` }))
vi.mock('@/lib/env', () => ({ env: { BILLPLZ_COLLECTION_ID: 'col', BILLPLZ_COLLECTION_ID_BUYER: 'colb' } }))
vi.mock('@/lib/attribution-request', () => ({ currentAttribution: async () => ({ sessionId: null, attribution: {} }) }))
vi.mock('@/lib/meta-capi', () => ({ sendMetaEvent: vi.fn(async () => false) }))
vi.mock('@/lib/db/plate-lookups', () => ({ getOrFetchVehicleData: vi.fn(async () => null) }))
vi.mock('@/lib/db/vehicle-valuations', () => ({ getValuationByNvic: vi.fn(async () => null) }))
vi.mock('@/lib/db/market-prices', () => ({ fetchAndCacheMarketPrices: vi.fn(async () => {}) }))
vi.mock('@/lib/db/ad-attribution', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/ad-attribution')>('@/lib/db/ad-attribution')
  return { ...actual, recordAdEvent: vi.fn(async () => ({ status: 'inserted' })), markCapiSent: vi.fn(async () => {}) }
})

const { initiateJomCheckUpgrade } = await import('@/app/laporan-pembeli/[checkId]/_actions')
const { markUpgradePaidByReportId, setUpgradeBillId, getBuyerReport } = await import('@/lib/db/buyer-reports')

const CHECK = 'ch_1', REPORT = 'br_1'
const ARGS  = { checkId: CHECK, claimToken: 'tok', baseUrl: 'https://paqar.my' }

function seed(over: Record<string, unknown> = {}) {
  fake.rows('checks').push({ id: CHECK, claim_token: 'tok', status: 'complete', plate_encrypted: 'e', deleted_at: null })
  fake.rows('buyer_reports').push({
    id: REPORT, check_id: CHECK, status: 'paid', buyer_email: 'b@e.com',
    amount_cents: 1200, add_jomcheck: false, created_at: '2026-08-01T00:00:00Z',
    upgrade_bill_id: null, upgrade_bill_url: null, ...over,
  })
}
const report = () => fake.rows('buyer_reports').find(r => r.id === REPORT)!

beforeEach(() => {
  fake.tables.clear()
  vi.clearAllMocks()
  process.env.JOMCHECK_ENABLED = 'true'
  createBill.mockResolvedValue({ id: 'bill_A', url: 'https://billplz/bill_A' })
  // Default: the stored bill is still payable.
  getBill.mockResolvedValue({ id: 'bill_A', paid: false, state: 'due', url: 'https://billplz/bill_A' })
})

describe('one outstanding upgrade bill, ever', () => {
  it('creates a bill on the first click and stores its URL', async () => {
    seed()
    const res = await initiateJomCheckUpgrade(ARGS)
    expect(res.billUrl).toBe('https://billplz/bill_A')
    expect(report().upgrade_bill_id).toBe('bill_A')
    expect(report().upgrade_bill_url).toBe('https://billplz/bill_A')
  })

  it('abandon then retry returns the SAME bill, not a second one', async () => {
    seed()
    await initiateJomCheckUpgrade(ARGS)
    createBill.mockClear()
    createBill.mockResolvedValue({ id: 'bill_B', url: 'https://billplz/bill_B' })

    const retry = await initiateJomCheckUpgrade(ARGS)

    expect(createBill, 'a second upgrade bill was created').not.toHaveBeenCalled()
    expect(retry.billUrl).toBe('https://billplz/bill_A')
    expect(report().upgrade_bill_id).toBe('bill_A')
  })

  it('survives many retries without ever orphaning a bill', async () => {
    seed()
    await initiateJomCheckUpgrade(ARGS)
    for (let i = 0; i < 5; i++) await initiateJomCheckUpgrade(ARGS)
    expect(createBill).toHaveBeenCalledTimes(1)
    expect(report().upgrade_bill_id).toBe('bill_A')
  })

  it('refuses once the upgrade is already entitled', async () => {
    seed({ add_jomcheck: true })
    const res = await initiateJomCheckUpgrade(ARGS)
    expect(res.error).toBe('Semakan Accident/Claim sudah ditambah')
    expect(createBill).not.toHaveBeenCalled()
  })

  it('refuses when the base report is not paid', async () => {
    seed({ status: 'pending' })
    const res = await initiateJomCheckUpgrade(ARGS)
    expect(res.error).toBe('Laporan belum dibayar')
    expect(createBill).not.toHaveBeenCalled()
  })

  it('still mints a bill for a legacy row that has an id but no URL', async () => {
    // Pre-028 rows cannot be reused — there is no URL to send anyone to. They
    // must not be left unable to upgrade; reconciliation covers the risk.
    seed({ upgrade_bill_id: 'bill_OLD', upgrade_bill_url: null })
    const res = await initiateJomCheckUpgrade(ARGS)
    expect(createBill).toHaveBeenCalledTimes(1)
    expect(res.billUrl).toBe('https://billplz/bill_A')
  })
})

describe('entitlement is granted exactly once', () => {
  it('a duplicate webhook grants once', async () => {
    seed()
    expect(await markUpgradePaidByReportId(REPORT)).toBe(true)
    expect(await markUpgradePaidByReportId(REPORT)).toBe(false)
    expect(report().add_jomcheck).toBe(true)
  })

  it('records the amount and the timestamp with the flag', async () => {
    seed()
    await markUpgradePaidByReportId(REPORT)
    expect(report().upgrade_amount_cents).toBe(8800)
    expect(report().upgrade_paid_at).toBeTruthy()
  })

  it('an out-of-order webhook for a superseded bill still lands on the report', async () => {
    // Bill A paid AFTER bill B was created. Resolution is by report id, so the
    // order the bills were created in cannot matter.
    seed({ upgrade_bill_id: 'bill_B', upgrade_bill_url: 'https://billplz/bill_B' })
    expect(await markUpgradePaidByReportId(REPORT)).toBe(true)
    expect(report().add_jomcheck).toBe(true)
  })

  it('never downgrades an already-entitled report', async () => {
    seed({ add_jomcheck: true, upgrade_amount_cents: 8800 })
    expect(await markUpgradePaidByReportId(REPORT)).toBe(false)
    expect(report().add_jomcheck).toBe(true)
  })
})

describe('the reconciliation source is narrow', () => {
  it('setUpgradeBillId writes both id and URL', async () => {
    seed()
    await setUpgradeBillId(REPORT, 'bill_X', 'https://billplz/bill_X')
    expect(report().upgrade_bill_id).toBe('bill_X')
    expect(report().upgrade_bill_url).toBe('https://billplz/bill_X')
  })

  it('tolerates a missing URL rather than writing "undefined"', async () => {
    seed()
    await setUpgradeBillId(REPORT, 'bill_X')
    expect(report().upgrade_bill_url).toBeNull()
  })

  it('grants the upgrade only for the upgrade product', async () => {
    // Guard against inventing an entitlement from an unrelated bill: the
    // webhook helper requires product === claim_check_upgrade AND a report id.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', '..', 'app/api/webhooks/billplz/route.ts'), 'utf-8')
    const fn = src.split('async function reconcileOrphanedUpgrade')[1]!.split('\nexport async function POST')[0]!
    expect(fn).toContain("attribution.product !== 'claim_check_upgrade'")
    expect(fn).toContain('if (!reportId) return false')
    expect(fn).toContain('markUpgradePaidByReportId')
    // It must never touch the base report entitlement.
    expect(fn).not.toContain('markReportPaid')
  })

  it('the paid report still resolves after the upgrade lands', async () => {
    seed()
    await markUpgradePaidByReportId(REPORT)
    const r = await getBuyerReport(CHECK)
    expect(r?.id).toBe(REPORT)
    expect(r?.add_jomcheck).toBe(true)
  })
})

describe('a stored bill is only reused while it can still be paid', () => {
  /**
   * Reuse removes the multi-bill trap. Reusing BLINDLY creates the opposite
   * one: a deleted bill, or one already paid whose webhook we missed, would
   * hand the buyer a dead page every time they click — forever.
   *
   * The stored bill is therefore verified against Billplz before it is reused.
   */
  const stored = { upgrade_bill_id: 'bill_A', upgrade_bill_url: 'https://billplz/bill_A' }

  it('reuses a bill that is still due', async () => {
    seed(stored)
    getBill.mockResolvedValue({ id: 'bill_A', paid: false, state: 'due', url: 'https://billplz/bill_A' })

    const res = await initiateJomCheckUpgrade(ARGS)

    expect(res.billUrl).toBe('https://billplz/bill_A')
    expect(createBill).not.toHaveBeenCalled()
  })

  it('replaces a DELETED bill instead of trapping the buyer on it', async () => {
    seed(stored)
    getBill.mockResolvedValue({ id: 'bill_A', paid: false, state: 'deleted', url: null })

    const res = await initiateJomCheckUpgrade(ARGS)

    expect(createBill).toHaveBeenCalledTimes(1)
    expect(res.error).toBeNull()
    expect(res.billUrl).toBe('https://billplz/bill_A')  // the freshly minted one
  })

  it('replaces a bill in a state Billplz introduces later', async () => {
    // An unrecognised state must not be assumed payable. Being able to pay is
    // the hard requirement; a duplicate bill is explicitly acceptable because
    // checkout_attributions keeps the superseded one reconcilable.
    seed(stored)
    getBill.mockResolvedValue({ id: 'bill_A', paid: false, state: 'expired', url: null })

    await initiateJomCheckUpgrade(ARGS)
    expect(createBill).toHaveBeenCalledTimes(1)
  })

  it('grants the entitlement when the stored bill was ALREADY PAID', async () => {
    // The missed-webhook recovery. The buyer has paid; sending them back to a
    // bill that will not take their money again is the worst possible answer.
    seed(stored)
    getBill.mockResolvedValue({ id: 'bill_A', paid: true, state: 'paid', url: null })

    const res = await initiateJomCheckUpgrade(ARGS)

    expect(res.error).toBe('Semakan Accident/Claim sudah ditambah')
    expect(createBill).not.toHaveBeenCalled()
    expect(report().add_jomcheck).toBe(true)
    expect(report().upgrade_amount_cents).toBe(8800)
  })

  it('does not double-grant when the paid bill is seen twice', async () => {
    seed(stored)
    getBill.mockResolvedValue({ id: 'bill_A', paid: true, state: 'paid', url: null })
    await initiateJomCheckUpgrade(ARGS)
    const firstPaidAt = report().upgrade_paid_at
    await initiateJomCheckUpgrade(ARGS)
    expect(report().upgrade_paid_at).toBe(firstPaidAt)
  })

  it('keeps the existing bill when Billplz cannot be reached', async () => {
    // A transient blip must not spawn duplicates, and if Billplz is down its
    // payment page is down too. The next attempt re-checks, so nothing is
    // permanent.
    seed(stored)
    getBill.mockResolvedValue(null)

    const res = await initiateJomCheckUpgrade(ARGS)

    expect(res.billUrl).toBe('https://billplz/bill_A')
    expect(createBill).not.toHaveBeenCalled()
  })

  it('recovers on the NEXT attempt once Billplz answers again', async () => {
    seed(stored)
    getBill.mockResolvedValueOnce(null)                                             // outage
    await initiateJomCheckUpgrade(ARGS)
    expect(createBill).not.toHaveBeenCalled()

    getBill.mockResolvedValue({ id: 'bill_A', paid: false, state: 'deleted', url: null })
    await initiateJomCheckUpgrade(ARGS)
    expect(createBill).toHaveBeenCalledTimes(1)                                     // no longer trapped
  })

  it('does not call Billplz at all on the FIRST upgrade', async () => {
    // The common path must stay at zero extra latency.
    seed()
    await initiateJomCheckUpgrade(ARGS)
    expect(getBill).not.toHaveBeenCalled()
    expect(createBill).toHaveBeenCalledTimes(1)
  })

  it('a replacement records the NEW bill, and the old one stays reconcilable', async () => {
    seed(stored)
    getBill.mockResolvedValue({ id: 'bill_A', paid: false, state: 'deleted', url: null })
    createBill.mockResolvedValue({ id: 'bill_B', url: 'https://billplz/bill_B' })

    await initiateJomCheckUpgrade(ARGS)

    expect(report().upgrade_bill_id).toBe('bill_B')
    expect(report().upgrade_bill_url).toBe('https://billplz/bill_B')
    // bill_A is no longer named by any column — checkout_attributions is what
    // keeps it payable-and-reconcilable, which reconcileOrphanedUpgrade uses.
  })
})
