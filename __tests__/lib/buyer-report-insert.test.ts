// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeSupabase } from '../helpers/fake-supabase'

/**
 * What createBuyerReport actually writes.
 *
 * The defect this locks down: `buyerPhone` was declared in the parameter type,
 * passed in by initiateBuyerReport, and then simply absent from the `.insert()`
 * object. Migration 026 added buyer_reports.buyer_phone specifically so an
 * abandoned checkout could be followed up on WhatsApp — and every row was NULL,
 * because the column was never written. Nothing failed, nothing logged; the
 * feature was a no-op that looked implemented from every angle except the row.
 *
 * A parameter that is accepted but discarded is invisible to type checking, so
 * this asserts the persisted payload rather than the call.
 */

const fake = new FakeSupabase()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fake }))

const { createBuyerReport } = await import('@/lib/db/buyer-reports')

const BASE = {
  checkId:       'ch_1',
  buyerEmail:    'buyer@example.com',
  billplzBillId: 'bill_1',
  amountCents:   1200,
}

beforeEach(() => { fake.tables.clear() })

describe('createBuyerReport persists the checkout phone', () => {
  it('writes buyer_phone when one was captured', async () => {
    await createBuyerReport({ ...BASE, buyerPhone: '60123456789' })

    const [row] = fake.rows('buyer_reports')
    expect(row).toBeDefined()
    expect(row!.buyer_phone).toBe('60123456789')
  })

  it('writes NULL rather than undefined when none was given', async () => {
    // An absent key and an explicit null are different to PostgREST; the column
    // is nullable by design, so it must be written as null.
    await createBuyerReport({ ...BASE })

    const [row] = fake.rows('buyer_reports')
    expect(row).toHaveProperty('buyer_phone')
    expect(row!.buyer_phone).toBeNull()
  })

  it('still writes every other field it is given', async () => {
    await createBuyerReport({
      ...BASE,
      buyerPhone:       '60123456789',
      addJomCheck:      true,
      askingPriceRm:    45_000,
      claimedMileageKm: 82_000,
      listingUrl:       'https://mudah.my/x',
    })

    expect(fake.rows('buyer_reports')[0]).toMatchObject({
      check_id:           'ch_1',
      buyer_email:        'buyer@example.com',
      billplz_bill_id:    'bill_1',
      amount_cents:       1200,
      buyer_phone:        '60123456789',
      add_jomcheck:       true,
      jomcheck_status:    'not_requested',
      asking_price_rm:    45_000,
      claimed_mileage_km: 82_000,
      listing_url:        'https://mudah.my/x',
    })
  })

  it('never invents an amount', async () => {
    // Guard the guard: amount_cents is the one field where a default would be
    // a financial defect rather than a missing convenience.
    await createBuyerReport({ ...BASE, amountCents: 10_000 })
    expect(fake.rows('buyer_reports')[0]!.amount_cents).toBe(10_000)
  })
})
