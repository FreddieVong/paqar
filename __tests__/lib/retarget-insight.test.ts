import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: {} }))

const getCachedVehicleData  = vi.fn()
const getValuationByNvic    = vi.fn()
const getCachedMarketPrices = vi.fn()

vi.mock('@/lib/db/plate-lookups',      () => ({ getCachedVehicleData:  (...a: unknown[]) => getCachedVehicleData(...a) }))
vi.mock('@/lib/db/vehicle-valuations', () => ({ getValuationByNvic:    (...a: unknown[]) => getValuationByNvic(...a) }))
vi.mock('@/lib/db/market-prices',      () => ({ getCachedMarketPrices: (...a: unknown[]) => getCachedMarketPrices(...a) }))

import { loadRetargetInsight } from '@/lib/email/retarget-insight'

const VEHICLE = { make: 'Perodua', model: 'Myvi', registrationYear: '2019', nvic: 'ABC123' }

/** Listings priced 40k–50k for 2019, so the cohort spans a known range. */
const LISTINGS = [
  { price: 40_000, title: 'Perodua Myvi 1.5 AV 2019', year: '2019' },
  { price: 43_000, title: 'Perodua Myvi 1.5 H 2019',  year: '2019' },
  { price: 45_000, title: 'Perodua Myvi 1.5 AV 2019', year: '2019' },
  { price: 47_000, title: 'Perodua Myvi 1.5 AV 2019', year: '2019' },
  { price: 50_000, title: 'Perodua Myvi 1.5 AV 2019', year: '2019' },
]

beforeEach(() => {
  vi.clearAllMocks()
  getCachedVehicleData.mockResolvedValue(VEHICLE)
  getValuationByNvic.mockResolvedValue({ wmNewPrice: 50_000, familyFloorNewPrice: 45_000 })
  getCachedMarketPrices.mockResolvedValue({ listings: LISTINGS, fetchedAt: '', searchUrl: '' })
})

describe('retarget insight — verdicts match the report', () => {
  it('calls an asking price below the cohort floor a good deal', async () => {
    const i = await loadRetargetInsight('JUF222', 35_000)
    expect(i?.verdict).toBe('good_deal')
  })

  it('calls an asking price inside the range fair', async () => {
    const i = await loadRetargetInsight('JUF222', 45_000)
    expect(i?.verdict).toBe('fair_price')
  })

  // Report threshold: above max but within max * 1.08.
  it('calls a price just above the ceiling slightly high', async () => {
    const i = await loadRetargetInsight('JUF222', 52_000)
    expect(i?.verdict).toBe('slightly_high')
  })

  it('calls a price well above the ceiling overpriced', async () => {
    const i = await loadRetargetInsight('JUF222', 60_000)
    expect(i?.verdict).toBe('overpriced')
  })

  it('reports the cohort median and listing count it judged against', async () => {
    const i = await loadRetargetInsight('JUF222', 60_000)
    expect(i?.medianRm).toBe(45_000)
    expect(i?.count).toBe(5)
    expect(i?.askingRm).toBe(60_000)
  })

  it('costs nothing per lead — cached reads only, never a paid lookup', async () => {
    await loadRetargetInsight('JUF222', 45_000)
    expect(getCachedVehicleData).toHaveBeenCalledTimes(1)
    expect(getCachedMarketPrices).toHaveBeenCalledTimes(1)
  })
})

describe('retarget insight — stays silent when a claim would be unsafe', () => {
  it('says nothing without an asking price to compare', async () => {
    expect(await loadRetargetInsight('JUF222', null)).toBeNull()
    expect(await loadRetargetInsight('JUF222', 0)).toBeNull()
  })

  it('says nothing without a plate', async () => {
    expect(await loadRetargetInsight(undefined, 45_000)).toBeNull()
  })

  // The variant-safe rule: for a top variant, model-level listings are not
  // valid comparables, so any verdict built on them would be a lie.
  it('refuses to judge a special variant against model-level listings', async () => {
    getValuationByNvic.mockResolvedValue({ wmNewPrice: 90_000, familyFloorNewPrice: 45_000 })
    expect(await loadRetargetInsight('JUF222', 60_000)).toBeNull()
  })

  it('treats a missing valuation as not-special, exactly as the report does', async () => {
    getValuationByNvic.mockResolvedValue(null)
    const i = await loadRetargetInsight('JUF222', 60_000)
    expect(i?.verdict).toBe('overpriced')
  })

  it('says nothing on too thin a cohort to assert a market price', async () => {
    getCachedMarketPrices.mockResolvedValue({
      listings: LISTINGS.slice(0, 2), fetchedAt: '', searchUrl: '',
    })
    expect(await loadRetargetInsight('JUF222', 60_000)).toBeNull()
  })

  it('says nothing when the car was never resolved', async () => {
    getCachedVehicleData.mockResolvedValue(null)
    expect(await loadRetargetInsight('JUF222', 60_000)).toBeNull()
  })

  it('says nothing when there are no cached listings', async () => {
    getCachedMarketPrices.mockResolvedValue(null)
    expect(await loadRetargetInsight('JUF222', 60_000)).toBeNull()
  })

  // A cold cache must never cost the lead their e-mail entirely.
  it('degrades to null rather than throwing when a read fails', async () => {
    getCachedMarketPrices.mockRejectedValue(new Error('db down'))
    expect(await loadRetargetInsight('JUF222', 60_000)).toBeNull()
  })
})

describe('the e-mail reads the same cache key as the report', () => {
  it('keys on buildMarketModelKeyword, not the raw JPJ model', async () => {
    // JPJ returns model "7" for a BMW 7 Series with the real designation in the
    // description. Every other surface — the report page, the free price
    // evidence endpoint, the payment webhook, the checkout pre-warm — reads
    // market_price_cache under "730". This module read "7", matched a row
    // nothing writes, and silently fell back to the generic opener.
    getCachedVehicleData.mockResolvedValue({
      make: 'BMW', model: '7', registrationYear: '2020',
      description: 'BMW 7 30Li (CBU)', nvic: 'NV1',
    })

    await loadRetargetInsight('WXY1234', 300_000)

    expect(getCachedMarketPrices).toHaveBeenCalledWith('BMW', '730', '2020')
  })

  it('passes an ordinary model through unchanged', async () => {
    getCachedVehicleData.mockResolvedValue({
      make: 'Perodua', model: 'MYVI', registrationYear: '2020',
      description: 'PERODUA MYVI 1.5 AV', nvic: 'NV2',
    })

    await loadRetargetInsight('WXY1234', 45_000)

    expect(getCachedMarketPrices).toHaveBeenCalledWith('Perodua', 'MYVI', '2020')
  })
})
