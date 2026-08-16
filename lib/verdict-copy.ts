import type { Verdict } from '@/types/api'

/**
 * The one place the free verdict is put into words.
 *
 * WHY IT IS CENTRAL
 *
 * These four sentences were duplicated in components/check/OverpricedCheckerForm
 * and components/report/FreePriceEvidence — the model tab and the plate tab.
 * Two copies of the product's central claim is two chances to say something the
 * data cannot support, and the copies had already drifted apart in punctuation.
 * One export, imported by both, so a correction cannot land on half the funnel.
 *
 * WHY THE WORDING CHANGED
 *
 * They used to say "paras pasaran semasa" — the current market level. Paqar has
 * never measured that. A cohort is at most 15 adverts (dedupeAndCap), from ONE
 * site (mudah-market is the only scraper), up to seven days old (CACHE_TTL_DAYS),
 * ordered by Mudah relevance rather than price. Describing that as "the current
 * market" claims a completeness and a freshness that do not exist, and it is the
 * same overclaim already corrected in the paid report's methodology line and in
 * the negotiation scripts the buyer pastes to a seller.
 *
 * What Paqar can defend is narrower and still useful: how this price compares to
 * the comparable adverts it actually found. So the sentences name that set.
 *
 * WHAT DELIBERATELY DID NOT CHANGE
 *
 *   - Verdict thresholds. computeVerdict and evaluateVerdictEligibility are
 *     untouched; this is wording, not classification.
 *   - The free/paid boundary. Still no median, no range, no gap, no count —
 *     the figures remain what RM12 sells. "Iklan setanding yang Paqar jumpa"
 *     names the set without quantifying it.
 */
export const VERDICT_LINE: Record<Verdict, string> = {
  overpriced:    'Harga ini lebih tinggi daripada iklan setanding yang Paqar jumpa.',
  slightly_high: 'Harga ini sedikit lebih tinggi daripada iklan setanding yang Paqar jumpa.',
  fair_price:    'Harga ini setara dengan iklan setanding yang Paqar jumpa.',
  good_deal:     'Harga ini lebih rendah daripada iklan setanding yang Paqar jumpa — semak sebabnya.',
}

/**
 * The scope caveat that belongs next to any verdict.
 *
 * Kept separate so a surface can place it where its layout allows, but exported
 * from here so the wording cannot drift from the sentences above.
 */
export const VERDICT_BASIS_LINE =
  'Dinilai berdasarkan tahun, model dan varian kenderaan.'

/**
 * What the RM12 report contains, as promised beside the verdict.
 *
 * Was repeated four times in OverpricedCheckerForm — once per verdict — and
 * every copy said "Harga pasaran sebenar", the REAL market price, for the same
 * capped single-site cohort. Four identical strings is four places for that
 * claim to survive a correction, which is exactly what happened: a
 * case-sensitive sweep found the CTA button and missed all four of these.
 *
 * "Harga tengah iklan setanding" says what the report actually shows: the
 * median of the comparable adverts Paqar found. Still a paid figure, so the
 * free/paid boundary is untouched.
 */
export const PAID_REPORT_CTA_SUB =
  'Harga tengah iklan setanding · Maklumat kenderaan · Skrip rundingan'
