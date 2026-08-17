// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildOfferSnapshot, parseOfferSnapshot, evidencePeriodLabel,
  OFFER_SNAPSHOT_SCHEMA_VERSION,
} from '@/lib/offer-snapshot'
import { buildComparableCohort } from '@/lib/comparables'
import { evaluateOfferAvailability } from '@/lib/offer'

/**
 * The snapshot is what stops a paid report mixing two evidence periods.
 *
 * The load-bearing property: ONE frozen set drives the offer band, the median
 * and range, the negotiation script and the price chips. If the snapshot ever
 * stored aggregates without the listings that produced them, the chips would
 * keep coming from the live cache and the report would contradict itself.
 */

const listings = [
  { price: 40_000, title: 'Perodua Myvi 1.5 AV 2020', url: 'https://www.mudah.my/x-1', year: '2020' },
  { price: 43_000, title: 'Perodua Myvi 1.5 AV 2020', url: 'https://www.mudah.my/x-2', year: '2020' },
  { price: 45_000, title: 'Perodua Myvi 1.5 AV 2020', url: 'https://www.mudah.my/x-3', year: '2020' },
  { price: 47_000, title: 'Perodua Myvi 1.5 AV 2020', url: 'https://www.mudah.my/x-4', year: '2020' },
  { price: 49_000, title: 'Perodua Myvi 1.5 AV 2020', url: 'https://www.mudah.my/x-5', year: '2020' },
]
const FETCHED = '2026-08-16T04:00:00.000Z'

const cohort = buildComparableCohort(listings, {
  year: '2020', officialVariant: 'PERODUA MYVI 1.5 AV', model: 'Myvi', isSpecialVariant: false,
})
const offer = evaluateOfferAvailability(cohort, 55_000)
const snap = () => buildOfferSnapshot({ cohort, offer, sourceFetchedAt: FETCHED })!

describe('a snapshot carries its provenance', () => {
  it('records schemaVersion, capturedAt and the source evidence period', () => {
    const s = snap()
    expect(s.schemaVersion).toBe(OFFER_SNAPSHOT_SCHEMA_VERSION)
    expect(Date.parse(s.capturedAt)).not.toBeNaN()
    expect(s.sourceFetchedAt).toBe(FETCHED)
  })

  it('capturedAt and sourceFetchedAt are different facts', () => {
    // When the evidence was gathered vs when Paqar promised on it.
    const s = snap()
    expect(s.capturedAt).not.toBe(s.sourceFetchedAt)
  })
})

describe('one frozen set drives every connected claim', () => {
  it('stores the exact supporting listings, not only the aggregates', () => {
    expect(snap().listings).toHaveLength(listings.length)
  })

  it('recomputing the cohort from the snapshot reproduces the promised figures', () => {
    const s = snap()
    const recomputed = buildComparableCohort(s.listings, {
      year: '2020', officialVariant: 'PERODUA MYVI 1.5 AV', model: 'Myvi', isSpecialVariant: false,
    })
    expect(recomputed.median).toBe(s.aggregates.median)
    expect(recomputed.min).toBe(s.aggregates.min)
    expect(recomputed.max).toBe(s.aggregates.max)
    expect(recomputed.count).toBe(s.aggregates.count)
  })

  it('and reproduces the SAME offer band the buyer was promised', () => {
    const s = snap()
    const recomputed = buildComparableCohort(s.listings, {
      year: '2020', officialVariant: 'PERODUA MYVI 1.5 AV', model: 'Myvi', isSpecialVariant: false,
    })
    const again = evaluateOfferAvailability(recomputed, 55_000)
    expect(again.available).toBe(true)
    if (again.available) {
      expect(again.low).toBe(s.offer.low)
      expect(again.high).toBe(s.offer.high)
    }
  })
})

describe('nothing is frozen for an unsellable state', () => {
  it('returns null when no offer was available', () => {
    const thin = buildComparableCohort([listings[0]!], {
      year: '2020', officialVariant: 'PERODUA MYVI 1.5 AV', model: 'Myvi', isSpecialVariant: false,
    })
    const noOffer = evaluateOfferAvailability(thin, 55_000)
    expect(buildOfferSnapshot({ cohort: thin, offer: noOffer, sourceFetchedAt: FETCHED })).toBeNull()
  })
})

describe('parsing is strict, and degrades to live rather than misrendering', () => {
  it('round-trips a valid snapshot', () => {
    const s = snap()
    expect(parseOfferSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['an empty object', {}],
    ['a future schema version', { ...({} as object), schemaVersion: 99 }],
  ])('rejects %s', (_label, raw) => {
    expect(parseOfferSnapshot(raw)).toBeNull()
  })

  it('rejects a snapshot with no listings — aggregates alone are not enough', () => {
    const s = { ...snap(), listings: [] }
    expect(parseOfferSnapshot(s)).toBeNull()
  })

  it('rejects unknown fields rather than ignoring them', () => {
    const s = { ...snap(), somethingNew: true }
    expect(parseOfferSnapshot(s)).toBeNull()
  })

  it('rejects a missing evidence period', () => {
    const { sourceFetchedAt: _drop, ...rest } = snap()
    expect(parseOfferSnapshot(rest)).toBeNull()
  })
})

describe('the evidence period is stated, not implied', () => {
  it('labels the figures with the date they came from', () => {
    const label = evidencePeriodLabel(snap())
    expect(label).toMatch(/Ogos 2026/)
    expect(label).toMatch(/mungkin sudah berubah/)
  })
})
