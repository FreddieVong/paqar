import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://paqar.my'
  const now  = new Date('2026-06-23')

  return [
    { url: base,                                                         lastModified: now,                        changeFrequency: 'weekly',  priority: 1.0 },
    // Core product pages
    { url: `${base}/contoh-laporan`,                                     lastModified: now,                        changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/laporan-pembeli-kereta-terpakai`,                    lastModified: now,                        changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/semak-accident-claim-insurans-kereta`,               lastModified: now,                        changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/kira-ansuran-kereta`,                                lastModified: now,                        changeFrequency: 'monthly', priority: 0.9 },
    // Variant decision guides
    { url: `${base}/varian/perodua-myvi`,                                lastModified: now,                        changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/varian/toyota-alphard`,                              lastModified: now,                        changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/varian/perodua-bezza`,                               lastModified: now,                        changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/varian/honda-city`,                                  lastModified: now,                        changeFrequency: 'monthly', priority: 0.85 },
    // Guide hub
    { url: `${base}/panduan`,                                            lastModified: new Date('2025-05-01'),     changeFrequency: 'weekly',  priority: 0.9 },
    // Guide pages
    { url: `${base}/panduan-semak-saman`,                                lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/cara-beli-kereta-terpakai`,                          lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/checklist-beli-kereta-terpakai`,                     lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/risiko-beli-kereta-terpakai`,                        lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-geran-kereta`,                            lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-roadtax-kereta`,                          lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-insurans-kereta`,                         lastModified: new Date('2025-05-01'),     changeFrequency: 'monthly', priority: 0.8 },
    // About / trust
    { url: `${base}/tentang`,                                            lastModified: now,                        changeFrequency: 'yearly',  priority: 0.6 },
    // Legal
    { url: `${base}/privasi`,                                            lastModified: new Date('2025-01-01'),     changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terma`,                                              lastModified: new Date('2025-01-01'),     changeFrequency: 'yearly',  priority: 0.3 },
    // Model price hub
    { url: `${base}/harga-kereta-terpakai`,                              lastModified: now,                        changeFrequency: 'monthly', priority: 0.9 },
    ...['perodua-myvi','perodua-axia','perodua-bezza','proton-saga','toyota-vios','honda-city','perodua-alza','proton-x50','perodua-ativa','honda-jazz','proton-x70','proton-iriz','honda-hrv','nissan-almera'].map(m => ({
      url: `${base}/harga-kereta-terpakai/${m}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85,
    })),
    // Brand hub pages
    { url: `${base}/harga-perodua-terpakai`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-proton-terpakai`,  lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-toyota-terpakai`,  lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-honda-terpakai`,   lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-nissan-terpakai`,  lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    // Year-specific model price pages
    ...[
      ...['2019','2020','2021','2022','2023'].map(y => `myvi-${y}`),
      ...['2020','2021','2022','2023'].map(y => `axia-${y}`),
      ...['2020','2021','2022','2023'].map(y => `bezza-${y}`),
      ...['2021','2022','2023'].map(y => `alza-${y}`),
      ...['2021','2022','2023'].map(y => `ativa-${y}`),
      ...['2019','2020','2021','2022','2023'].map(y => `saga-${y}`),
      ...['2020','2021','2022'].map(y => `persona-${y}`),
      ...['2019','2020','2021'].map(y => `iriz-${y}`),
      ...['2021','2022','2023'].map(y => `x50-${y}`),
      ...['2020','2021','2022'].map(y => `x70-${y}`),
      ...['2021','2022','2023'].map(y => `city-${y}`),
      ...['2020','2021','2022'].map(y => `civic-${y}`),
      ...['2021','2022','2023'].map(y => `hr-v-${y}`),
      ...['2018','2019','2020'].map(y => `jazz-${y}`),
      ...['2020','2021','2022','2023'].map(y => `vios-${y}`),
      ...['2021','2022','2023'].map(y => `yaris-${y}`),
      ...['2021','2022','2023'].map(y => `almera-${y}`),
    ].map(s => ({
      url: `${base}/harga-${s}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.85,
    })),
    // Comparison pages
    { url: `${base}/bandingkan`,             lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...['myvi-vs-axia','myvi-vs-saga','vios-vs-city','bezza-vs-saga','axia-vs-saga','myvi-vs-bezza','alza-vs-x50'].map(s => ({
      url: `${base}/bandingkan/${s}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8,
    })),
  ]
}
