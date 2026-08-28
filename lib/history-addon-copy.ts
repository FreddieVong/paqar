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
 *   - it is keyed on the registration number, so it needs a plate — and now,
 *     a plate that has been CHECKED, not merely typed
 *
 * ── WHERE IT IS SOLD, AND WHY THAT CHANGED ─────────────────────────────────
 *
 * It used to be a checkbox at checkout, gated on a plate having been supplied.
 * "WXY1234" satisfied that gate, so a buyer could be billed RM117 for a claim
 * search against a registration that resolves to nothing. At checkout there is
 * no way to know better: the RM0.81 lookup deliberately runs after payment.
 *
 * So it is sold from inside the RELEASED report, where the lookup has run.
 * Copy that describes it must say so — a buyer told "+RM88, perlu nombor plat"
 * will reasonably go looking for a checkbox that is no longer there.
 */

/** True when the add-on may be described as something a buyer can purchase. */
export const historyAddOnSellable = historyUpgradeAvailable

/** "+RM88" — derived, so it cannot drift from the amount billed. */
export const HISTORY_ADDON_LABEL = `+RM${ringgit(JOMCHECK_UPGRADE_CENTS)}`

/**
 * One sentence for a limits list. Reads correctly in both states, which is the
 * point: the caller never branches, so a caller cannot forget to.
 *
 * ── IT IS A LIMITS LINE, SO IT HAS TO BE READ ──────────────────────────────
 *
 * The sellable branch was the longest sentence on the homepage at 30 words,
 * and it said "tambahan" and "ditambah" four words apart, and "nombor plat"
 * where every other surface says "plat". A limit nobody finishes reading
 * protects nobody, which is the whole reason these ship with the offer.
 *
 * All four facts survive: the price, that it is bought from inside the report
 * once the plate has resolved, that a clean claim record is not a clean
 * history, and that Paqar does not verify the odometer. That last one is a
 * DENIAL and must stay one — Paqar cannot detect tampering and must never
 * imply it can.
 *
 * The unavailable branch is left exactly as it was: it is already twelve words.
 */
export function historyAddOnLimitLine(): string {
  return historyUpgradeAvailable()
    ? `Rekod tuntutan insurans boleh ditambah (${HISTORY_ADDON_LABEL}) dari dalam laporan anda, selepas plat disahkan. Tidak semua kemalangan ada rekod tuntutan, dan kami tidak sahkan bacaan odometer sebenar.`
    : 'Paqar tidak menjual rekod tuntutan, dan tidak mengesahkan bacaan odometer sebenar.'
}

/**
 * How Paqar differentiates itself from the record resellers (SCRUT, MyEG).
 *
 * Lives here rather than on the homepage because it makes a claim ABOUT the
 * add-on, and every such claim on this site is derived from one gate. It was
 * a hardcoded "Paqar tidak jual rekod tuntutan" in app/page.tsx — true when
 * written, false the day the add-on went on sale, and present twice: in the
 * visible FAQ and in the FAQPage JSON-LD, where Google can surface it as an
 * answer attributed to Paqar.
 *
 * The differentiation is unchanged in either state, and it is the honest one:
 * the records are a commodity several companies resell, and what Paqar sells
 * is the decision about one advert. When the add-on IS sold it is named last
 * and named as optional, because it is a convenience on top of the product
 * rather than the product.
 */
export function competitorComparisonAnswer(baseReportLabel: string): string {
  const base = 'Tidak. Mereka jual rekod — tuntutan insurans dan sejarah kenderaan. Paqar menilai satu iklan dan beritahu anda apa patut dibuat seterusnya: harga, varian, apa yang perlu disahkan dengan seller, dan langkah seterusnya.'
  return historyUpgradeAvailable()
    ? `${base} Rekod tuntutan pula boleh ditambah kemudian: selepas laporan ${baseReportLabel} siap dan nombor plat disahkan, anda boleh tambah Semakan Accident/Claim (${HISTORY_ADDON_LABEL}) jika mahu.`
    : `${base} Paqar sendiri tidak menjual rekod tuntutan.`
}

/** A short status line for pages that name the add-on as a product. */
export function historyAddOnStatusLine(): string {
  return historyUpgradeAvailable()
    ? `Semakan Accident/Claim Insurans — ${HISTORY_ADDON_LABEL}, ditambah dari dalam laporan selepas plat disahkan`
    : 'Semakan Accident/Claim Insurans — belum dibuka'
}

/** The limits, for anywhere the add-on is described at length. */
export const HISTORY_ADDON_LIMITS: readonly string[] = [
  'Tidak semua kemalangan ada rekod tuntutan — pembaikan yang dibayar sendiri tidak meninggalkan rekod.',
  'Rekod tuntutan bersih tidak bermakna kereta tiada isu.',
  'Bacaan meter dalam rekod tuntutan adalah bacaan ketika itu, direkodkan oleh penanggung insurans. Ia bukan pengesahan odometer sebenar.',
  'Semakan ini ikut nombor pendaftaran, jadi kami perlukan nombor plat kereta itu.',
  'Kami hanya tawarkan semakan ini selepas nombor plat itu disahkan dalam Laporan Pembeli anda — supaya anda tidak bayar untuk carian yang tiada apa-apa untuk dicari.',
]
