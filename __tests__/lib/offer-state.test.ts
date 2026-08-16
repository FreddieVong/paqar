// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  resolveOfferState, stateForReason, isSellable, measurementFor,
  type OfferState,
} from '@/lib/offer-state'

/**
 * The paywall state machine, pinned.
 *
 * The load-bearing property is that exactly ONE state opens checkout, and that
 * everything unrecognised lands somewhere else.
 */

describe('only offer_available is sellable', () => {
  const states: OfferState[] = [
    'loading', 'needs_asking_price', 'offer_available',
    'offer_pending', 'offer_unavailable', 'error',
  ]
  it.each(states)('%s', (s) => {
    expect(isSellable(s)).toBe(s === 'offer_available')
  })
})

describe('every reason maps explicitly', () => {
  it.each([
    ['missing_asking_price',    'needs_asking_price'],
    ['insufficient_data',       'offer_pending'],
    ['mixed_variants',          'offer_unavailable'],
    ['offer_not_representable', 'offer_unavailable'],
  ] as const)('%s → %s', (reason, expected) => {
    expect(stateForReason(reason)).toBe(expected)
  })

  it('insufficient_data is the ONLY transient reason', () => {
    const transient = (['missing_asking_price', 'insufficient_data', 'mixed_variants', 'offer_not_representable'] as const)
      .filter(r => stateForReason(r) === 'offer_pending')
    expect(transient).toEqual(['insufficient_data'])
  })
})

describe('unknown reasons fail closed', () => {
  it.each([null, undefined, 'something_new_someone_added', ''])('%s is never sellable', (reason) => {
    const s = stateForReason(reason as never)
    expect(isSellable(s)).toBe(false)
    expect(s).toBe('offer_unavailable')
  })
})

describe('resolveOfferState', () => {
  it('sells only on an explicit boolean true', () => {
    expect(resolveOfferState({ state: 'evidence', offerAvailable: true })).toBe('offer_available')
  })

  it.each([
    ['a truthy string', 'yes'],
    ['the number 1', 1],
    ['undefined', undefined],
    ['false', false],
  ])('does NOT sell on %s', (_label, value) => {
    const s = resolveOfferState({ state: 'evidence', offerAvailable: value as never, offerReason: 'insufficient_data' })
    expect(isSellable(s)).toBe(false)
  })

  it.each([
    ['pending_vehicle', 'loading'],
    ['pending_market', 'loading'],
    ['needs_asking_price', 'needs_asking_price'],
  ] as const)('maps API state %s → %s', (apiState, expected) => {
    expect(resolveOfferState({ state: apiState })).toBe(expected)
  })

  it('a null or unrecognised response is an error, never sellable', () => {
    for (const res of [null, undefined, {}, { state: 'who_knows' }]) {
      const s = resolveOfferState(res as never)
      expect(s).toBe('error')
      expect(isSellable(s)).toBe(false)
    }
  })

  it('loading never resolves to a pitch-bearing state', () => {
    for (const apiState of ['pending_vehicle', 'pending_market']) {
      expect(resolveOfferState({ state: apiState })).toBe('loading')
    }
  })
})

describe('measurement payload is enum-only', () => {
  it('carries exactly two enum fields', () => {
    const m = measurementFor('offer_pending', 'insufficient_data')
    expect(Object.keys(m).sort()).toEqual(['offer_reason', 'offer_state'])
    expect(m).toEqual({ offer_state: 'offer_pending', offer_reason: 'insufficient_data' })
  })

  it('uses "none" rather than null when there is no reason', () => {
    expect(measurementFor('offer_available', null).offer_reason).toBe('none')
  })

  it('contains no plate, price, id or vehicle data by construction', () => {
    const json = JSON.stringify(measurementFor('offer_unavailable', 'mixed_variants'))
    for (const forbidden of ['plate', 'price', 'check', 'rm', 'vin', 'email', 'session']) {
      expect(json.toLowerCase()).not.toContain(`"${forbidden}`)
    }
  })
})
