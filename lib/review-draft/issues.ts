import { MIN_LISTINGS_FOR_NORMAL_VERDICT } from '@/lib/comparables'
import type { ReviewDraftFacts } from './facts'

/**
 * What is odd about this order, found deterministically.
 *
 * ── WHY CODE FINDS THEM, NOT THE MODEL ─────────────────────────────────────
 *
 * "Point out issues if there are any" is the part of the draft a reviewer
 * will lean on hardest, and the one a language model is worst placed to own:
 * it can miss a gap that is right there in the numbers, or invent one that is
 * not. A real order (12 Sep 2026) was advertised as a 2020 and registered in
 * 2019; the human note never mentioned it. That comparison is one line of
 * arithmetic. So the arithmetic lives here, the list is pinned by tests, and
 * the model is handed it to write around.
 *
 * Each issue is one plain-Malay sentence the reviewer can read as-is, and
 * optionally a correction the card pre-fills for them to confirm. Thresholds
 * are the report's own — the mileage bands and the cohort sizes are imported
 * or copied from the same place the buyer's report reads them, so the draft
 * never calls something "rendah" that the report will show as normal.
 *
 * Order matters: identity first, then price, then mileage, then the caveats
 * about the evidence itself. That is the order a note should raise them in.
 */

export type IssueCode =
  | 'year_mismatch'
  | 'price_above_range'
  | 'price_above_median'
  | 'price_below_range'
  | 'mileage_low'
  | 'mileage_high'
  | 'thin_evidence'
  | 'mixed_variants'
  | 'no_plate'
  | 'no_market_data'

export interface Issue {
  code: IssueCode
  /** One sentence, plain Malay, safe to show the reviewer and to feed the model. */
  text: string
  /** A pre-fill for the correction box, when the fix is unambiguous. */
  correction?: { field: 'year'; value: string }
}

const rm = (n: number) => `RM${Math.round(n).toLocaleString('en-MY')}`
const km = (n: number) => `${Math.round(n).toLocaleString('en-MY')} km`

/** Same bands as the report's "Semakan Mileage" card. */
const KM_PER_YEAR_LOW  = 10_000
const KM_PER_YEAR_HIGH = 25_000

export function detectIssues(f: ReviewDraftFacts): Issue[] {
  const out: Issue[] = []
  const { car, price, mileage } = f

  // ── Identity ──────────────────────────────────────────────────────────
  if (!car.plateSupplied) {
    out.push({
      code: 'no_plate',
      text: 'Pembeli tak bagi nombor plat — tiada rekod JPJ untuk disemak. Laporan bergantung pada iklan sahaja.',
    })
  } else if (car.adYear && car.regYear && car.adYear !== car.regYear) {
    out.push({
      code: 'year_mismatch',
      text: `Iklan kata ${car.adYear}, tapi rekod JPJ kata kereta ini didaftar ${car.regYear}. Laporan guna ${car.regYear}.`,
      correction: { field: 'year', value: car.regYear },
    })
  }

  // ── Price ─────────────────────────────────────────────────────────────
  const { askingRm: ask, medianRm: med, minRm: min, maxRm: max } = price
  if (price.verdict == null || ask == null || med == null || min == null || max == null) {
    out.push({
      code: 'no_market_data',
      text: 'Tiada data harga pasaran yang cukup — tak boleh kata mahal atau murah.',
    })
  } else if (ask > max) {
    out.push({
      code: 'price_above_range',
      text: `Seller minta ${rm(ask)} — di atas julat biasa ${rm(min)}–${rm(max)}. Harga tengah ${rm(med)}.`,
    })
  } else if (ask < min) {
    out.push({
      code: 'price_below_range',
      text: `Seller minta ${rm(ask)} — di BAWAH julat biasa ${rm(min)}–${rm(max)}. Terlalu murah pun boleh jadi tanda ada masalah.`,
    })
  } else if (ask > med) {
    out.push({
      code: 'price_above_median',
      text: `Seller minta ${rm(ask)} — ${rm(ask - med)} di atas harga tengah ${rm(med)}, tapi masih dalam julat biasa.`,
    })
  }

  // ── Mileage ───────────────────────────────────────────────────────────
  //
  // Never "diputar" or "tamper": the reading is the seller's claim and the
  // only honest response to an odd one is to ask for the service record.
  if (mileage.kmPerYear != null && mileage.carAgeYears != null && mileage.claimedKm != null) {
    if (mileage.kmPerYear < KM_PER_YEAR_LOW) {
      out.push({
        code: 'mileage_low',
        text: `Mileage ${km(mileage.claimedKm)} untuk kereta ${mileage.carAgeYears} tahun (≈ ${mileage.kmPerYear.toLocaleString('en-MY')} km/tahun) — rendah. Minta rekod servis penuh untuk sokong bacaan ini.`,
      })
    } else if (mileage.kmPerYear > KM_PER_YEAR_HIGH) {
      out.push({
        code: 'mileage_high',
        text: `Mileage ${km(mileage.claimedKm)} untuk kereta ${mileage.carAgeYears} tahun (≈ ${mileage.kmPerYear.toLocaleString('en-MY')} km/tahun) — tinggi. Periksa enjin dan gearbox dengan teliti.`,
      })
    }
  }

  // ── Evidence caveats ──────────────────────────────────────────────────
  if (price.verdict != null && price.count < MIN_LISTINGS_FOR_NORMAL_VERDICT) {
    out.push({
      code: 'thin_evidence',
      text: `Hanya ${price.count} iklan setanding — julat harga ini kurang stabil, guna sebagai panduan awal sahaja.`,
    })
  }
  if (price.mixedVariants) {
    out.push({
      code: 'mixed_variants',
      text: 'Iklan setanding campur varian — sahkan varian dulu sebelum guna julat harga ini.',
    })
  }

  return out
}
