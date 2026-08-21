import type { ModelHubSlug } from './model-hubs'

/**
 * Contextual links from a model page to the long-form guide about that model.
 *
 * WHY THIS FILE EXISTS. Measured 2026-08-14 with scripts/link-graph.mjs: five
 * of the eight /faq/* guides had ZERO editorial inbound links. The only route
 * to any of them was the /faq index, itself two clicks from the homepage, so
 * the guides sat at depth 3 reachable by one path. Paqar had written a Honda
 * City buying guide and a Vios-vs-City comparison and then linked them from
 * nowhere a buyer researching a City or a Vios would ever be.
 *
 * WHAT THIS FILE IS NOT. It is not a fix for the orphan count. Every entry
 * below is a link a buyer on that page would plausibly want next — a City
 * shopper wants the City buying guide; someone comparing Vios and City wants
 * the page comparing Vios and City. Guides with no such home stay unlinked
 * rather than being scattered across unrelated pages to move a number. That is
 * the line between internal linking and a link farm, and it is why this is a
 * short hand-written map instead of a rule that emits a link for every page.
 *
 * Anchors are the guide's own proposition in Malay, not "klik di sini" and not
 * a repeated exact-match keyword.
 */

export interface RelatedGuide {
  href:  string
  label: string
}

const CITY_VS_VIOS: RelatedGuide = {
  href:  '/faq/honda-city-vs-toyota-vios',
  label: 'Honda City vs Toyota Vios — mana satu patut beli?',
}

/**
 * Under-RM30k claim check: Axia's cohort medians run RM24k-34k and Saga's
 * RM18k-25k on 2026-08-14 data, so both genuinely sit in that guide's bracket.
 * Models whose medians are above it are deliberately absent — sending a buyer
 * looking at a RM60k City to a "best first car under RM30k" guide would be a
 * link that helps no one.
 */
const FIRST_CAR: RelatedGuide = {
  href:  '/faq/best-first-car-under-30k',
  label: 'Kereta pertama terbaik bawah RM30k di Malaysia',
}

export const MODEL_HUB_GUIDES: Partial<Record<ModelHubSlug, RelatedGuide[]>> = {
  'honda-city': [
    { href: '/faq/honda-city-buying-guide', label: 'Panduan beli Honda City terpakai — tahun dan varian mana' },
    CITY_VS_VIOS,
  ],
  'toyota-vios': [
    { href: '/faq/toyota-vios-buying-guide', label: 'Panduan beli Toyota Vios terpakai — tahun dan harga terbaik' },
    CITY_VS_VIOS,
  ],
  'perodua-axia': [FIRST_CAR],
  'proton-saga':  [FIRST_CAR],
}

/** Keyed by /bandingkan/[slug]. Only where a guide covers the same two cars. */
export const COMPARISON_GUIDES: Record<string, RelatedGuide[]> = {
  'vios-vs-city': [CITY_VS_VIOS],
}

/**
 * Takes a plain string: the caller has a route param, and the useful type
 * safety is on MODEL_HUB_GUIDES above, where a mistyped hub slug is a compile
 * error. An unknown slug here simply has no guides.
 */
export function guidesForModelHub(slug: string): RelatedGuide[] {
  return MODEL_HUB_GUIDES[slug as ModelHubSlug] ?? []
}

export function guidesForComparison(slug: string): RelatedGuide[] {
  return COMPARISON_GUIDES[slug] ?? []
}
