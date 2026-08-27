/**
 * When each editorial page's copy was last substantively revised.
 *
 * ── WHY A MAP AND NOT `new Date()` ─────────────────────────────────────────
 *
 * app/sitemap.ts already knew half of this: it froze editorial pages at one
 * curated date rather than stamping them `now`, because "everything changed
 * today, every day" is a claim Google learns to discount and then ignores on
 * the pages where it is true. What it could not do was tell the pages APART.
 * Eight /faq/* guides were rewritten on 2026-08-27 — a per-state JPJ fee table
 * removed, a Honda variant that never existed removed, a resale contradiction
 * resolved — and the sitemap went on declaring 2026-06-23 for them, which is
 * the one moment a real lastModified was worth having.
 *
 * ── WHY IT IS SHARED ───────────────────────────────────────────────────────
 *
 * The same fact is asserted in two places a crawler reads: `lastModified` in
 * the sitemap, and `dateModified` on the page's Article node. Typed twice they
 * drift, and a sitemap that disagrees with the page it points at is worse than
 * either date alone. So both read this.
 *
 * ── HOW TO MAINTAIN IT ─────────────────────────────────────────────────────
 *
 * Update the entry in the SAME commit that changes the page's copy. The date
 * is the commit's date, which `git log -1 --format=%as -- <file>` will tell
 * you. Only substantive revisions count: a Tailwind class or a typo is not a
 * reason to ask 116 URLs to be recrawled. A page with no entry keeps the
 * sitemap's curated default, which is the honest answer for prose nobody has
 * touched.
 */

/** Route path → ISO date (YYYY-MM-DD) of the last substantive copy revision. */
export const PAGE_REVISED: Readonly<Record<string, string>> = {
  // 7e849ba — "eight live pages sold a retired product and invented a JPJ fee
  // table". Every /faq/* guide was fact-corrected and re-pointed.
  '/faq':                                  '2026-08-27',
  '/faq/best-first-car-under-30k':         '2026-08-27',
  '/faq/honda-city-buying-guide':          '2026-08-27',
  '/faq/honda-city-vs-toyota-vios':        '2026-08-27',
  '/faq/how-to-negotiate-used-car':        '2026-08-27',
  '/faq/how-to-spot-flood-cars':           '2026-08-27',
  '/faq/roadtax-by-state':                 '2026-08-27',
  '/faq/toyota-vios-buying-guide':         '2026-08-27',
  '/faq/what-to-check-buying-used-car':    '2026-08-27',

  // 82a2470 — repositioned away from "Alat Pembeli Kereta Terpakai" toward the
  // human-reviewed decision, and the stale RM12 Offer replaced.
  '/laporan-pembeli-kereta-terpakai':      '2026-08-27',
  // 48db898 / 425dc27 — the add-on left the checkout, and this page's RM100
  // Offer became the derived total.
  '/semak-accident-claim-insurans-kereta': '2026-08-27',

  // af3da50 / b1dc4a8 — TENTEC SDN BHD named as operator and data controller.
  '/tentang':                              '2026-08-27',
  '/terma':                                '2026-08-27',
  '/privasi':                              '2026-08-27',

  '/cara-beli-kereta-terpakai':            '2026-08-23',
  '/checklist-beli-kereta-terpakai':       '2026-08-23',
  '/risiko-beli-kereta-terpakai':          '2026-08-23',
  '/panduan-semak-saman':                  '2026-08-23',
  '/cara-semak-insurans-kereta':           '2026-08-24',
}

/** ISO date for a page's `dateModified`, or null when it has not been revised. */
export function revisedOn(path: string): string | null {
  return PAGE_REVISED[path] ?? null
}

/**
 * `lastModified` for the sitemap: the revision date when there is one, and the
 * caller's curated default when there is not.
 */
export function lastModified(path: string, fallback: Date): Date {
  const revised = PAGE_REVISED[path]
  return revised ? new Date(revised) : fallback
}

/**
 * The two dates an Article node should carry, with `dateModified` present only
 * when the page has genuinely been revised.
 *
 * `datePublished` stays at the call site, beside the page it describes;
 * `dateModified` comes from the map above so it cannot disagree with the
 * sitemap. Emitting `dateModified` equal to `datePublished` on a page nobody
 * has touched would be a revision claim with no revision behind it, which is
 * the failure mode this whole module exists to avoid.
 */
export function articleDates(
  path: string,
  datePublished: string,
): { datePublished: string; dateModified?: string } {
  const dateModified = PAGE_REVISED[path]
  return dateModified ? { datePublished, dateModified } : { datePublished }
}
