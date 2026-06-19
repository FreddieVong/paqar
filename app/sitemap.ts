import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://paqar.my'

  return [
    { url: base,                                          lastModified: new Date('2025-06-01'), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/panduan`,                            lastModified: new Date('2025-05-01'), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/panduan-semak-saman`,                lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/cara-beli-kereta-terpakai`,          lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/checklist-beli-kereta-terpakai`,     lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/risiko-beli-kereta-terpakai`,        lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-geran-kereta`,            lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-roadtax-kereta`,          lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-insurans-kereta`,         lastModified: new Date('2025-05-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privasi`,                            lastModified: new Date('2025-01-01'), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terma`,                              lastModified: new Date('2025-01-01'), changeFrequency: 'yearly',  priority: 0.3 },
    // Model price pages
    { url: `${base}/harga-kereta-terpakai`,              lastModified: new Date('2025-06-19'), changeFrequency: 'monthly', priority: 0.9 },
    ...['perodua-myvi','perodua-axia','perodua-bezza','proton-saga','toyota-vios','honda-city','perodua-alza','proton-x50'].map(m => ({
      url: `${base}/harga-kereta-terpakai/${m}`, lastModified: new Date('2025-06-19'), changeFrequency: 'monthly' as const, priority: 0.85,
    })),
    // Brand hub pages
    { url: `${base}/harga-perodua-terpakai`, lastModified: new Date('2025-06-19'), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-proton-terpakai`,  lastModified: new Date('2025-06-19'), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-toyota-terpakai`,  lastModified: new Date('2025-06-19'), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-honda-terpakai`,   lastModified: new Date('2025-06-19'), changeFrequency: 'monthly', priority: 0.85 },
    // Comparison pages
    { url: `${base}/bandingkan`,             lastModified: new Date('2025-06-19'), changeFrequency: 'monthly', priority: 0.8 },
    ...['myvi-vs-axia','vios-vs-city','bezza-vs-saga','alza-vs-x50'].map(s => ({
      url: `${base}/bandingkan/${s}`, lastModified: new Date('2025-06-19'), changeFrequency: 'monthly' as const, priority: 0.8,
    })),
  ]
}
