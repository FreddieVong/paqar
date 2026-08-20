/**
 * May a cached listing URL be offered to a buyer as a link to ONE advert?
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The RM12 report renders each comparable price as a link, on the assumption
 * that every cached row points at the advert its price came from. It does not.
 * scraper/src/scrapers/mudah-market.ts reaches the cache by two paths, and both
 * leak URLs that identify no single advert:
 *
 *   JSON path   `https://www.mudah.my/m/${i?.adid ?? ''}` — an item carrying no
 *               adid interpolates to the literal "https://www.mudah.my/m/",
 *               a URL that identifies nothing.
 *   DOM path    walks every <a href> on the results page and keeps any link
 *               whose surrounding card mentions a price, so search pages,
 *               category pages and promo links arrive looking like listings.
 *
 * Sending a paying buyer to a search page, in the section that tells them which
 * adverts set the price, is the precise failure the paid report exists to
 * prevent. So the report asks this module first and renders a plain price when
 * the answer is no.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 *
 * It does not repair, rewrite or invent a URL. There is no correct advert to
 * guess at — a row whose URL was a category page never carried an advert
 * identity to begin with — and fabricating one would turn a missing link into a
 * wrong link, which is worse. The price still renders either way: these rows are
 * real adverts with real prices and they are counted in the median above, so
 * withholding the price would leave the methodology line describing a set the
 * buyer cannot see.
 *
 * It is also not a general URL parser. It answers one question about the two
 * identity-bearing shapes this repository's own scraper produces, and anything
 * else — another host, another path, a malformed string — is declined rather
 * than guessed at.
 *
 * ── FUTURE NOTE ────────────────────────────────────────────────────────────
 *
 * feat/lower-priced-comparable-count carries a resolveListingIdentity() that
 * extracts the same ad id for a different purpose (telling two cached rows
 * apart, so a count cannot double-count one advert). When that branch lands,
 * resolveListingIdentity should be rewritten over mudahAdId below rather than
 * keeping a second copy of these two regexes — two patterns held in step by
 * hand is exactly how they drift.
 */

/**
 * The Mudah ad id in this URL, or null when it carries none.
 *
 * The pipeline produces exactly two identity-bearing shapes:
 *
 *   mudah.my/<slug>-<adid>.htm   the ad's own url, from the JSON API path and
 *                                from the DOM fallback
 *   mudah.my/m/<adid>            constructed when a JSON item carries an adid
 *                                but no url of its own
 *
 * Anchored on ".htm" so a lazy slug match cannot run past the ad id, and
 * stopped at ? and # so a tracking query string is never read as part of the
 * path. Six digits is the observed floor for a Mudah ad id; a shorter run of
 * digits is something else in the slug, and declining is the safe answer.
 */
function mudahAdId(url: string): string | null {
  const page  = url.match(/mudah\.my\/[^?#]*?-(\d{6,})\.htm/i)?.[1]
  const short = url.match(/mudah\.my\/m\/(\d{6,})(?!\d)/i)?.[1]
  return page ?? short ?? null
}

/** True only when a click will land on the individual advert this price came from. */
export function isIndividualListingUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || url === '') return false
  return mudahAdId(url) !== null
}
