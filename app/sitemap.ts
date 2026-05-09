import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://paqar.my'
  const now  = new Date()

  return [
    { url: base,                                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/panduan-semak-saman`,                lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/cara-beli-kereta-terpakai`,          lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/checklist-beli-kereta-terpakai`,     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/risiko-beli-kereta-terpakai`,        lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-geran-kereta`,            lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privasi`,                            lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terma`,                              lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
