import { historyUpgradeAvailable, JOMCHECK_UPGRADE_CENTS, ringgit } from '@/lib/pricing'

/**
 * What Paqar says about the accident/claim add-on, in ONE place.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Five surfaces described it and they disagreed with each other and with the
 * product. On the day the add-on went live the homepage still said "Paqar
 * tidak menjual rekod tuntutan", /tentang said "belum dibuka", the insurance
 * guide said "Paqar belum membuka semakan rekod claim", the dedicated page
 * said "belum dibuka" — and the checkout was selling it for +RM88, taking
 * RM117. A buyer who checked the About page after paying would have found
 * Paqar denying it sells the thing it had just sold them.
 *
 * Every one of those lines was written truthfully. They became false the
 * moment a flag moved, and nothing tied them to the flag. Deriving the copy
 * from historyUpgradeAvailable() is what stops it happening again, in either
 * direction: switch the add-on off tomorrow and all five surfaces revert on
 * their own.
 *
 * ── THE LIMITS ARE NOT OPTIONAL ────────────────────────────────────────────
 *
 * They ship WITH the offer rather than beside it, because each one is a way a
 * buyer could be misled by a clean result:
 *
 *   - a claim record is not an accident record; a repair paid for privately
 *     leaves none
 *   - the mileage in a claim is what was recorded THEN, by an insurer. It is
 *     not a verified odometer reading and can never support an accusation
 *   - it is keyed on the registration number, so it needs a plate
 */

/** True when the add-on may be described as something a buyer can purchase. */
export const historyAddOnSellable = historyUpgradeAvailable

/** "+RM88" — derived, so it cannot drift from the amount billed. */
export const HISTORY_ADDON_LABEL = `+RM${ringgit(JOMCHECK_UPGRADE_CENTS)}`

/**
 * One sentence for a limits list. Reads correctly in both states, which is the
 * point: the caller never branches, so a caller cannot forget to.
 */
export function historyAddOnLimitLine(): string {
  return historyUpgradeAvailable()
    ? `Rekod tuntutan insurans dijual sebagai tambahan (${HISTORY_ADDON_LABEL}, perlu nombor plat). Tidak semua kemalangan ada rekod tuntutan, dan Paqar tidak mengesahkan bacaan odometer sebenar.`
    : 'Paqar tidak menjual rekod tuntutan, dan tidak mengesahkan bacaan odometer sebenar.'
}

/** A short status line for pages that name the add-on as a product. */
export function historyAddOnStatusLine(): string {
  return historyUpgradeAvailable()
    ? `Semakan Accident/Claim Insurans — ${HISTORY_ADDON_LABEL}, perlu nombor plat`
    : 'Semakan Accident/Claim Insurans — belum dibuka'
}

/** The limits, for anywhere the add-on is described at length. */
export const HISTORY_ADDON_LIMITS: readonly string[] = [
  'Tidak semua kemalangan ada rekod tuntutan — pembaikan yang dibayar sendiri tidak meninggalkan rekod.',
  'Rekod tuntutan bersih tidak bermakna kereta tiada isu.',
  'Bacaan meter dalam rekod tuntutan adalah bacaan ketika itu, direkodkan oleh penanggung insurans. Ia bukan pengesahan odometer sebenar.',
  'Semakan ini ikut nombor pendaftaran, jadi kami perlukan nombor plat kereta itu.',
]
