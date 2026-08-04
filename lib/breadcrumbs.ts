import type { ModelHubSlug } from '@/lib/model-hubs'

export type BreadcrumbEntry = { name: string; item: string }

/**
 * Builds a schema.org BreadcrumbList, numbering positions from the entries
 * that actually survive.
 *
 * The numbering is the point. The year pages previously hardcoded positions
 * 1..4 with position 3 always pointing at `/harga-kereta-terpakai/{derived}`.
 * For Civic, Persona, Yaris and HR-V that URL 404s, so the trail advertised a
 * page that does not exist. Dropping the entry but keeping literal positions
 * would emit 1,2,4 — also invalid. Numbering after filtering makes both
 * failure modes unrepresentable.
 */
export function buildBreadcrumbList(entries: (BreadcrumbEntry | null | false | undefined)[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: entries
      .filter((e): e is BreadcrumbEntry => Boolean(e))
      .map((entry, i) => ({
        '@type':  'ListItem',
        position: i + 1,
        name:     entry.name,
        item:     entry.item,
      })),
  }
}

/**
 * The breadcrumb trail for a /harga-{model}-{year} page.
 *
 * Includes the all-years model hub only when one exists; otherwise the year
 * page follows the model index directly.
 */
export function modelYearBreadcrumbs({
  displayModel,
  year,
  slug,
  hubSlug,
}: {
  displayModel: string
  year:         number | string
  slug:         string
  hubSlug?:     ModelHubSlug
}) {
  return buildBreadcrumbList([
    { name: 'Laman Utama',           item: 'https://paqar.my' },
    { name: 'Harga Kereta Terpakai', item: 'https://paqar.my/harga-kereta-terpakai' },
    hubSlug ? { name: displayModel, item: `https://paqar.my/harga-kereta-terpakai/${hubSlug}` } : null,
    { name: `${displayModel} ${year}`, item: `https://paqar.my/harga-${slug}` },
  ])
}
