import type { MetadataRoute } from 'next'
import { coveredYearSlugs }   from '@/lib/market-coverage'
import { MODEL_HUB_SLUGS }    from '@/lib/model-hubs'
import { lastModified }      from '@/lib/seo/editorial-dates'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://paqar.my'

  /**
   * Editorial pages: the date the copy was last written. Curated on purpose —
   * an always-current lastModified on static prose is a claim Google learns to
   * discount, and then ignores on the pages where it is true.
   *
   * This is now only the FALLBACK. Every entry runs through `at()`, which
   * prefers the page's real revision date from lib/seo/editorial-dates when it
   * has one — the same date its Article node publishes as `dateModified`, so
   * the sitemap and the page cannot tell a crawler two different stories.
   *
   * Curation was right and incomplete: freezing everything at one date stopped
   * the "everything changed today" lie, but it also meant that when eight
   * /faq/* guides really were rewritten — an invented JPJ fee table removed, a
   * Honda variant that never existed removed — the sitemap still said
   * 2026-06-23 for all of them. That is the one moment a truthful lastModified
   * is worth having, and it was spent.
   */
  const now  = new Date('2026-06-23')

  /** Real revision date if the page has one, else the curated default. */
  const at = (path: string, fallback: Date = now) => lastModified(path, fallback)

  /**
   * Market pages: generated at build time from market_price_cache, which the
   * warm-cache cron refreshes daily, and re-rendered hourly by ISR. These are
   * declared changeFrequency 'weekly' and their content genuinely does change,
   * so `now` — frozen at 2026-06-23 while the data moved on for weeks — was
   * simply false. Build time is the honest answer: it is when the figures on
   * the page were last produced.
   */
  const marketPagesBuiltAt = new Date()

  return [
    { url: base,                                           lastModified: at('/'),                                                       changeFrequency: 'weekly',  priority: 1.0 },
    // Core product pages
    { url: `${base}/contoh-laporan`,                       lastModified: at('/contoh-laporan'),                                         changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/laporan-pembeli-kereta-terpakai`,      lastModified: at('/laporan-pembeli-kereta-terpakai'),                        changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/semak-accident-claim-insurans-kereta`, lastModified: at('/semak-accident-claim-insurans-kereta'),                   changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/kira-ansuran-kereta`,                  lastModified: at('/kira-ansuran-kereta'),                                    changeFrequency: 'monthly', priority: 0.9 },
    // Variant decision guides
    { url: `${base}/varian/perodua-myvi`,                  lastModified: at('/varian/perodua-myvi'),                                    changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/varian/toyota-alphard`,                lastModified: at('/varian/toyota-alphard'),                                  changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/varian/perodua-bezza`,                 lastModified: at('/varian/perodua-bezza'),                                   changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/varian/honda-city`,                    lastModified: at('/varian/honda-city'),                                      changeFrequency: 'monthly', priority: 0.85 },
    // Guide hub
    { url: `${base}/panduan`,                              lastModified: at('/panduan', new Date('2025-05-01')),                        changeFrequency: 'weekly',  priority: 0.9 },
    // Guide pages
    { url: `${base}/panduan-semak-saman`,                  lastModified: at('/panduan-semak-saman', new Date('2025-05-01')),            changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/cara-beli-kereta-terpakai`,            lastModified: at('/cara-beli-kereta-terpakai', new Date('2025-05-01')),      changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/checklist-beli-kereta-terpakai`,       lastModified: at('/checklist-beli-kereta-terpakai', new Date('2025-05-01')), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/risiko-beli-kereta-terpakai`,          lastModified: at('/risiko-beli-kereta-terpakai', new Date('2025-05-01')),    changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-geran-kereta`,              lastModified: at('/cara-semak-geran-kereta', new Date('2025-05-01')),        changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-roadtax-kereta`,            lastModified: at('/cara-semak-roadtax-kereta', new Date('2025-05-01')),      changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/cara-semak-insurans-kereta`,           lastModified: at('/cara-semak-insurans-kereta', new Date('2025-05-01')),     changeFrequency: 'monthly', priority: 0.8 },
    // About / trust
    { url: `${base}/tentang`,                              lastModified: at('/tentang'),                                                changeFrequency: 'yearly',  priority: 0.6 },
    // Public API documentation (citable surface for AI assistants)
    { url: `${base}/api-docs`,                             lastModified: at('/api-docs'),                                               changeFrequency: 'monthly', priority: 0.7 },
    // FAQ hub — the only internal path into the /faq/* guides
    { url: `${base}/faq`,                                  lastModified: at('/faq'),                                                    changeFrequency: 'monthly', priority: 0.8 },
    // Legal
    { url: `${base}/privasi`,                              lastModified: at('/privasi', new Date('2025-01-01')),                        changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terma`,                                lastModified: at('/terma', new Date('2025-01-01')),                          changeFrequency: 'yearly',  priority: 0.3 },
    // Model price hub
    { url: `${base}/harga-kereta-terpakai`,                lastModified: at('/harga-kereta-terpakai'),                                  changeFrequency: 'monthly', priority: 0.9 },
    // Read from the same list the hub route types its MODELS map against, so a
    // hub can never be advertised here without a page behind it — and a new hub
    // is never forgotten. The hand-typed copy this replaces was correct, but it
    // was the fourth hand-synced list in a file that has already shipped one
    // drift bug.
    ...MODEL_HUB_SLUGS.map(m => ({
      url: `${base}/harga-kereta-terpakai/${m}`, lastModified: marketPagesBuiltAt, changeFrequency: 'monthly' as const, priority: 0.85,
    })),
    // Brand hub pages
    { url: `${base}/harga-perodua-terpakai`,               lastModified: at('/harga-perodua-terpakai'),                                 changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-proton-terpakai`,                lastModified: at('/harga-proton-terpakai'),                                  changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-toyota-terpakai`,                lastModified: at('/harga-toyota-terpakai'),                                  changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-honda-terpakai`,                 lastModified: at('/harga-honda-terpakai'),                                   changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/harga-nissan-terpakai`,                lastModified: at('/harga-nissan-terpakai'),                                  changeFrequency: 'monthly', priority: 0.85 },
    // Year-specific model price pages — derived from the one coverage
    // declaration the warm-cache cron scrapes from, so this list can never
    // advertise a year page whose cache row is never populated.
    ...coveredYearSlugs().map(s => ({
      url: `${base}/harga-${s}`, lastModified: marketPagesBuiltAt, changeFrequency: 'weekly' as const, priority: 0.85,
    })),
    // Comparison pages
    { url: `${base}/bandingkan`,                           lastModified: at('/bandingkan'),                                             changeFrequency: 'monthly', priority: 0.8 },
    ...['myvi-vs-axia','myvi-vs-saga','vios-vs-city','bezza-vs-saga','axia-vs-saga','myvi-vs-bezza','alza-vs-x50'].map(s => ({
      url: `${base}/bandingkan/${s}`, lastModified: at(`/bandingkan/${s}`), changeFrequency: 'monthly' as const, priority: 0.8,
    })),
    // FAQ pages
    ...['best-first-car-under-30k','honda-city-buying-guide','honda-city-vs-toyota-vios','how-to-negotiate-used-car','how-to-spot-flood-cars','roadtax-by-state','toyota-vios-buying-guide','what-to-check-buying-used-car'].map(s => ({
      url: `${base}/faq/${s}`, lastModified: at(`/faq/${s}`), changeFrequency: 'monthly' as const, priority: 0.8,
    })),
  ]
}
