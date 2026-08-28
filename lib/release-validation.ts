import { assessMileageFinding, type MileageReading } from '@/lib/mileage-provenance'
import type { JomCheckIncident } from '@/lib/jomcheck/core'

/**
 * The checks a report must pass before a human is allowed to release it.
 *
 * ── WHY THIS IS CODE AND NOT A CHECKLIST ───────────────────────────────────
 *
 * Every failure below is one a real tester actually hit: a wrong detected
 * model, a seller's asking price changing between what was entered and what was
 * printed, an entered mileage rendered as a recorded one, and a tampering
 * warning with nothing behind it. A reviewer working at speed through a queue
 * will not re-derive these each time, and the cost of missing one is a buyer
 * paying RM29 for a document that defames a seller or misstates their own car.
 *
 * So they block the release button rather than appearing next to it.
 *
 * ── WHY THE REMEDY IS SOMETIMES A REFUND ───────────────────────────────────
 *
 * Some failures cannot be corrected by editing a field — an identity conflict
 * between the provider record and the listing means Paqar does not know which
 * car this is. For those the only valid outcome is `unable_to_complete` and a
 * refund. A validator that could always be satisfied by typing something would
 * be a formality.
 */

/** One audited correction-and-recheck. See the identity_conflict branch. */
export const MAX_IDENTITY_RECHECKS = 1

export type ReleaseBlockCode =
  | 'seller_price_changed'
  | 'mileage_provenance'
  | 'unsupported_rollback'
  | 'identity_conflict'
  | 'registration_claim_without_plate'
  | 'empty_reviewer_note'
  | 'unsupported_verdict'

export interface ReleaseBlock {
  code:    ReleaseBlockCode
  message: string
  /** true when no amount of editing fixes it — refund is the only honest exit. */
  fatal:   boolean
}

export interface ReleaseCandidate {
  /** What the buyer entered or the listing stated, before any correction. */
  sellerAskingPriceRm:      number | null
  /** What the report is about to print. */
  finalAskingPriceRm:       number | null
  /** Set only when a reviewer deliberately changed the price, with a reason. */
  priceCorrectionReason?:   string | null

  mileageReading:           MileageReading | null
  incidents:                JomCheckIncident[]
  mileageWarningSuppressed: boolean

  /** Identity as stated by the listing vs as returned by the provider. */
  listingIdentity:          { brand?: string | null; model?: string | null; year?: string | null }
  providerIdentity:         { brand?: string | null; model?: string | null; year?: string | null } | null
  identityConflictResolved: boolean

  /**
   * How many audited provider rechecks have already been spent on this order.
   * One is allowed; beyond that the conflict is treated as unresolvable,
   * because each recheck costs RM0.81 and repeated lookups of a plate that
   * keeps disagreeing are not converging on anything.
   */
  identityRecheckCount:     number
  plateSupplied:            boolean
  /** Does the rendered report assert registration/variant verification? */
  claimsRegistrationCheck:  boolean

  reviewerNote:             string
  /** Whether the market cohort was eligible — a verdict needs evidence. */
  hasMarketEvidence:        boolean
  statesVerdict:            boolean
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

export function validateForRelease(c: ReleaseCandidate): ReleaseBlock[] {
  const blocks: ReleaseBlock[] = []

  // 1. The seller's asking price must survive the pipeline untouched.
  //    A tester watched RM35,000 become RM55,000. A price may only change when
  //    a reviewer changed it ON PURPOSE and said why.
  if (
    c.sellerAskingPriceRm != null &&
    c.finalAskingPriceRm  != null &&
    c.sellerAskingPriceRm !== c.finalAskingPriceRm &&
    !norm(c.priceCorrectionReason)
  ) {
    blocks.push({
      code: 'seller_price_changed',
      fatal: false,
      message: `Harga seller berubah daripada RM${c.sellerAskingPriceRm.toLocaleString()} kepada RM${c.finalAskingPriceRm.toLocaleString()} tanpa sebab direkodkan.`,
    })
  }

  // 2 & 3. Mileage provenance, and the tampering claim that hangs off it.
  //    A reading the buyer typed or the seller advertised can never support a
  //    rollback finding; at most it supports "bacaan tidak sepadan".
  const finding = assessMileageFinding(c.incidents, c.mileageReading, {
    suppressed: c.mileageWarningSuppressed,
  })
  if (finding.kind === 'mismatch' && !c.mileageWarningSuppressed) {
    // Not fatal, and not silent: the reviewer must either let the neutral
    // mismatch wording stand or suppress it deliberately.
    blocks.push({
      code: 'mileage_provenance',
      fatal: false,
      message: 'Bacaan mileage tidak sepadan dengan rekod claim, dan sumbernya hanya dakwaan seller. Sahkan wordingnya "sila sahkan" — bukan tuduhan meter dipusing.',
    })
  }
  if (
    c.mileageReading != null &&
    c.mileageReading.source !== 'official_record' &&
    finding.kind === 'rollback'
  ) {
    // Structurally unreachable via assessMileageFinding; asserted anyway
    // because this is the exact defect that shipped once already.
    blocks.push({
      code: 'unsupported_rollback',
      fatal: true,
      message: 'Amaran meter dipusing balik tanpa rekod rasmi bertarikh.',
    })
  }

  // 4. Vehicle identity. If the provider and the listing disagree about which
  //    car this is, nothing downstream means anything.
  if (c.providerIdentity && !c.identityConflictResolved) {
    const conflict = (['brand', 'model', 'year'] as const).some(k => {
      const a = norm(c.listingIdentity[k]), b = norm(c.providerIdentity![k])
      return a !== '' && b !== '' && a !== b
    })
    if (conflict) {
      // BLOCKING, NOT FATAL — and the distinction is the point.
      //
      // A mismatch has four ordinary causes, three of which are correctable:
      // the buyer mistyped the plate, extraction misread it, the seller
      // listed the car wrongly, or the provider genuinely holds a different
      // vehicle. Treating every one as unrefundable-and-done would refund
      // buyers whose only problem was a typo, and would throw away a sale
      // Paqar could have delivered honestly.
      //
      // So it blocks release and offers ONE audited recheck. It becomes fatal
      // only after that recheck has been spent and the conflict survives —
      // see identityRecheckExhausted below. What must never happen is Paqar
      // silently picking one identity and reporting on a car it is not sure
      // about.
      const exhausted = c.identityRecheckCount >= MAX_IDENTITY_RECHECKS
      blocks.push({
        code: 'identity_conflict',
        fatal: exhausted,
        message: exhausted
          ? 'Rekod pendaftaran dan iklan masih tidak sepadan selepas semakan semula. Tandakan tidak dapat disiapkan dan refund — jangan pilih satu identiti sendiri.'
          : 'Rekod pendaftaran dan iklan tidak sepadan. Betulkan nombor plat dan semak semula sekali, atau tandakan tidak dapat disiapkan.',
      })
    }
  }

  // 5. No plate means no registration lookup ran, so nothing may claim one did.
  if (!c.plateSupplied && c.claimsRegistrationCheck) {
    blocks.push({
      code: 'registration_claim_without_plate',
      fatal: false,
      message: 'Laporan mendakwa maklumat pendaftaran disemak, tetapi tiada nombor plat diberikan.',
    })
  }

  // 6. The human note is the product.
  if (!norm(c.reviewerNote)) {
    blocks.push({
      code: 'empty_reviewer_note',
      fatal: false,
      message: 'Nota daripada manusia wajib — itu yang pembeli bayar.',
    })
  }

  // 7. A verdict needs evidence under it.
  if (c.statesVerdict && !c.hasMarketEvidence) {
    blocks.push({
      code: 'unsupported_verdict',
      fatal: false,
      message: 'Keputusan harga dinyatakan tanpa cukup iklan setanding untuk menyokongnya.',
    })
  }

  return blocks
}

/** May this candidate be released at all? */
export function mayRelease(c: ReleaseCandidate): boolean {
  return validateForRelease(c).length === 0
}

/** Is refund the only remaining exit? */
export function mustRefund(c: ReleaseCandidate): boolean {
  return validateForRelease(c).some(b => b.fatal)
}


/**
 * What a reviewer is told when a release is refused.
 *
 * The blocks above carry a `message` built from the report's own figures, but
 * those objects live only inside the action that computed them. A refusal is
 * carried back to the queue as CODES in the URL, so the codes need words —
 * and the words need to say what to DO, because "release blocked" without a
 * next step is the same silence in a louder font.
 */
export const RELEASE_BLOCK_HELP: Record<ReleaseBlockCode, string> = {
  seller_price_changed:
    'Anda ubah harga seller. Tulis sebabnya dalam nota — pembeli mesti tahu kenapa nombor itu berubah.',
  mileage_provenance:
    'Mileage tidak sepadan dengan rekod claim, tetapi sumbernya hanya dakwaan seller. Guna wording "sila sahkan", bukan tuduhan meter dipusing.',
  unsupported_rollback:
    'Amaran meter dipusing tidak boleh dikeluarkan tanpa bacaan rasmi bertarikh. Sekat amaran itu, atau refund.',
  identity_conflict:
    'Rekod pendaftaran dan iklan tidak sepadan tentang kereta mana ini. Betulkan butiran, atau refund.',
  registration_claim_without_plate:
    'Laporan mendakwa maklumat pendaftaran disemak, tetapi tiada nombor plat. Buang dakwaan itu, atau refund.',
  empty_reviewer_note:
    'Nota daripada manusia wajib — itu yang pembeli bayar RM29 untuk.',
  unsupported_verdict:
    'Tidak cukup iklan setanding untuk menyokong keputusan harga. Refund kalau tidak dapat disokong.',
}
