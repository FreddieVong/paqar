import type { ModelHubSlug } from './model-hubs'

/**
 * The single declaration of which (make, model, year) combinations Paqar keeps
 * warm in market_price_cache — and therefore which year pages have data behind
 * them and which hub rows may be rendered.
 *
 * This exists because the same list lived in FOUR places that had already
 * drifted apart:
 *
 *   app/api/cron/warm-cache/route.ts   the combinations actually scraped daily
 *   scripts/warm-market-cache.ts       a manual copy — had Mazda CX-5, no Honda
 *                                      Jazz, and different Iriz/HR-V years
 *   app/sitemap.ts                     a hand-synced list of year-page slugs
 *   app/harga-kereta-terpakai/[model]  hardcoded priceRows, whose years
 *                                      advertised pages we never warm at all
 *
 * The cron list is the source of truth: it is what genuinely populates the
 * cache, and the sitemap was already in sync with it. The script's copy was the
 * drifted one and has been deleted rather than reconciled.
 *
 * Order is load-bearing. The cron scrapes in this order and the sitemap emits
 * year URLs in this order, so changing it changes both.
 */
export interface CoveredModel {
  /** Cache + scraper key. Stored lowercase in the DB; callers must normalise. */
  make:    string
  /** Cache + scraper key, e.g. 'HR-V'. */
  model:   string
  /** Key used in the /harga-{yearKey}-{year} year pages, e.g. 'hr-v'. */
  yearKey: string
  /**
   * The all-years hub at /harga-kereta-terpakai/{hubSlug}, when one exists.
   *
   * Absent means the model has year pages but no hub — Persona, Civic and
   * Yaris. Typed against ModelHubSlug so a hub that does not render can never
   * be named here; see lib/model-hubs.ts for why that is a compile error.
   */
  hubSlug?: ModelHubSlug
  years:    string[]
}

export const MARKET_COVERAGE: readonly CoveredModel[] = [
  // Perodua — most popular brand in Malaysia
  { make: 'Perodua', model: 'Myvi',    yearKey: 'myvi',    hubSlug: 'perodua-myvi',   years: ['2019', '2020', '2021', '2022', '2023'] },
  { make: 'Perodua', model: 'Axia',    yearKey: 'axia',    hubSlug: 'perodua-axia',   years: ['2020', '2021', '2022', '2023'] },
  { make: 'Perodua', model: 'Bezza',   yearKey: 'bezza',   hubSlug: 'perodua-bezza',  years: ['2020', '2021', '2022', '2023'] },
  { make: 'Perodua', model: 'Alza',    yearKey: 'alza',    hubSlug: 'perodua-alza',   years: ['2021', '2022', '2023'] },
  { make: 'Perodua', model: 'Ativa',   yearKey: 'ativa',   hubSlug: 'perodua-ativa',  years: ['2021', '2022', '2023'] },
  // Proton
  { make: 'Proton',  model: 'Saga',    yearKey: 'saga',    hubSlug: 'proton-saga',    years: ['2019', '2020', '2021', '2022', '2023'] },
  { make: 'Proton',  model: 'Persona', yearKey: 'persona',                            years: ['2020', '2021', '2022'] },
  { make: 'Proton',  model: 'Iriz',    yearKey: 'iriz',    hubSlug: 'proton-iriz',    years: ['2019', '2020', '2021'] },
  { make: 'Proton',  model: 'X50',     yearKey: 'x50',     hubSlug: 'proton-x50',     years: ['2021', '2022', '2023'] },
  { make: 'Proton',  model: 'X70',     yearKey: 'x70',     hubSlug: 'proton-x70',     years: ['2020', '2021', '2022'] },
  // Honda
  { make: 'Honda',   model: 'City',    yearKey: 'city',    hubSlug: 'honda-city',     years: ['2021', '2022', '2023'] },
  { make: 'Honda',   model: 'Civic',   yearKey: 'civic',                              years: ['2020', '2021', '2022'] },
  { make: 'Honda',   model: 'HR-V',    yearKey: 'hr-v',    hubSlug: 'honda-hrv',      years: ['2021', '2022', '2023'] },
  { make: 'Honda',   model: 'Jazz',    yearKey: 'jazz',    hubSlug: 'honda-jazz',     years: ['2018', '2019', '2020'] },
  // Toyota
  { make: 'Toyota',  model: 'Vios',    yearKey: 'vios',    hubSlug: 'toyota-vios',    years: ['2020', '2021', '2022', '2023'] },
  { make: 'Toyota',  model: 'Yaris',   yearKey: 'yaris',                              years: ['2021', '2022', '2023'] },
  // Nissan
  { make: 'Nissan',  model: 'Almera',  yearKey: 'almera',  hubSlug: 'nissan-almera',  years: ['2021', '2022', '2023'] },
]

/**
 * The coverage entry behind a model hub, or undefined when the slug has none.
 *
 * Hub pages must read `make`/`model` from here rather than from their own
 * display config: these are the exact strings the cron writes cache rows under,
 * so sourcing them anywhere else reintroduces the drift this module exists to
 * remove.
 */
export function coveredModelByHub(hubSlug: ModelHubSlug): CoveredModel | undefined {
  return MARKET_COVERAGE.find(m => m.hubSlug === hubSlug)
}

/**
 * Years we keep warm for a model hub. Empty for a slug with no coverage, which
 * the hub page must render as its "data sedang dikemaskini" fallback rather
 * than an empty table.
 */
export function coveredYears(hubSlug: ModelHubSlug): string[] {
  return coveredModelByHub(hubSlug)?.years ?? []
}

/**
 * Years both models are kept warm for, in ascending order.
 *
 * A comparison table can only compare a year where BOTH sides have evidence —
 * a row with one column filled is not a comparison, it is a price claim with a
 * blank next to it. Returns [] when either slug has no coverage, which the
 * comparison page renders as its "data sedang dikemaskini" fallback.
 */
export function sharedCoveredYears(a: ModelHubSlug, b: ModelHubSlug): string[] {
  const yearsB = new Set(coveredYears(b))
  return coveredYears(a).filter(y => yearsB.has(y)).sort()
}

/** Flattened scrape queue, in declaration order. */
export function coveredCombos(): { make: string; model: string; year: string }[] {
  return MARKET_COVERAGE.flatMap(({ make, model, years }) =>
    years.map(year => ({ make, model, year })),
  )
}

/** Year-page slugs for the sitemap: 'myvi-2019', 'hr-v-2023', … */
export function coveredYearSlugs(): string[] {
  return MARKET_COVERAGE.flatMap(({ yearKey, years }) =>
    years.map(year => `${yearKey}-${year}`),
  )
}
