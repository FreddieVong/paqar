import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  odometerEvidence, mayAssertRollback, assessMileageFinding, mileageFindingCopy,
  type MileageReading,
} from '@/lib/mileage-provenance'
import { detectMileageRollback } from '@/lib/jomcheck/core'
import type { JomCheckIncident } from '@/lib/jomcheck/core'

/**
 * A rollback warning accuses a real seller of tampering. It may only be built
 * on evidence, never on a number the buyer typed into a checkout field.
 */

const incident = (mileageAtClaim: number | null): JomCheckIncident => ({
  dateOfLoss: '14 Apr 2024', type: 'accident', accidentType: 'Collision',
  mileageAtClaim, severity: null, constructiveTotalLoss: false,
})

const buyerClaim = (km: number): MileageReading => ({ km, source: 'buyer_claimed' })
/** Transcribed off the advert — still the seller's own claim. */
const listing    = (km: number): MileageReading => ({ km, source: 'listing_claimed' })
/** A dated third-party reading. The only evidential source. */
const official   = (km: number): MileageReading => ({ km, source: 'official_record', recordedAt: '2025-06-01' })

describe('odometerEvidence — what may drive a tampering claim', () => {
  it('refuses a buyer-typed reading', () => {
    expect(odometerEvidence(buyerClaim(7_000))).toBeNull()
  })

  it('accepts a dated official record', () => {
    expect(odometerEvidence(official(78_000))).toBe(78_000)
  })

  /**
   * A reviewer reading a screenshot has transcribed the SELLER's claim, not
   * verified it. Careful transcription of an interested party's number is
   * still that party's number, and the seller is exactly who benefits from
   * misstating it.
   */
  it('refuses a reading transcribed from the listing, however carefully', () => {
    expect(odometerEvidence(listing(78_000))).toBeNull()
  })

  it('refuses a missing reading', () => {
    expect(odometerEvidence(null)).toBeNull()
    expect(odometerEvidence(undefined)).toBeNull()
  })

  it('refuses a nonsensical reading whatever its source', () => {
    expect(odometerEvidence(official(0))).toBeNull()
    expect(odometerEvidence(official(-5))).toBeNull()
  })
})

describe('mayAssertRollback', () => {
  const claims = [incident(78_000)]

  /**
   * THE DEFECT THIS PINS.
   *
   * claimed_mileage_km is typed by the buyer into PaymentForm and was passed
   * straight into detectMileageRollback as `currentOdometerKm`. A buyer who
   * typed 7,000 instead of 70,000 published "meter mungkin dipusing balik"
   * about a seller who had done nothing wrong.
   */
  it('never fires from a buyer-typed reading, even when it looks like a rollback', () => {
    expect(mayAssertRollback(claims, buyerClaim(7_000))).toBe(false)
  })

  it('fires only for a dated official record below a recorded claim', () => {
    expect(mayAssertRollback(claims, official(50_000))).toBe(true)
  })

  it('never fires from a listing-sourced reading', () => {
    expect(mayAssertRollback(claims, listing(50_000))).toBe(false)
  })

  /** Regression case 10 from the brief, stated explicitly. */
  it('does not fire when current 700,000 km exceeds a recorded 78,000 km', () => {
    expect(mayAssertRollback(claims, official(700_000))).toBe(false)
    expect(detectMileageRollback(claims, 700_000).rolledBack).toBe(false)
  })

  it('does not fire when no claim carries a mileage', () => {
    expect(mayAssertRollback([incident(null)], official(50_000))).toBe(false)
  })

  it('does not fire with no reading at all', () => {
    expect(mayAssertRollback(claims, null)).toBe(false)
  })

  it('is suppressible by the reviewer even when the arithmetic holds', () => {
    expect(mayAssertRollback(claims, official(50_000), { suppressed: true })).toBe(false)
  })
})

/**
 * Source-level guard. The defect was a PROP being passed, not a function being
 * wrong — so the behavioural tests above cannot catch its reintroduction by a
 * future edit that re-wires the component.
 */
describe('the report never feeds a raw buyer claim into rollback detection', () => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'components/report/BuyerReportContent.tsx'), 'utf8',
  )

  it.each(['HistoryRiskBanner', 'JomCheckSection'])(
    '%s receives the evidence-gated reading, not claimedMileageKm',
    (component) => {
      const usage = src.slice(src.indexOf(`<${component}`))
        .slice(0, src.slice(src.indexOf(`<${component}`)).indexOf('/>') + 2)
      expect(usage).toContain('odometerForRollback')
      expect(usage).not.toContain('claimedMileageKm')
    },
  )

  it('derives that reading through odometerEvidence', () => {
    expect(src).toContain('odometerEvidence(')
  })
})

/**
 * A weak-provenance mismatch is still worth telling the buyer about — it is
 * just not tampering. The wording is the whole point of this suite.
 */
describe('assessMileageFinding — mismatch is not an accusation', () => {
  const claims = [incident(78_000)]

  it.each([
    ['buyer',   buyerClaim(50_000)],
    ['listing', listing(50_000)],
  ])('reports a plain mismatch for a %s reading', (_l, reading) => {
    const finding = assessMileageFinding(claims, reading)
    expect(finding.kind).toBe('mismatch')

    const copy = mileageFindingCopy(finding)!
    expect(copy).toContain('Bacaan tidak sepadan')
    expect(copy).toContain('sila sahkan')
    // The accusation vocabulary must be absent entirely.
    expect(copy).not.toMatch(/dipusing|tampering|diputar|rollback/i)
  })

  it('reports a rollback only for a dated official record', () => {
    const finding = assessMileageFinding(claims, official(50_000))
    expect(finding.kind).toBe('rollback')
    expect(mileageFindingCopy(finding)).toMatch(/dipusing balik/)
  })

  it('reports nothing when the reading is above every recorded claim', () => {
    expect(assessMileageFinding(claims, official(700_000)).kind).toBe('none')
    expect(assessMileageFinding(claims, listing(700_000)).kind).toBe('none')
  })

  it('reports nothing once the reviewer suppresses it', () => {
    expect(assessMileageFinding(claims, official(50_000), { suppressed: true }).kind).toBe('none')
  })
})
