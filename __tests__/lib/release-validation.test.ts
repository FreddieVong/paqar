import { describe, it, expect } from 'vitest'
import { validateForRelease, mayRelease, mustRefund, type ReleaseCandidate } from '@/lib/release-validation'
import type { JomCheckIncident } from '@/lib/jomcheck/core'

const incident = (mileageAtClaim: number | null): JomCheckIncident => ({
  dateOfLoss: '14 Apr 2024', type: 'accident', accidentType: 'Collision',
  mileageAtClaim, severity: null, constructiveTotalLoss: false,
})

/** A candidate that passes everything, so each test can break exactly one thing. */
const clean = (over: Partial<ReleaseCandidate> = {}): ReleaseCandidate => ({
  sellerAskingPriceRm: 35_000,
  finalAskingPriceRm:  35_000,
  mileageReading:      null,
  incidents:           [],
  mileageWarningSuppressed: false,
  listingIdentity:     { brand: 'Honda', model: 'City', year: '2019' },
  providerIdentity:    null,
  identityConflictResolved: false,
  plateSupplied:       false,
  claimsRegistrationCheck: false,
  reviewerNote:        'Saya dah tengok iklan ini. Rim tak sepadan dengan V spec.',
  hasMarketEvidence:   true,
  statesVerdict:       true,
  ...over,
})

const codes = (c: ReleaseCandidate) => validateForRelease(c).map(b => b.code)

describe('the clean case releases', () => {
  it('passes with no blocks', () => {
    expect(validateForRelease(clean())).toEqual([])
    expect(mayRelease(clean())).toBe(true)
    expect(mustRefund(clean())).toBe(false)
  })
})

/** Brief regression case 11. */
describe('seller asking price integrity', () => {
  it('blocks RM35,000 silently becoming RM55,000', () => {
    expect(codes(clean({ finalAskingPriceRm: 55_000 }))).toContain('seller_price_changed')
  })

  it('allows the change when a reviewer recorded a reason', () => {
    expect(codes(clean({
      finalAskingPriceRm: 55_000,
      priceCorrectionReason: 'Iklan dikemas kini oleh penjual; screenshot menunjukkan RM55,000.',
    }))).not.toContain('seller_price_changed')
  })

  it('does not fire when the price is unchanged', () => {
    expect(codes(clean())).not.toContain('seller_price_changed')
  })
})

/** Brief regression case 10, plus the provenance rule. */
describe('mileage provenance and rollback', () => {
  it('does not block when 700,000 km exceeds a recorded 78,000 km', () => {
    expect(codes(clean({
      incidents: [incident(78_000)],
      mileageReading: { km: 700_000, source: 'listing_claimed' },
    }))).toEqual([])
  })

  it('flags a mismatch from a seller-claimed reading for wording review', () => {
    expect(codes(clean({
      incidents: [incident(78_000)],
      mileageReading: { km: 50_000, source: 'listing_claimed' },
    }))).toContain('mileage_provenance')
  })

  it('clears once the reviewer suppresses it deliberately', () => {
    expect(codes(clean({
      incidents: [incident(78_000)],
      mileageReading: { km: 50_000, source: 'buyer_claimed' },
      mileageWarningSuppressed: true,
    }))).not.toContain('mileage_provenance')
  })

  it('does not flag an official record below a claim — that is a real finding', () => {
    expect(codes(clean({
      incidents: [incident(78_000)],
      mileageReading: { km: 50_000, source: 'official_record', recordedAt: '2025-06-01' },
    }))).not.toContain('mileage_provenance')
  })
})

describe('vehicle identity', () => {
  it('fatally blocks a provider/listing conflict', () => {
    const c = clean({
      providerIdentity: { brand: 'Honda', model: 'Civic', year: '2019' },
    })
    expect(codes(c)).toContain('identity_conflict')
    expect(mustRefund(c)).toBe(true)
  })

  it('clears once the reviewer resolves it', () => {
    expect(codes(clean({
      providerIdentity: { brand: 'Honda', model: 'Civic', year: '2019' },
      identityConflictResolved: true,
    }))).not.toContain('identity_conflict')
  })

  it('does not fire when the provider returned nothing', () => {
    expect(codes(clean({ providerIdentity: null }))).not.toContain('identity_conflict')
  })
})

describe('registration claims require a plate', () => {
  it('blocks a verification claim with no plate', () => {
    expect(codes(clean({ plateSupplied: false, claimsRegistrationCheck: true })))
      .toContain('registration_claim_without_plate')
  })

  it('allows it when a plate was supplied', () => {
    expect(codes(clean({ plateSupplied: true, claimsRegistrationCheck: true })))
      .not.toContain('registration_claim_without_plate')
  })
})

describe('the human note and the verdict', () => {
  it.each(['', '   '])('blocks an empty note (%p)', (reviewerNote) => {
    expect(codes(clean({ reviewerNote }))).toContain('empty_reviewer_note')
  })

  it('blocks a verdict with no market evidence', () => {
    expect(codes(clean({ statesVerdict: true, hasMarketEvidence: false })))
      .toContain('unsupported_verdict')
  })

  it('allows no verdict when there is no evidence', () => {
    expect(codes(clean({ statesVerdict: false, hasMarketEvidence: false })))
      .not.toContain('unsupported_verdict')
  })
})

describe('mayRelease / mustRefund', () => {
  it('refuses release while any block stands', () => {
    expect(mayRelease(clean({ reviewerNote: '' }))).toBe(false)
  })

  it('separates correctable blocks from fatal ones', () => {
    expect(mustRefund(clean({ reviewerNote: '' }))).toBe(false)
    expect(mustRefund(clean({ providerIdentity: { model: 'Civic' } }))).toBe(true)
  })
})
