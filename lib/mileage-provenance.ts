import { detectMileageRollback, type JomCheckIncident } from '@/lib/jomcheck/core'

/**
 * Where a mileage number came from, and what it is therefore allowed to prove.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE ────────────────────────────────────────
 *
 * `buyer_reports.claimed_mileage_km` is typed by the BUYER into an optional
 * field on the checkout form. It was passed directly into
 * detectMileageRollback as `currentOdometerKm`, through HistoryRiskBanner and
 * JomCheckSection. So a buyer who typed 7,000 instead of 70,000 caused the
 * report to state:
 *
 *   "Satu claim direkodkan pada 78,000 km — lebih tinggi daripada odometer
 *    semasa. Petanda meter mungkin dipusing balik."
 *
 * That is an accusation of odometer tampering against a real, named seller,
 * generated from an unverified number a stranger typed into a form.
 *
 * ── WHY A REVIEWER IS NOT ENOUGH ───────────────────────────────────────────
 *
 * An earlier version of this module let a `reviewer_confirmed` reading support
 * the finding. That was wrong, and the distinction matters more than it looks.
 *
 * A reviewer reading a mileage off a listing screenshot has not VERIFIED
 * anything — they have carefully transcribed the seller's own claim. The
 * seller is exactly the party with an incentive to misstate it. Human
 * attention improves transcription accuracy; it cannot turn a claim into a
 * record. Treating it as evidence would have rebuilt the same false accusation
 * with an extra step and more apparent authority.
 *
 * Only an OFFICIAL DATED RECORD — a mileage captured by a third party at a
 * known moment, such as a mileage-at-claim on an insurance record — can
 * support a tampering finding. Everything else can only ever say the numbers
 * do not line up and ask the buyer to check.
 *
 * ── WHAT THE ARITHMETIC DOES AND DOES NOT SAY ──────────────────────────────
 *
 * detectMileageRollback was never wrong: it fires only when current < recorded,
 * so 700,000 km against a recorded 78,000 km correctly produces nothing. What
 * was wrong was the PROVENANCE of the number fed to it. This module guards the
 * input rather than changing the maths.
 *
 * Site copy already promises "Paqar tidak mengesahkan bacaan odometer sebenar".
 * Publishing a rollback claim from buyer input contradicted that promise in the
 * one place it mattered.
 */

export type MileageSource =
  /** Typed by the buyer at checkout. Context only. */
  | 'buyer_claimed'
  /**
   * Read off the advert or a listing screenshot — by a human or otherwise.
   * Still the SELLER's claim: careful transcription of an interested party's
   * number. Context only, never evidence.
   */
  | 'listing_claimed'
  /**
   * A dated reading captured by a third party — e.g. mileage recorded against
   * an insurance claim. The only source that may support a tampering finding.
   */
  | 'official_record'

export interface MileageReading {
  km:     number
  source: MileageSource
  /** ISO date the reading was captured. Required for provenance on display. */
  recordedAt?: string | null
}

/** True only for a source that can carry evidential weight. */
export function isOfficialRecord(source: MileageSource): boolean {
  return source === 'official_record'
}

/**
 * The reading, if it is strong enough to support a tampering finding.
 *
 * Returns null for anything a seller or buyer asserted — that is the whole
 * point — and for a non-positive value, which is a data error rather than a
 * low odometer whatever its source.
 */
export function odometerEvidence(
  reading: MileageReading | null | undefined,
): number | null {
  if (!reading || !isOfficialRecord(reading.source)) return null
  return Number.isFinite(reading.km) && reading.km > 0 ? reading.km : null
}

/**
 * May the report state that this car's meter appears to have been wound back?
 *
 * `suppressed` is the reviewer's override. Recorded claim mileages are entered
 * by hand from a provider PDF and are themselves sometimes wrong; a reviewer
 * who can see the evidence must be able to withhold the finding without
 * editing the immutable provider record it derives from.
 */
export function mayAssertRollback(
  incidents: JomCheckIncident[],
  reading: MileageReading | null | undefined,
  opts: { suppressed?: boolean } = {},
): boolean {
  if (opts.suppressed) return false
  const evidence = odometerEvidence(reading)
  if (evidence === null) return false
  return detectMileageRollback(incidents, evidence).rolledBack
}

/**
 * What to say when the numbers do not line up but nothing can be proven.
 *
 * This is the honest output for a buyer- or listing-sourced reading that sits
 * below a recorded claim mileage. It reports a discrepancy and asks the buyer
 * to check. It does NOT allege tampering, because the low number is the
 * seller's own claim and the mismatch is at least as likely to be a typo, a
 * misread photo, or a mileage recorded against the wrong vehicle.
 */
export type MileageFinding =
  | { kind: 'none' }
  /** Numbers disagree; provenance too weak to attribute a cause. */
  | { kind: 'mismatch'; claimMileage: number; readingKm: number }
  /** Dated third-party record above a dated third-party current reading. */
  | { kind: 'rollback'; claimMileage: number; readingKm: number }

export function assessMileageFinding(
  incidents: JomCheckIncident[],
  reading: MileageReading | null | undefined,
  opts: { suppressed?: boolean } = {},
): MileageFinding {
  if (opts.suppressed || !reading) return { kind: 'none' }
  if (!Number.isFinite(reading.km) || reading.km <= 0) return { kind: 'none' }

  const { claimMileage } = detectMileageRollback(incidents, reading.km)
  if (claimMileage == null || reading.km >= claimMileage) return { kind: 'none' }

  return isOfficialRecord(reading.source)
    ? { kind: 'rollback', claimMileage, readingKm: reading.km }
    : { kind: 'mismatch',  claimMileage, readingKm: reading.km }
}

/** Copy for a finding. Mismatch NEVER implies tampering. */
export function mileageFindingCopy(finding: MileageFinding): string | null {
  if (finding.kind === 'none') return null
  const claim = finding.claimMileage.toLocaleString()
  const now   = finding.readingKm.toLocaleString()
  return finding.kind === 'rollback'
    ? `Satu claim direkodkan pada ${claim} km — lebih tinggi daripada bacaan rasmi bertarikh (${now} km). Petanda meter mungkin dipusing balik.`
    : `Bacaan tidak sepadan — sila sahkan. Iklan menyebut ${now} km, tetapi satu claim direkodkan pada ${claim} km. Paqar tidak dapat sahkan yang mana betul; minta rekod servis dan tengok meter sendiri.`
}

/**
 * The label a mileage figure must carry wherever it is shown.
 *
 * A bare "85,000 km" is what let an entered number read as a recorded one.
 * Every surface displaying mileage states its source next to it.
 */
export const MILEAGE_PROVENANCE_LABEL: Record<MileageSource, string> = {
  buyer_claimed:   'Mileage yang anda masukkan — belum disahkan.',
  listing_claimed: 'Mileage seperti yang penjual iklankan — belum disahkan.',
  official_record: 'Bacaan bertarikh daripada rekod pihak ketiga.',
}
