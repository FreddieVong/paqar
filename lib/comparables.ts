import type { PricedListing } from './price-stats'
import { filterListingsByYear, filterOutlierPrices } from './price-stats'

// Performance / materially price-distinct variant badges we recognise as
// discriminators. An allowlist (not a denylist of engine families) is the safe
// choice: an unrecognised token yields a mixed-variant fallback with a warning,
// never a false same-variant claim. Engine families (TSI, TDI, VTEC, …) are
// deliberately absent — they appear on base and premium trims alike.
const PERFORMANCE_TOKENS = new Set([
  'GTI', 'R', 'RS', 'TYPER', 'AMG', 'M', 'N', 'ST', 'GTD', 'GTE',
  'TRD', 'GR', 'NISMO', 'ABARTH', 'JCW', 'MUGEN', 'CTR',
  // R3 is Proton's performance sub-brand (Saga R3). PERFORMANCE_MODEL_MARKER
  // already recognised it; without it here the two detectors disagreed and a
  // genuine R3 was priced against ordinary Sagas.
  'R3',
])

/**
 * Every manufacturer sells a cosmetic package named after its performance
 * sub-brand: AMG Line, M Sport, N Line, R Line, GR Sport. The car underneath is
 * an ordinary model with a body kit — a 330i M Sport is not an M3, and a C300
 * Coupé AMG Line is not a C63.
 *
 * The written form is always "<token> Line" or "<token> Sport", so one rule
 * covers every brand, including ones not sold here yet. Applied at all three
 * places the token is read, which previously disagreed with each other:
 * PERFORMANCE_MODEL_MARKER, extractVariantToken and variantRegex.
 *
 * Matches a trailing "(CKD)"/"(CBU)" with no space, as NVIC writes it.
 */
const PACKAGE_SUFFIX = /^(?:LINE|SPORT)\b/i

/**
 * Families that ARE the performance model, rather than families that contain
 * one. Read from the NVIC family field, never from a listing title.
 *
 * Derived from the production NVIC dataset on 2026-08-10, not assumed. BMW has
 * 3,178 rows across 43 families and encodes its M cars as dedicated families —
 * M2, M3, M4, M5, M6, M8, XM — whose median new prices (RM721k to RM1.45m)
 * stand far above the make median of RM386k. Their VARIANT strings are things
 * like "MY23 G87" and "MY22 FACELIFT", carrying no performance token at all,
 * which is why extractVariantToken could never see them and a genuine M3 came
 * back mixed_variants with a 330i M Sport still in its cohort.
 *
 * Mercedes-Benz does the same for its standalone AMG models (family "AMG",
 * median RM1.56m); its C43/C63 keep family "C" and are already found through
 * the variant string.
 *
 * Nothing else needs this. Honda, Toyota, Proton and Hyundai all carry their
 * performance models in the variant field (Civic "TYPE R", Yaris "GR YARIS",
 * Saga "1.3 R3", Ioniq "5 N"), and none of them has a dedicated family.
 *
 * Deliberately NOT a title pattern. All eleven cached listings with a bare
 * M2-M8 badge are cosmetic conversions — see isLookalike.
 */
const PERFORMANCE_FAMILY = /^(?:M[2-8]|XM|AMG)$/i

// Pull the discriminating performance token out of the NVIC variant string
// ("Golf GTi" → "GTi", "Golf R" → "R", base "Golf 1.4 TSI" → null). Whitespace
// tokenised, so "R-Line" is its own token and never collapses to "R".
//
// DO NOT REMOVE the PACKAGE_SUFFIX check. variantRegex had always refused to
// match "M Sport" LISTINGS, but nothing stopped the buyer's OWN variant from
// being read that way, so a "330i M Sport" was classified an M car and then
// compared against the only listings the matcher accepts — genuine M3s and M4s.
// With fewer than three of those on Mudah the verdict is suppressed outright,
// so the usual outcome was a paying customer getting no verdict at all.
// 192 of the 909 production NVIC rows that reach this function (21%) are
// packages: BMW 110, Mercedes-Benz 73, Hyundai 5, Toyota 4.
// Guarded by __tests__/lib/variant-package-designation.test.ts.
export function extractVariantToken(
  officialVariant: string | null | undefined,
  model: string | null | undefined,
): string | null {
  return classifyVariantToken(officialVariant, model).token
}

/**
 * Why there is no token, which is not the same question as whether there is one.
 *
 *   'found'    a real performance token
 *   'package'  a performance badge used as a styling package — POSITIVE evidence
 *              the car is an ordinary model, not merely absence of evidence
 *   'none'     nothing recognised either way
 *
 * The distinction changes the cohort. 'none' has to fall back to a mixed one,
 * because a special variant Paqar cannot name is still special. 'package' has
 * been positively identified as mainstream, so it belongs in the normal cohort
 * WITH the performance models excluded — otherwise a C200 AMG Line keeps a real
 * C43 AMG as a comparable and publishes a ceiling of RM410,000 against its own
 * RM230,000 median, which is the same shape of harm as the recon contamination.
 */
export function classifyVariantToken(
  officialVariant: string | null | undefined,
  model: string | null | undefined,
): { token: string | null; reason: 'found' | 'package' | 'none' } {
  // The family itself names the performance model (BMW M3, Mercedes AMG). This
  // is structured NVIC data about the buyer's own car — the strongest evidence
  // available — so it outranks anything the variant string does or does not say.
  const family = (model ?? '').trim()
  if (PERFORMANCE_FAMILY.test(family)) return { token: family, reason: 'found' }

  if (!officialVariant) return { token: null, reason: 'none' }
  const modelTokens = new Set((model ?? '').toUpperCase().split(/\s+/).filter(Boolean))
  const tokens = officialVariant.split(/\s+/).filter(Boolean)
  let sawPackage = false
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    const up  = tok.toUpperCase()
    if (modelTokens.has(up)) continue
    if (!PERFORMANCE_TOKENS.has(up)) continue
    if (PACKAGE_SUFFIX.test(tokens[i + 1] ?? '')) { sawPackage = true; continue }
    return { token: tok, reason: 'found' }
  }
  return { token: null, reason: sawPackage ? 'package' : 'none' }
}

function escapeToken(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * WHERE "THIS TOKEN APPEARS AS A BADGE" IS DEFINED. ONE PLACE, ON PURPOSE.
 *
 * Two functions need this rule — variantRegex, which decides whether a listing
 * mentions the badge, and isLookalike, which decides whether that same mention
 * is a conversion. They each carried their own copy, and the copies drifted:
 * variantRegex began allowing a leading hyphen so "Civic TYPE-R" would match,
 * isLookalike did not, and "2020 Honda CIVIC 1.8 S (A) TRPE-R KIT & SPORT RIM"
 * (RM69,800, verbatim from the cache) walked past the KIT rule written to stop
 * it, taking the Civic Type R median from RM199,800 to RM137,800.
 *
 * A second copy was wrong in the other direction: isLookalike applied the
 * single-letter boundary to every token, so a scraper-concatenated
 * "C200AMG Bodykit" — which variantRegex matches — was never inspected at all.
 *
 * Anything that asks "is the token here?" must ask through this function.
 * Guarded by __tests__/lib/token-boundary-consistency.test.ts, which fails if
 * the matcher and the filter ever disagree about a boundary form again.
 *
 * SINGLE-LETTER tokens ("Golf R", "X3 M") must stand as their own word:
 * whitespace either side, or a leading hyphen for "TYPE-R". A lone letter is
 * usually notation in a Malaysian listing — "(M)" is manual transmission
 * (172 titles), "F.S.R" is a service record, "R/CAM" a reverse camera — and a
 * whitelist is the only thing that also survives CSS in the scraper tail.
 *
 * MULTI-LETTER tokens use alphabetic boundaries so "2.0GTI" still matches.
 * They are not ambiguous the same way: nothing writes "AMG" as notation.
 */
function tokenBoundary(token: string): { lead: string; trail: string } {
  return token.length === 1
    ? { lead: `(?<![^\\s-])`,   trail: `(?![^\\s])` }
    : { lead: `(?<![A-Za-z])`,  trail: `(?![A-Za-z])` }
}

function variantRegex(token: string): RegExp {
  const esc = escapeToken(token)
  // A single-letter badge ("Golf R", "X3 M") must stand as its OWN WORD.
  //
  // Word separators are whitespace, a string edge, or a leading hyphen — the
  // last because "Civic TYPE-R" is a real spelling in the cache. Everything
  // else disqualifies: alphanumerics and underscore (so "R-Line", "R18", "Rim",
  // "WRRTY" and scraper tails like "Dealer.__m__-_R_5mpmr8eq" never match), and
  // the punctuation that glues abbreviations together — ( ) . / ,
  //
  // That punctuation clause is the whole point, because a lone letter in a
  // Malaysian listing is far more often notation than a badge. Measured across
  // all 3,368 cached titles:
  //
  //   token M   208 matches, 171 of them "(M)" — MANUAL TRANSMISSION.
  //             "(A)" appears 2,413 times, "(M)" 172. A genuine X3 M / X4 M /
  //             Z4 M / X6 M buyer would have been matched against every manual
  //             car of that model.
  //   token R   42 matches; the neighbours are space 29/34 but also "." 9/5
  //             ("F.S.R" = full service record), "/" 2/2 ("R/CAM" = reverse
  //             camera), "," and ")". All abbreviation noise, no badge.
  //   token N   3 matches, all of them "Buy N Drive" — "N" meaning "and".
  //
  // Genuine spellings all survive, verified against the same corpus: "TYPE R"
  // 15, "TYPE-R" 1, "GOLF R" 5, "EURO R" 5, "X3 M"/"Z4 M" 2.
  //
  // Trailing hyphen stays disqualifying so "R-Line" cannot match.
  //
  // Multi-letter tokens use alphabetic boundaries so "2.0GTI" still matches.
  // They are not ambiguous in the same way — no Malaysian listing writes "AMG"
  // or "GTI" as notation — so they keep the looser rule deliberately.
  //
  // Both then reject a following "Line"/"Sport": those are cosmetic packages
  // (see PACKAGE_SUFFIX), so an ordinary "C200 AMG Line" must not be priced as
  // a comparable for a real AMG. This guard used to apply to single-letter
  // tokens only, which let every "AMG Line" listing into an AMG cohort.
  // \b cannot be used to close "line"/"sport": the scraper concatenates the next
  // field straight onto the title, so "M Sport2017Auto100k" has no boundary
  // after "Sport" and three ordinary 330e M Sports slipped through as M cars.
  // A following letter is what actually disqualifies it.
  const { lead, trail } = tokenBoundary(token)
  const notAPackage = `(?![\\s-]+(?:line|sport)(?![A-Za-z]))`

  return new RegExp(`${lead}${esc}${trail}${notAPackage}`, 'i')
}

// Keep listings whose TITLE mentions the variant token. A title is the seller's
// claim, not verification — callers must frame results as "labelled", never as
// confirmed-genuine variants.
/**
 * Words that mean "made to look like", not "is".
 *
 * Counted across all 3,368 cached listings on 2026-08-10: CONVERT 18, BODYKIT
 * 15, KIT 8, BODY KIT 3, COVERT 1, CONCEPT 1. LOOK and REPLICA appear zero
 * times and are deliberately NOT listed — this set is what the corpus actually
 * contains, not what one might imagine it contains.
 *
 * CONVERT/COVERT/CONCEPT are decisive anywhere in a title: no one selling a
 * genuine M3 writes "convert". KIT words are not, because a real Golf GTI can
 * wear a bodykit ("GOLF GTI MK6 F/B.KIT MK7 HEADLAMP" is a genuine GTI), so
 * those only disqualify when they sit immediately beside the badge.
 */
const LOOKALIKE_MARKER = /\b(?:CONVERT|COVERT|CONCEPT|REPLICA)\b/i
const KIT_WORD         = /^(?:BODY-?KIT|KIT|LOOK|LOOKALIKE)\b/i

/**
 * Is this title claiming the badge, or claiming to resemble it?
 *
 * WHY THIS EXISTS
 *
 * Title matching is documented as "labelled, not verified", which was fine
 * while a label was merely weak evidence. It stops being fine for special
 * cohorts, because those are tiny: every one of the eleven listings in the
 * production cache carrying a bare M2-M8 badge is an ordinary BMW wearing M
 * cosmetics — six 530e "CONVERT M5" at RM63,800, a 330i "M3 CONCEPT", a 330E
 * "M3 BODYKIT", a 318i "CONVERT M3", a 320i "COVERT M3". Not one is a real M
 * car. Matching a genuine M3 buyer against that set would report a median of
 * about RM63,800 for a car worth several hundred thousand.
 *
 * The same shape appears on every performance family: "C200 AMG Bodykit",
 * "GLC250 AMG CONVERT GLC63", "A200 CONVERT A45S AMG", "GR BODYKIT" on a
 * Vellfire, "OFFER R3" on a Preve.
 */
function isLookalike(title: string, token: string): boolean {
  if (LOOKALIKE_MARKER.test(title)) return true
  // Badge immediately followed by a kit word: "M3 BODYKIT", "AMG Bodykit".
  //
  // Same boundary the matcher used — see tokenBoundary. Never inline it here
  // again; that is precisely how the TRPE-R regression happened.
  const { lead, trail } = tokenBoundary(token)
  const re = new RegExp(`${lead}${escapeToken(token)}${trail}\\s+(\\S+)`, 'i')
  const after = re.exec(title)?.[1]
  return after != null && KIT_WORD.test(after)
}

export function matchListingsByVariant<T extends PricedListing>(listings: T[], token: string): T[] {
  if (!token) return listings
  const re = variantRegex(token)
  return listings.filter(l => {
    const title = l.title ?? ''
    return re.test(title) && !isLookalike(title, token)
  })
}

// ── Performance MODELS in a mainstream cohort ──────────────────────────────
//
// Distinct from PERFORMANCE_TOKENS above, and deliberately so. Those tokens are
// extracted from the NVIC *official variant* string, where "R" unambiguously
// means the Golf R. Matched against a free-text Mudah TITLE the same tokens are
// far too loose — "RS" is a mainstream Civic and HR-V trim in Malaysia, and "R"
// occurs in half the ad copy on the site. This is a narrower set of performance
// MODEL names, for the one job of spotting a different car sitting in a
// mainstream model's cohort.
//
// GR SPORT is deliberately absent: Toyota sells a cosmetic "GR Sport" trim of
// the Vios and Yaris that is an ordinary car at an ordinary price. Only the
// GR Yaris — a different vehicle on a different platform — is named.
// The trailing lookahead keeps the cosmetic packages out (see PACKAGE_SUFFIX):
// "C200 AMG Line" is an ordinary C200 and belongs in the mainstream C-Class
// cohort. Until now only the >=1.5x-median half of excludePerformanceModels
// stopped it being dropped, which is a coincidence rather than a guarantee —
// in a thin, cheap cohort an AMG Line can clear 1.5x and be excluded wrongly.
const PERFORMANCE_MODEL_MARKER =
  /(?:\bGR[\s-]*YARIS\b|\bTYPE[\s-]*R\b|\bTYPER\b|\bR3\b|\bNISMO\b|\bMUGEN\b|\bABARTH\b|\bJCW\b|\bAMG\b|\bGTI\b|\bCTR\b)(?![\s-]+(?:line|sport)\b)/i

/**
 * Is this FREE TEXT naming a performance model?
 *
 * The counterpart to extractVariantToken, and deliberately not the same rule.
 * extractVariantToken reads a STRUCTURED NVIC variant field, where "RS" and "M"
 * and "R" are unambiguous because the manufacturer put them there. Applied to
 * arbitrary text — what a buyer typed, or a JPJ description — the same tokens
 * are wrong far more often than they are right. Measured against a corpus of
 * real Malaysian names:
 *
 *   extractVariantToken     4 wrong out of 19
 *   this marker             0 wrong out of 19
 *
 * The four it got wrong were not academic. "Civic RS" and "Vios GR Sport" are
 * mainstream trims, and treating them as special variants pushed the cohort
 * into mixed_variants mode, which SUPPRESSES the verdict outright — the buyer
 * saw "varian khas, no price verdict" while fifteen good comparables sat
 * unused. No verdict means no proof of value before the RM12 ask.
 *
 * Conversely "Saga R3" was missed, so a genuine performance edition was priced
 * against ordinary Sagas.
 */
export function isPerformanceModelText(text: string | null | undefined): boolean {
  return PERFORMANCE_MODEL_MARKER.test(text ?? '')
}

/**
 * How far above the cohort median a marked listing must sit before it is read
 * as a genuine performance MODEL rather than a base car wearing its badge.
 *
 * The marker alone is not enough, and this is the whole reason the rule needs
 * two signals. Malaysian listings advertise body kits constantly, and measured
 * against real production data the two populations do not overlap at all:
 *
 *   genuine performance models   1.80x – 2.87x   (Civic Type R, GR Yaris, Saga R3)
 *   base cars wearing the badge  0.89x – 1.13x   ("1.8 S /TYPE R KIT / SPORTRIM
 *                                                 BARU", "1.5 RS FL5 TYPE R
 *                                                 NICE NUMBER", "MUGEN STYLE")
 *
 * 1.5 sits in the middle of that gap, closer to the false positives than to the
 * true ones, so the rule errs toward KEEPING a listing. Excluding a real car is
 * the worse mistake: it shrinks a cohort that a buyer's verdict depends on.
 */
const PERFORMANCE_MODEL_MIN_RATIO = 1.5

/**
 * Below this many year-matched listings there is no median worth measuring a
 * ratio against, so the rule does not run. Mirrors filterOutlierPrices, which
 * declines for the same reason at the same size.
 */
const PERFORMANCE_FILTER_MIN_SAMPLE = 4

/**
 * Drops listings that are a materially different, materially pricier MODEL
 * sharing a mainstream model's name.
 *
 * WHY THIS EXISTS
 *
 * A Civic Type R at RM209,900 and a GR Yaris at RM180,000 were sitting in the
 * base Civic and Yaris cohorts. filterOutlierPrices could not remove them: it
 * exists for typos and wrong generations and keeps anything within 2.2x of the
 * median, and these prices are real — they are simply real prices for a
 * different car. The damage was not cosmetic:
 *
 *   /harga-civic-2022 told buyers a 2022 Civic is only questionable above
 *   RM172,584 (max x 1.08) against a median of RM85,999, and published that
 *   range as FAQPage structured data;
 *
 *   /api/price-check returned WAJAR — "within the market" — for a 2022 Civic
 *   advertised at RM120,000, because askingPrice <= max and max was the Type R.
 *
 * A verdict that calls a RM120k car fair when the market is RM86k is the exact
 * harm this product exists to prevent.
 *
 * Applied only to MAINSTREAM cohorts. When the subject vehicle is itself a
 * special variant, buildComparableCohort's existing same-variant matching is
 * the correct machinery and this must not run — stripping performance listings
 * for a Type R buyer would leave them with no comparables at all.
 */
export function excludePerformanceModels<T extends PricedListing>(listings: T[]): T[] {
  const priced = listings.filter(l => Number.isFinite(l.price) && l.price > 0)
  if (priced.length < PERFORMANCE_FILTER_MIN_SAMPLE) return listings

  const median = medianOfRaw(priced.map(l => l.price))
  if (median <= 0) return listings

  return listings.filter(l => {
    if (!PERFORMANCE_MODEL_MARKER.test(l.title ?? '')) return true
    if (!Number.isFinite(l.price) || l.price <= 0) return true
    return l.price / median < PERFORMANCE_MODEL_MIN_RATIO
  })
}

// ── The same car posted twice ──────────────────────────────────────────────
//
// A Mudah URL is `mudah.my/<slug>-<listingId>.htm`. The id is per POSTING; the
// slug is generated from the title and is therefore per DESCRIPTION. A dealer
// who reposts a car gets a new id and the same slug.
//
// THE TRAP, measured before writing any of this
//
// Grouping by slug alone looks obviously right and is catastrophically wrong.
// Across 833 production listings, 66 slug groups covering 157 listings — 19% of
// everything — share a slug. Only two of those groups are the same car. The
// rest are genuinely different cars whose descriptions collapse to the same
// generic slug: `2023-nissan-almera-1-0-vlt-a` matched five separate vehicles
// at RM50,800 through RM75,000 with mileages from 25k to 90k. Deduplicating on
// the slug would have deleted a fifth of the market and called it hygiene.
//
// So the slug is necessary and nowhere near sufficient. A posting is treated as
// a repeat only when the slug, the exact asking price, the mileage BAND and the
// transmission all match — four fields that agree by coincidence far less often
// than any one of them does.
const LISTING_ID   = /mudah\.my\/(.+?)-\d{6,}\.htm/
const MILEAGE_BAND = /(\d+k-\d+k|<\s*5k)/
const TRANSMISSION = /(Auto|Manual)/

/**
 * A per-vehicle fingerprint, or null when it cannot be built confidently.
 *
 * Null is the safe answer and every caller treats it as "keep this listing".
 * The mileage band and transmission are REQUIRED rather than optional-with-a-
 * fallback: if the scraper's card format ever changes, a degraded fingerprint
 * of slug+price alone would start merging cars that merely share a description
 * and a price — and the production data has exactly that case, two X50s at
 * RM60,800 one mileage band apart. Failing to dedupe is cheap; merging two real
 * cars corrupts the median a buyer acts on.
 */
function listingFingerprint(l: PricedListing): string | null {
  const slug = (l.url ?? '').match(LISTING_ID)?.[1]
  if (!slug) return null
  const mileage = (l.title ?? '').match(MILEAGE_BAND)?.[1]
  const trans   = (l.title ?? '').match(TRANSMISSION)?.[1]
  if (!mileage || !trans) return null
  return `${slug}|${l.price}|${mileage}|${trans}`
}

/**
 * Collapses repeat postings of the same vehicle to one comparable.
 *
 * Counting one car twice overstates both the sample and the confidence derived
 * from it — comparableConfidence bands at 5 and 10 listings, so on a thin
 * cohort a single repost can promote "limited data" to "medium".
 *
 * Measured impact on production data is deliberately small: 3 listings of 833
 * (0.36%), 3 of 58 cohorts, no confidence band changes, medians moving by at
 * most RM500. That is the honest size of the problem, and the reason this rule
 * is conservative rather than clever — the failure mode of an aggressive
 * version is far more expensive than the duplicates it would catch.
 *
 * NOTE: this does NOT count independent SELLERS. The scraper captures the
 * seller TYPE (Verified Dealer / Direct Owner / Mudah Certified) but never the
 * seller's identity, so two dealers advertising the same physical car are
 * indistinguishable from two cars. Closing that gap needs a scraper change, not
 * a change here.
 */
export function excludeDuplicateListings<T extends PricedListing>(listings: T[]): T[] {
  const seen = new Set<string>()
  return listings.filter(l => {
    const fp = listingFingerprint(l)
    if (fp === null) return true          // cannot fingerprint -> never merge
    if (seen.has(fp)) return false
    seen.add(fp)
    return true
  })
}

// ── Reconditioned imports ──────────────────────────────────────────────────
//
// Mudah renders a card as
//   {price}{title}{year}{transmission}{mileage-band}{condition}{seller-type}
// and the scraper stores that whole string. `condition` is a DISCRETE field
// with three observed values across 833 production listings: Used (814),
// Recon (13), absent (6). This reads that field rather than pattern-matching
// ad copy.
//
// No /i flag, deliberately: the value is capitalised, and a case-insensitive
// boundary check would treat the 'V' of the "ReconVerified Dealer" that follows
// it as a lowercase letter and never match.
const CONDITION_FIELD = /\d+k-\d+k([A-Za-z ]{2,24}?)(?:Verified|Direct|Mudah|$)/

function listingCondition(title: string | null | undefined): string | null {
  const m = (title ?? '').match(CONDITION_FIELD)
  return m ? m[1]!.trim() : null
}

/**
 * Drops reconditioned imports from a used-car cohort.
 *
 * A "recon" is an unregistered reconditioned import. It has never been
 * registered in Malaysia — no plate, no geran, no road tax history, no
 * Malaysian owner — and it is priced on import duty rather than on local
 * resale. Every other part of Paqar presupposes a registered vehicle: the plate
 * lookup, the JPJ and roadtax guidance, the insurance claim history. A buyer
 * asking "is this used Civic fairly priced" is not shopping against recons.
 *
 * This is the residual cause of the two worst public cohorts once performance
 * models are out. Measured on production data:
 *
 *   civic-2022   max RM159,800 -> RM101,555   (median RM85,999 -> RM83,233)
 *   civic-2021   max RM129,800 -> RM 87,800   (median RM71,800 -> RM69,800)
 *   ativa-2021   median moves by RM10
 *
 * Three of 58 cohorts, 13 of 833 listings, and no cohort loses verdict
 * eligibility. Applied to every cohort, not only mainstream ones: it is a
 * question of which MARKET a listing belongs to, orthogonal to which variant.
 */
export function excludeReconImports<T extends PricedListing>(listings: T[]): T[] {
  return listings.filter(l => listingCondition(l.title) !== 'Recon')
}

/**
 * Which market a car is being sold in. Not a filter preference — two different
 * markets that happen to share a model name.
 *
 * 'used'  a registered Malaysian car, priced on local resale.
 * 'recon' an unregistered reconditioned import, priced on import duty.
 */
export type ListingMarket = 'used' | 'recon'

/**
 * Keeps ONLY reconditioned imports — the mirror of excludeReconImports, for a
 * buyer whose own car is a recon.
 *
 * ── WHY THIS HAD TO EXIST ──────────────────────────────────────────────────
 *
 * excludeReconImports was written to answer "is this used Civic fairly
 * priced", and for that it is right: recon imports are a different market and
 * they dragged the Civic 2022 ceiling to RM172,584 against an RM86k median.
 *
 * But it was applied to EVERY cohort, including cohorts built for buyers who
 * are themselves shopping for a recon. Measured on production data, that
 * turned away five cached model-years outright — among them Lexus RX 2023,
 * where all eleven year-matched comparables were recon 350s in a RM293k–331k
 * band, and Toyota Alphard 2021 and 2022. Paqar held a near-perfect cohort for
 * a RM300k decision and answered "we have not found enough comparable ads."
 *
 * Those are not marginal cars. Recon is how Malaysia buys imported Lexus,
 * Alphard and Vellfire, and Carlist files them under a /recon-cars/ path of
 * their own, so a buyer researching one is disproportionately likely to be
 * the buyer pasting a link.
 *
 * The rule was never "recon does not count". It is COMPARE LIKE WITH LIKE:
 * never mix the two markets in one cohort. Excluding recons from a used cohort
 * and excluding used cars from a recon cohort are the same rule applied from
 * the two sides.
 */
export function onlyReconImports<T extends PricedListing>(listings: T[]): T[] {
  return listings.filter(l => listingCondition(l.title) === 'Recon')
}

/** Median of a raw price list — the reference the ratio is measured against. */
function medianOfRaw(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  if (sorted.length === 0) return 0
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

export type CohortMode = 'same_variant' | 'mixed_variants' | 'normal'
export type FallbackReason =
  | 'insufficient_variant_matches'
  | 'no_variant_token'
  | 'not_special'
  | null

export interface ComparableCohort<T extends PricedListing = PricedListing> {
  listings:       T[]
  prices:         number[]
  median:         number | null
  min:            number | null
  max:            number | null
  /**
   * The TYPICAL band — 10th and 90th percentile of the same cohort.
   *
   * ── WHY THE VERDICT STOPPED USING min/max ──────────────────────────────
   *
   * A verdict of "within the observed range" is true of every listing in the
   * cohort by construction, and measuring it said exactly that: across 4,988
   * real asking prices in 489 cached model-years, min/max returned WAJAR
   * 100.0% of the time. Not usually — always. It was a constant function
   * wearing the clothes of a judgement, and a buyer who pays for an answer and
   * receives the only answer it can give has been told nothing.
   *
   * One seller asking a fantasy price is enough to do it: max becomes their
   * number and every real car underneath it is "fair".
   *
   * p10/p90 keeps the same conservative spirit — a car has to be outside the
   * middle 80% of the market before Paqar says anything sharper — while being
   * able to say it at all. Same 4,988 prices: 6.6% berbaloi, 87.0% wajar,
   * 3.5% agak mahal, 2.8% mahal.
   *
   * Derived from the SAME cohort as everything else, so this does not create a
   * second source of pricing truth. min/max remain, because the published
   * valuation API documents them as the lowest and highest comparable listing
   * and that is still what they are.
   */
  p10:            number | null
  p90:            number | null
  count:          number
  mode:           CohortMode
  matchBasis:     'listing_title' | null
  variantToken:   string | null
  fallback:       boolean
  fallbackReason: FallbackReason
}

interface CohortOptions {
  year?:             string | number | null
  officialVariant?:  string | null
  model?:            string | null
  isSpecialVariant?: boolean
  minSample?:        number
  /**
   * Which market the BUYER'S car is in — 'used' by default, so every existing
   * caller keeps the local-used cohort it already had. Only a caller that
   * positively knows the car is an unregistered import passes 'recon'.
   */
  market?:           ListingMarket
}

// ── Product policy ─────────────────────────────────────────────────────────
//
// Deliberately separate from the cohort statistics above. A one-listing cohort
// genuinely HAS a median — that single price — and the cohort must keep
// reporting it, because the cohort's job is to describe the evidence
// truthfully. What changes with sample size is not the arithmetic but whether
// Paqar has earned the right to tell a buyer "this is MAHAL".
//
// Conflating the two is what produced the RM0 bug: the report nulled the median
// to express "not enough data", then formatted that null as currency and pasted
// "harga tengah pasaran sekarang RM0" into the message the buyer sends the
// seller. Policy belongs in a policy function, not in a statistic.

/** Minimum comparables before any buyer-facing verdict may be shown. */
export const MIN_LISTINGS_FOR_VERDICT = 3
/** At or above this, a verdict carries no provisional caveat. */
export const MIN_LISTINGS_FOR_NORMAL_VERDICT = 5

export type VerdictSuppressionReason =
  | 'insufficient_data'
  | 'mixed_variants'
  | 'missing_asking_price'

export type VerdictEvidenceLevel =
  | 'none'
  | 'provisional'
  | 'normal'

export interface VerdictEligibility {
  eligible:          boolean
  evidenceLevel:     VerdictEvidenceLevel
  suppressionReason: VerdictSuppressionReason | null
}

/**
 * The single rule deciding whether Paqar may publish a price verdict.
 *
 *   no asking price          → nothing to judge against
 *   mixed special variants   → never, at any count: comparing a GTI to base
 *                              Golfs is wrong however many Golfs there are
 *   0–2 comparables          → no verdict
 *   3–4 comparables          → provisional, and the caller MUST show a caution
 *   5+ comparables           → normal
 *
 * Variant mismatch is checked before count on purpose — it is a correctness
 * failure, not a sample-size one, so more listings cannot cure it.
 */
export function evaluateVerdictEligibility(
  cohort: Pick<ComparableCohort, 'count' | 'median' | 'min' | 'max' | 'mode' | 'variantToken'>,
  askingPriceRm?: number | null,
): VerdictEligibility {
  if (askingPriceRm == null) {
    return { eligible: false, evidenceLevel: 'none', suppressionReason: 'missing_asking_price' }
  }

  if (cohort.mode === 'mixed_variants' && cohort.variantToken != null) {
    return { eligible: false, evidenceLevel: 'none', suppressionReason: 'mixed_variants' }
  }

  if (
    cohort.count < MIN_LISTINGS_FOR_VERDICT ||
    cohort.median == null || cohort.min == null || cohort.max == null
  ) {
    return { eligible: false, evidenceLevel: 'none', suppressionReason: 'insufficient_data' }
  }

  if (cohort.count < MIN_LISTINGS_FOR_NORMAL_VERDICT) {
    return { eligible: true, evidenceLevel: 'provisional', suppressionReason: null }
  }

  return { eligible: true, evidenceLevel: 'normal', suppressionReason: null }
}

export type ComparableConfidence = 'low' | 'medium' | 'high'

/**
 * How much weight the comparable SET carries — distinct from whether a verdict
 * may be issued at all. A 4-listing cohort is verdict-eligible (provisional)
 * AND low confidence; a 12-listing mixed-variant cohort is high confidence in
 * its range but not verdict-eligible at all. Keep the two concepts apart.
 *
 * Previously duplicated in three places, two of which had already drifted.
 */
export function comparableConfidence(count: number): ComparableConfidence {
  if (count >= 10) return 'high'
  if (count >= MIN_LISTINGS_FOR_NORMAL_VERDICT) return 'medium'
  return 'low'
}

function medianOf(prices: number[]): number | null {
  if (prices.length === 0) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

// Trim outliers while keeping the listing↔price link: filterOutlierPrices works
// on numbers, so keep every listing whose price survived the trim.
function trimListings<T extends PricedListing>(listings: T[]): T[] {
  const validPriced = listings.filter(l => Number.isFinite(l.price) && l.price > 0)
  const kept = filterOutlierPrices(validPriced.map(l => l.price))
  const budget = new Map<number, number>()
  for (const p of kept) budget.set(p, (budget.get(p) ?? 0) + 1)
  return validPriced.filter(l => {
    const n = budget.get(l.price) ?? 0
    if (n <= 0) return false
    budget.set(l.price, n - 1)
    return true
  })
}

/**
 * Nearest-rank percentile over an already-sorted array.
 *
 * On a small cohort the ends collapse toward min and max — p10 of four
 * listings IS the lowest — which is the right behaviour: with that little
 * evidence the band should not pretend to be narrower than the data.
 */
function percentileOf(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))
  return sorted[i]!
}

function assemble<T extends PricedListing>(
  listings: T[],
  meta: Pick<ComparableCohort<T>, 'mode' | 'matchBasis' | 'variantToken' | 'fallback' | 'fallbackReason'>,
): ComparableCohort<T> {
  const prices = listings.map(l => l.price)
  const sorted = [...prices].sort((a, b) => a - b)
  return {
    listings,
    prices,
    median: medianOf(prices),
    min:    prices.length ? Math.min(...prices) : null,
    max:    prices.length ? Math.max(...prices) : null,
    p10:    percentileOf(sorted, 0.10),
    p90:    percentileOf(sorted, 0.90),
    count:  listings.length,
    ...meta,
  }
}

/**
 * Single source of truth for variant-aware market comparisons. Every displayed
 * statistic and every explanatory sentence must derive from this one result so
 * math and copy can never describe different listing sets.
 *
 * Selection order: family/model (implied by the cached row) → registration-year
 * window → (special variants only) exact-variant title match → outlier trim.
 * The minimum-sample gate is applied to the count AFTER matching AND trimming.
 */
export function buildComparableCohort<T extends PricedListing>(
  listings: T[],
  opts: CohortOptions = {},
): ComparableCohort<T> {
  const {
    year, officialVariant, model, isSpecialVariant = false, minSample = 3,
    market = 'used',
  } = opts

  // DO NOT REMOVE. The two markets never mix in one cohort.
  //
  // A recon is an unregistered reconditioned import, priced on import duty
  // rather than local resale. Leaving recons in a USED cohort put RM159,800
  // recon Civics in the base 2022 cohort and pushed the published
  // "questionable above" threshold to RM172,584 against a RM86k median.
  // Approved as a deliberate market-definition decision, 2026-08-09.
  // Guarded by __tests__/lib/performance-variant-contamination.test.ts.
  //
  // The symmetric case was missed for as long: a buyer shopping for a recon
  // got the used cohort with every recon stripped out, which for Lexus RX 2023
  // and Toyota Alphard 2021/2022 emptied the cohort completely and refused the
  // sale. 'recon' keeps exactly the listings 'used' drops.
  // Guarded by __tests__/lib/recon-market-cohort.test.ts.
  const deduped     = excludeDuplicateListings(listings)
  const inMarket    = market === 'recon'
    ? onlyReconImports(deduped)
    : excludeReconImports(deduped)
  const yearMatched = year != null && year !== ''
    ? filterListingsByYear(inMarket, year)
    : inMarket

  if (!isSpecialVariant) {
    // A mainstream car is not comparable to the performance model that shares
    // its name. Runs BEFORE the outlier trim so the trim's own median is
    // computed on comparable cars — otherwise a handful of Type Rs drag the
    // median up and widen the band that is supposed to catch them.
    return assemble(trimListings(excludePerformanceModels(yearMatched)), {
      mode: 'normal', matchBasis: null, variantToken: null, fallback: false, fallbackReason: null,
    })
  }

  const { token, reason } = classifyVariantToken(officialVariant, model)

  // A styling package identified positively: the 1.3x family-floor ratio that
  // set isSpecialVariant was reading a body-style or powertrain premium, not a
  // performance model. Treat it as the mainstream car it is, which also strips
  // the genuine performance models back out of its cohort.
  if (!token && reason === 'package') {
    return assemble(trimListings(excludePerformanceModels(yearMatched)), {
      mode: 'normal', matchBasis: null, variantToken: null,
      fallback: false, fallbackReason: null,
    })
  }

  if (!token) {
    return assemble(trimListings(yearMatched), {
      mode: 'mixed_variants', matchBasis: null, variantToken: null,
      fallback: true, fallbackReason: 'no_variant_token',
    })
  }

  const variantTrimmed = trimListings(matchListingsByVariant(yearMatched, token))
  if (variantTrimmed.length >= minSample) {
    return assemble(variantTrimmed, {
      mode: 'same_variant', matchBasis: 'listing_title', variantToken: token,
      fallback: false, fallbackReason: null,
    })
  }

  return assemble(trimListings(yearMatched), {
    mode: 'mixed_variants', matchBasis: null, variantToken: token,
    fallback: true, fallbackReason: 'insufficient_variant_matches',
  })
}

// ── Public price pages ─────────────────────────────────────────────────────

export interface MarketYearStats {
  year:   string
  min:    number
  max:    number
  median: number
  count:  number
  /**
   * When the cache row backing these listings was scraped. Passed in, never
   * derived: a listing carries no timestamp of its own — every listing in a
   * year shares the one fetched_at on its market_price_cache row.
   */
  fetchedAt: string
}

/**
 * The one gate deciding whether a public page may show a market range for a
 * model-year. Both the year page and the model hub must go through this — they
 * previously each re-implemented the count check and the arithmetic, which is
 * how the hub ended up shipping hand-typed prices no cohort had ever produced.
 *
 * Not evaluateVerdictEligibility: that answers a different question ("may we
 * tell this buyer their asking price is MAHAL"), needs an asking price, and
 * would reject every call made here. The shared piece is the threshold
 * constant, not the policy.
 *
 * Returns null rather than a partial object. A caller that gets a value gets
 * every field — there is no "range but no median" state to render around.
 */
export function buildMarketYearStats(
  listings:  PricedListing[],
  year:      string,
  fetchedAt: string,
): MarketYearStats | null {
  const cohort = buildComparableCohort(listings, { year })

  if (
    cohort.count < MIN_LISTINGS_FOR_VERDICT ||
    cohort.median == null || cohort.min == null || cohort.max == null
  ) {
    return null
  }

  return {
    year,
    min:    cohort.min,
    max:    cohort.max,
    median: cohort.median,
    count:  cohort.count,
    fetchedAt,
  }
}
