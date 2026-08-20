/**
 * What Paqar may say about registration information, and when.
 *
 * ── WHY THIS IS CONDITIONAL NOW ────────────────────────────────────────────
 *
 * The plate became optional (migration 032) because brand/model/year identify
 * a car for nothing, while a plate lookup costs RM0.81 and only earns that cost
 * after payment. But every surface describing the product still promised
 * registration details unconditionally — the homepage, the report pitch, the
 * sample report and /tentang all listed "Maklumat pendaftaran kenderaan" as
 * something the buyer receives.
 *
 * For a buyer who supplied no plate, no lookup ran and none of that exists. A
 * promise that silently does not apply to a whole class of orders is the same
 * failure as an unsupported verdict: the product asserting more than it knows.
 *
 * ── THE THREE STATES ───────────────────────────────────────────────────────
 *
 * They are distinct on purpose, and the middle one is the easiest to get wrong:
 *
 *   not_requested  no plate supplied — nothing was attempted, nothing is owed
 *   unavailable    a plate was supplied but the provider returned nothing
 *   checked        a plate was supplied and a record came back
 *
 * Collapsing the first two into "no data" would tell a buyer who gave no plate
 * that Paqar looked and found nothing, which is untrue and reads as a fault in
 * their car rather than a choice they made at intake.
 *
 * ── WORDING ────────────────────────────────────────────────────────────────
 *
 * "Rasmi" is deliberately avoided everywhere. The lookup provider is RegCheck
 * (Infinite Loop Development Ltd), which names no Malaysian source — only
 * "official government data sources" — so Paqar cannot attribute these fields
 * to JPJ or call them official. That correction already exists in the report's
 * provenance label; this module keeps it from drifting back in elsewhere.
 */

export type RegistrationState = 'not_requested' | 'unavailable' | 'checked'

export function registrationState(params: {
  plateSupplied: boolean
  hasProviderData: boolean
}): RegistrationState {
  if (!params.plateSupplied) return 'not_requested'
  return params.hasProviderData ? 'checked' : 'unavailable'
}

/** True only when the report may compare seller claims against a record. */
export function mayClaimRegistrationCheck(state: RegistrationState): boolean {
  return state === 'checked'
}

/**
 * What the report says about registration, per state.
 *
 * The not_requested line names the buyer's own choice rather than implying a
 * failure, and points at the remedy — a plate can still be added to a future
 * check.
 */
export const REGISTRATION_COPY: Record<RegistrationState, string> = {
  not_requested:
    'Maklumat pendaftaran tidak disemak kerana nombor plat tidak diberikan.',
  unavailable:
    'Maklumat pendaftaran tidak dijumpai untuk nombor plat ini. Ini tidak bermakna ada masalah dengan kereta — rekod tidak selalu lengkap.',
  checked:
    'Maklumat pendaftaran disemak berdasarkan nombor plat yang anda berikan.',
}

/**
 * How the product may be DESCRIBED before a buyer has supplied anything.
 *
 * Used on the homepage, the pitch and the sample report, where the plate is
 * still optional and unknown. Conditional by construction: it states what a
 * plate buys rather than promising it outright.
 */
export const REGISTRATION_OFFER_COPY =
  'Maklumat pendaftaran kenderaan — jika anda beri nombor plat.'
