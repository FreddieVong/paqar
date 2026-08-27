import { organizationRef, SITE_URL } from '@/lib/site'
import { articleDates } from '@/lib/seo/editorial-dates'

/**
 * The structured data for a /faq/* buyer guide, built once for all eight.
 *
 * ── WHAT THEY WERE MISSING ─────────────────────────────────────────────────
 *
 * Each guide emitted a bare FAQPage and nothing else. Three consequences, all
 * of them costing the guides visibility they had already earned:
 *
 *   NO BreadcrumbList. Sixteen exist elsewhere on the site; the guides — the
 *   pages furthest from the root, and the ones a crawler most needs placed —
 *   had none, so a result for one showed no path back to /faq or to Paqar.
 *
 *   NO Article. Which meant no `datePublished`, and more importantly no
 *   `dateModified`. All eight were fact-corrected on 2026-08-27 — an invented
 *   per-state JPJ fee table removed, a Honda City variant that never existed
 *   removed, a City-vs-Vios resale contradiction resolved — and nothing on the
 *   page said so. A substantial correction that goes unannounced is a ranking
 *   signal thrown away, and here it is also simply true.
 *
 *   NO stated URL or language. A FAQPage floating free of the page it belongs
 *   to is harder to attribute than one anchored to it.
 *
 * ── WHY A HELPER ───────────────────────────────────────────────────────────
 *
 * Eight files would otherwise each carry their own copy of the graph, and the
 * guides have already been through one round of exactly that: they diverged
 * from Paqar's own variant guide about the same cars because the same facts
 * were written twice. `mainEntity` stays at the call site because the answers
 * are specific to each page and must correspond to content that page actually
 * renders — everything around it is identical by definition, so it lives here.
 */

export interface GuideSchemaInput {
  /** Route path with a leading slash, e.g. `/faq/roadtax-by-state`. */
  path:          string
  /** Breadcrumb label — short, the page's name rather than its title tag. */
  name:          string
  headline:      string
  description:   string
  /** When the guide first went live. From git, not from memory. */
  datePublished: string
  /**
   * The FAQPage entries. Every one must be answerable from what the page
   * renders — structured data that answers something the page does not is a
   * policy violation, not a shortcut.
   */
  mainEntity:    readonly unknown[]
}

export function guideSchema(input: GuideSchemaInput): Record<string, unknown> {
  const url = `${SITE_URL}${input.path}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama',  item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Soalan Lazim', item: `${SITE_URL}/faq` },
          { '@type': 'ListItem', position: 3, name: input.name,     item: url },
        ],
      },
      {
        '@type':     'Article',
        headline:    input.headline,
        description: input.description,
        author:      organizationRef(),
        publisher:   organizationRef(),
        ...articleDates(input.path, input.datePublished),
        inLanguage:  'ms-MY',
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      },
      {
        '@type': 'FAQPage',
        url,
        inLanguage: 'ms-MY',
        mainEntity: input.mainEntity,
      },
    ],
  }
}
