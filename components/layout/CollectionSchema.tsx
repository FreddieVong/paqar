// Shared structured data for hub/index pages that are essentially a curated
// list of links (brand hubs, the model hub, the comparison hub).
//
// These pages sit at priority 0.8–0.9 in the sitemap but shipped with no
// structured data at all, so search engines and LLMs had to infer what they
// were from markup alone. CollectionPage + ItemList states it directly, and
// BreadcrumbList gives the hierarchy.
//
// Server component — emits static <script> tags, no client JS.

export interface CollectionSchemaItem {
  name: string
  url:  string
}

export function CollectionSchema({
  name,
  url,
  description,
  items,
  breadcrumbName,
}: {
  name:        string
  url:         string
  description: string
  items:       CollectionSchemaItem[]
  /** Label for this page in the breadcrumb trail, after "Laman Utama". */
  breadcrumbName: string
}) {
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    description,
    inLanguage: 'ms-MY',
    isPartOf: { '@type': 'WebSite', name: 'Paqar', url: 'https://paqar.my' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url:  item.url,
      })),
    },
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
      { '@type': 'ListItem', position: 2, name: breadcrumbName, item: url },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  )
}
