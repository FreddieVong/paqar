/**
 * Is this ONE car, or a page full of cars?
 *
 * ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
 *
 * Paqar sells a decision about one specific listing. Nothing checked that the
 * link was one. Paste a Mudah results page for "Honda City 2019" and the
 * pipeline reads Honda / City / 2019 off the URL exactly as designed, asks for
 * an asking price, finds comparables for that model-year, and walks the buyer
 * to RM29 checkout — for a search query. The reviewer then opens a page of
 * forty cars and has nothing to review.
 *
 * The URL-slug parser added for Carlist made this MORE reachable, not less:
 * before it, an unfetchable search URL produced four empty fields and stalled.
 *
 * ── TWO SIGNALS, NOT ONE ───────────────────────────────────────────────────
 *
 * URL shape alone is not enough — portals change their paths, and a dealer
 * site can put anything anywhere. So the HTML is checked too when it could be
 * fetched: a detail page names one car, a results page repeats the listing
 * markup. Either signal is sufficient to refuse; neither is required.
 *
 * Unknown is NOT rejected. A link we cannot classify is treated as a listing,
 * because refusing a real buyer's real advert is a worse failure than a
 * reviewer occasionally opening a search page and issuing a refund.
 */

export type ListingPageKind = 'listing' | 'search'

/**
 * Path segments and query keys that mean "many cars" across the Malaysian
 * portals Paqar sees. Matched on the PATH as words, so a car named
 * "search" — there is none — would still need the segment to stand alone.
 */
const SEARCH_SEGMENTS = [
  'search', 'searches', 'results', 'listings', 'cars-for-sale', 'carlist',
  'browse', 'category', 'categories', 'filter', 'brand', 'brands', 'model-list',
  // Mudah's own taxonomy: /malaysia/cars-for-sale, /selangor/honda-27
  'for-sale', 'all-cars', 'used-cars-for-sale',
]

/** Query keys a results page uses and a detail page never does. */
const SEARCH_QUERY_KEYS = ['q', 'query', 'keyword', 'search', 'page', 'sort', 'filter', 'o']

/**
 * A detail page's path almost always ends in the listing's own id.
 * Mudah: ...-115552872.htm   Carlist: .../18796998
 */
const DETAIL_ID = /(?:-|\/)(\d{6,})(?:\.html?)?$/i

export function classifyListingUrl(rawUrl: string): ListingPageKind | 'unknown' {
  let url: URL
  try { url = new URL(rawUrl) } catch { return 'unknown' }

  // A listing id at the end is the strongest positive signal there is, and it
  // outranks a category word earlier in the path — Carlist detail URLs sit
  // under /recon-cars/ and /used-cars/, which are category segments.
  if (DETAIL_ID.test(url.pathname)) return 'listing'

  const segments = url.pathname.toLowerCase().split('/').filter(Boolean)
  if (segments.some(s => SEARCH_SEGMENTS.includes(s))) return 'search'
  if (SEARCH_QUERY_KEYS.some(k => url.searchParams.has(k))) return 'search'

  return 'unknown'
}

/**
 * How many distinct vehicles the fetched page appears to describe.
 *
 * A results page repeats its listing card markup; a detail page does not. The
 * cheapest reliable proxy is the count of distinct listing-detail links on the
 * page — a results page carries dozens, a detail page carries a handful of
 * "similar car" links at most.
 */
const RESULT_LINK = /href="[^"]*?(?:-|\/)(\d{6,})(?:\.html?)?"/gi
const MANY_LISTINGS = 8

export function classifyListingHtml(html: string): ListingPageKind | 'unknown' {
  if (!html) return 'unknown'
  const ids = new Set<string>()
  for (const m of html.matchAll(RESULT_LINK)) ids.add(m[1]!)
  if (ids.size >= MANY_LISTINGS) return 'search'
  return 'unknown'
}

/**
 * The verdict the intake acts on. 'search' from EITHER signal refuses.
 */
export function isSearchPage(rawUrl: string, html?: string | null): boolean {
  if (classifyListingUrl(rawUrl) === 'search') return true
  if (html && classifyListingHtml(html) === 'search') return true
  return false
}

/** What the buyer is told. Not an error — a redirection to the right input. */
export const SEARCH_PAGE_MESSAGE =
  'Ini halaman carian, bukan satu iklan kereta. Hantar link satu unit tertentu atau screenshot iklan itu.'

/**
 * Shown when a buyer has given Paqar no advert at all — no link it could
 * store, and no screenshot.
 *
 * Says what is missing and both ways to supply it, rather than refusing. The
 * four car details they have already typed are kept; what is absent is the one
 * thing that makes this a specific unit rather than a model.
 */
export const NO_LISTING_MESSAGE =
  'Kami perlukan iklan kereta itu dahulu — tampal link iklan, atau muat naik screenshot. ' +
  'Butiran yang anda isi tadi kekal.'
