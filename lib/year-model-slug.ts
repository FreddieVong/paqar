// Slug parsing for the /harga-{model}-{year} year pages.
//
// Extracted from app/harga-model/[slug]/page.tsx so the bounds are testable:
// the 58 warm year pages are prerendered, but dynamicParams stays on, so an
// unbounded year would still turn every model into ~10,000 crawlable
// 200-responses (each doing a Supabase query) rendering the same empty
// fallback. Bounding the year keeps the crawlable URL space to roughly what
// the sitemap actually declares.

export const MIN_MODEL_YEAR = 1980

// Model years are announced ahead of the calendar year, so allow one year of
// headroom. This only ever grows, so a URL that was valid never becomes invalid.
export function maxModelYear(now: Date = new Date()): number {
  return now.getFullYear() + 1
}

export function parseSlug(
  slug: string | undefined,
  now: Date = new Date(),
): { modelKey: string; year: string } | null {
  if (!slug) return null
  const m = slug.match(/^(.+)-(\d{4})$/)
  if (!m) return null

  const year = Number(m[2])
  if (year < MIN_MODEL_YEAR || year > maxModelYear(now)) return null

  return { modelKey: m[1]!, year: m[2]! }
}
