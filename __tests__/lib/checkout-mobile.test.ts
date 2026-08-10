// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The optional WhatsApp field at checkout must never be able to cost a sale.
 *
 * Two real failure modes, both proven here:
 *
 *  1. normaliseMyMobile used to accept any 10–11 digit string starting with a
 *     zero, so a LANDLINE ('03-1234 5678') became 60312345678 and was sent to
 *     Billplz. Billplz validates `mobile` and answers 422; createBill throws on
 *     a non-2xx; initiateBuyerReport catches it and shows "Ralat membuat
 *     pembayaran". Retyping the same number failed identically — the buyer had
 *     no way through.
 *
 *  2. Even a well-formed 01X number can be refused for a reason the normaliser
 *     cannot know. The bill is now retried once without the mobile, so the
 *     worst case is losing the phone number rather than the payment.
 *
 * The check row, attribution, Meta CAPI and pre-warm paths are all stubbed —
 * this test is about the bill, not about them.
 */

const createBill        = vi.fn()
const createBuyerReport = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))

vi.mock('@/lib/billplz', () => ({ createBill }))
vi.mock('@/lib/db/buyer-reports', () => ({
  createBuyerReport,
  getBuyerReport:   vi.fn(async () => null),
  // No paid report for this check — the double-charge guard must let a first
  // payment through. Its own behaviour is covered in double-payment.test.ts.
  checkHasPaidReport: vi.fn(async () => false),
  setUpgradeBillId: vi.fn(async () => {}),
  setVehicleApiData: vi.fn(async () => {}),
}))
vi.mock('@/lib/db/checks', () => ({
  getCheck: vi.fn(async () => ({
    check: { id: 'ch_1', status: 'complete', claim_token: 'tok', plate_encrypted: 'enc' },
  })),
}))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'WXY1234' }))
vi.mock('@/lib/env', () => ({
  env: { BILLPLZ_COLLECTION_ID: 'col', BILLPLZ_COLLECTION_ID_BUYER: 'colbuyer' },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  createServiceClient: () => ({ from: () => ({}) }),
}))
vi.mock('@/lib/attribution-request', () => ({
  currentAttribution: async () => ({ sessionId: null, attribution: {} }),
}))
vi.mock('@/lib/db/ad-attribution', () => ({
  recordCheckoutAttribution: vi.fn(async () => {}),
  recordAdEvent:             vi.fn(async () => ({ status: 'inserted' })),
  markCapiSent:              vi.fn(async () => {}),
}))
vi.mock('@/lib/meta-capi', () => ({ sendMetaEvent: vi.fn(async () => false) }))
vi.mock('@/lib/db/plate-lookups',      () => ({ getOrFetchVehicleData: vi.fn(async () => null) }))
vi.mock('@/lib/db/vehicle-valuations', () => ({ getValuationByNvic:    vi.fn(async () => null) }))
vi.mock('@/lib/db/market-prices',      () => ({ fetchAndCacheMarketPrices: vi.fn(async () => {}) }))

const { initiateBuyerReport } = await import('@/app/laporan-pembeli/[checkId]/_actions')

const BASE = {
  checkId:    'ch_1',
  claimToken: 'tok',
  buyerEmail: 'buyer@example.com',
  baseUrl:    'https://paqar.my',
}

beforeEach(() => {
  vi.clearAllMocks()
  createBill.mockResolvedValue({ id: 'bill_1', url: 'https://billplz/bill_1' })
  createBuyerReport.mockResolvedValue({ id: 'br_1' })
})

describe('a real mobile is attached', () => {
  it('sends the normalised number to Billplz and stores it on the report', async () => {
    const res = await initiateBuyerReport({ ...BASE, buyerPhone: '012-345 6789' })

    expect(res.error).toBeNull()
    expect(createBill).toHaveBeenCalledTimes(1)
    expect(createBill.mock.calls[0]![0]).toMatchObject({ mobile: '60123456789' })
    // Migration 026's whole purpose: the number must reach Paqar's own row,
    // not only Billplz. It used to be accepted as a parameter and dropped.
    expect(createBuyerReport.mock.calls[0]![0]).toMatchObject({ buyerPhone: '60123456789' })
  })
})

describe('a landline never reaches Billplz', () => {
  it.each([
    ['03-1234 5678',  'KL landline'],
    ['04-123 4567',   'Penang landline'],
    ['082-123456',    'Sarawak landline'],
  ])('%s (%s) is dropped, and the bill is still created', async (input) => {
    const res = await initiateBuyerReport({ ...BASE, buyerPhone: input })

    expect(res.error).toBeNull()
    expect(res.billUrl).toBe('https://billplz/bill_1')
    expect(createBill).toHaveBeenCalledTimes(1)
    expect(createBill.mock.calls[0]![0].mobile).toBeNull()
  })
})

describe('Billplz rejecting the mobile cannot cost the sale', () => {
  it('retries once without the mobile and completes the checkout', async () => {
    createBill
      .mockRejectedValueOnce(new Error('Billplz API error: {"error":{"message":["Mobile is invalid"]}}'))
      .mockResolvedValueOnce({ id: 'bill_2', url: 'https://billplz/bill_2' })

    const res = await initiateBuyerReport({ ...BASE, buyerPhone: '0123456789' })

    expect(res.error).toBeNull()
    expect(res.billUrl).toBe('https://billplz/bill_2')
    expect(createBill).toHaveBeenCalledTimes(2)
    expect(createBill.mock.calls[0]![0].mobile).toBe('60123456789')
    expect(createBill.mock.calls[1]![0].mobile).toBeNull()
  })

  it('keeps every other bill field identical on the retry', async () => {
    createBill
      .mockRejectedValueOnce(new Error('422'))
      .mockResolvedValueOnce({ id: 'bill_2', url: 'https://billplz/bill_2' })

    await initiateBuyerReport({ ...BASE, buyerPhone: '0123456789' })

    const { mobile: _first,  ...firstRest }  = createBill.mock.calls[0]![0]
    const { mobile: _second, ...secondRest } = createBill.mock.calls[1]![0]
    expect(secondRest).toEqual(firstRest)
    // Amount above all: a retry must never re-price the sale.
    expect(secondRest.amountCents).toBe(1200)
  })

  it('does not retry when no mobile was attached', async () => {
    // A failure with no mobile is a genuine Billplz problem (credentials,
    // collection, outage). Trying twice would only report it later.
    createBill.mockRejectedValue(new Error('Billplz credentials not configured'))

    const res = await initiateBuyerReport({ ...BASE })

    expect(res.error).toBe('Ralat membuat pembayaran — sila cuba semula')
    expect(createBill).toHaveBeenCalledTimes(1)
  })

  it('surfaces the error when the retry also fails', async () => {
    createBill.mockRejectedValue(new Error('Billplz down'))

    const res = await initiateBuyerReport({ ...BASE, buyerPhone: '0123456789' })

    expect(res.error).toBe('Ralat membuat pembayaran — sila cuba semula')
    expect(res.billUrl).toBeUndefined()
    expect(createBill).toHaveBeenCalledTimes(2)
    expect(createBuyerReport).not.toHaveBeenCalled()
  })
})
