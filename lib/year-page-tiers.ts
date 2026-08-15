import { MARKET_COVERAGE } from './market-coverage'

/**
 * Which of the 58 /harga-{model}-{year} pages get investment, and why.
 *
 * WHAT THE EVIDENCE ACTUALLY SAYS (measured 2026-08-14, see
 * docs/seo/GSC-AUDIT-2026-08-14.md):
 *
 *   · All 58 pages hold live cohort data — 6 to 15 comparables each, none
 *     older than 9 days. "Thin data" does not separate them. Every one of them
 *     renders a real price card.
 *   · All 58 average 1.8 internal inbound links, never more than 2, at click
 *     depth 3 from the homepage. Half the sitemap is reachable almost nowhere.
 *   · Search Console puts every year page at average position 27-55, against
 *     8.8-11.6 for /bandingkan/* and /varian/*.
 *   · Of the ad_sessions landing on a content page in the 19 days to
 *     2026-08-14, ZERO started a valuation. The homepage converted 36 of 67
 *     over the same window. The sample is small (18 content sessions) and the
 *     true rate is certainly not exactly zero — but it is far below the
 *     homepage's, and ranking a page that converts near zero multiplies zero.
 *
 * ── WHAT THE TIER DOES AND DOES NOT CONTROL ────────────────────────────────
 *
 * EVERY year page gets the rounded advertised-price band and the truthful
 * insufficient-data state, on identical eligibility rules. The tier controls
 * only the ENHANCED treatment: the model/year-specific qualitative block, the
 * adjacent-year links, the moved CTA and the diagnostic CTA event.
 *
 * For one build the band itself was Tier A only, on the theory that the other
 * 46 pages formed a control group. They do not: different models, different
 * search demand, different page strength and inbound links, no random
 * assignment, and organic volume far too low to separate any of it — and Google
 * re-crawls and re-ranks on independent timelines besides. Withholding a basic
 * price answer from 46 pages bought no causal read and cost each of them the
 * ability to answer the query it ranks for. The 46 are a reference cohort;
 * nothing stronger is claimed for them.
 *
 * So the tier boundary is NOT drawn on traffic, which would be circular: these
 * pages have no traffic to rank by. It is drawn on whether Paqar can actually
 * finish the buyer's journey on that model:
 *
 *   TIER A  the model has all three of a year page, an all-years hub, AND a
 *           variant guide. A buyer can go year -> variant -> free check
 *           without hitting a dead end, and Paqar has enough material to say
 *           something on the page no competitor can copy. Gets the enhanced
 *           treatment.
 *   TIER B  the model has year pages and a hub, but no variant guide. The
 *           journey works; the page has less to say. Band and insufficient-data
 *           state as everywhere; enhanced treatment revisited once the pilot
 *           has a measured result.
 *   TIER C  substantially duplicates another page and costs a buyer nothing to
 *           lose. Deliberately EMPTY — see below.
 *
 * ON TIER C BEING EMPTY. Three models (Persona, Civic, Yaris — 9 pages) have
 * no all-years hub, which makes them the obvious consolidation candidates. They
 * are not in Tier C, and no page is, because every one of them fails the test:
 * "harga civic 2021" is a distinct query with a distinct answer, and there is
 * no other Paqar page a searcher for it could be sent to instead — the hub that
 * would absorb them does not exist. Removing, redirecting or noindexing them
 * would delete a real answer to a real question and gain nothing. A tier that
 * exists in a template is not a reason to put pages in it.
 */

export type YearPageTier = 'A' | 'B' | 'C'

export interface YearPageClassification {
  /** Public slug without the leading `/harga-`, e.g. `myvi-2020`. */
  slug:    string
  yearKey: string
  year:    string
  make:    string
  model:   string
  tier:    YearPageTier
  /** Why this page landed in this tier. Shown in the audit, not to users. */
  reason:  string
}

/**
 * Models promoted to Tier A: those with a hub AND a variant guide.
 *
 * Listed explicitly rather than derived by importing VARIANT_GUIDES, because
 * this file is imported by a statically rendered page and VARIANT_GUIDES is a
 * large module; more importantly, a pilot cohort that silently grows when
 * someone adds a variant guide is not a pilot. Adding a model here is a
 * decision, and __tests__/lib/year-page-tiers.test.ts checks the list still
 * matches the stated rule so it cannot drift unnoticed.
 */
const TIER_A_YEAR_KEYS = ['myvi', 'bezza', 'city'] as const

export function classifyYearPages(): YearPageClassification[] {
  const out: YearPageClassification[] = []
  for (const m of MARKET_COVERAGE) {
    const isTierA = (TIER_A_YEAR_KEYS as readonly string[]).includes(m.yearKey)
    for (const year of m.years) {
      out.push({
        slug:    `${m.yearKey}-${year}`,
        yearKey: m.yearKey,
        year,
        make:    m.make,
        model:   m.model,
        tier:    isTierA ? 'A' : 'B',
        reason:  isTierA
          ? 'hub + variant guide + year data — the full chain from a year query to a check'
          : m.hubSlug
            ? 'hub + year data, no variant guide — journey works, page has less to say'
            : 'year data only, no all-years hub — distinct query, nothing to consolidate into',
      })
    }
  }
  return out
}

/** Tier A pages carry the pilot treatment; everything else renders as before. */
export function isTierAYearPage(yearKey: string): boolean {
  return (TIER_A_YEAR_KEYS as readonly string[]).includes(yearKey)
}

/**
 * Covered years for a model, ascending — the domain for adjacent-year links.
 *
 * Returns only years Paqar actually keeps warm. Linking to an uncovered year
 * would point a buyer at the empty-data fallback, which is worse than not
 * linking at all.
 */
export function coveredYearsFor(yearKey: string): string[] {
  const m = MARKET_COVERAGE.find(c => c.yearKey === yearKey)
  return m ? [...m.years].sort() : []
}

export function adjacentYears(yearKey: string, year: string): { previous: string | null; next: string | null } {
  const years = coveredYearsFor(yearKey)
  const i = years.indexOf(year)
  if (i === -1) return { previous: null, next: null }
  return {
    previous: i > 0 ? years[i - 1]! : null,
    next:     i < years.length - 1 ? years[i + 1]! : null,
  }
}
