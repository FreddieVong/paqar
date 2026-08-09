// The canonical list of model-hub routes that actually exist at
// /harga-kereta-terpakai/[model].
//
// This exists because three separate places were generating that URL by
// string-concatenating a make and a model name, e.g.
// `${make.toLowerCase()}-${model.toLowerCase()}`. That derivation silently
// produced routes with no page behind them:
//
//   Honda   HR-V    -> 'honda-hr-v'      (real hub is 'honda-hrv')
//   Honda   Civic   -> 'honda-civic'     (no hub exists)
//   Proton  Persona -> 'proton-persona'  (no hub exists)
//   Toyota  Yaris   -> 'toyota-yaris'    (no hub exists)
//
// Every one of those rendered a link — and a JSON-LD breadcrumb — pointing at
// a page that calls notFound(). Typing hub slugs against this list turns that
// class of mistake into a compile error instead of a 404 Google can crawl.
//
// The model-hub page types its MODELS map as Record<ModelHubSlug, ...>, so
// adding a hub without updating this list (or vice versa) fails typecheck.

export const MODEL_HUB_SLUGS = [
  'perodua-myvi',
  'perodua-axia',
  'perodua-bezza',
  'perodua-alza',
  'perodua-ativa',
  'proton-saga',
  'proton-iriz',
  'proton-x50',
  'proton-x70',
  'toyota-vios',
  'honda-city',
  'honda-jazz',
  'honda-hrv',
  'nissan-almera',
] as const

export type ModelHubSlug = (typeof MODEL_HUB_SLUGS)[number]

export function isModelHubSlug(value: string): value is ModelHubSlug {
  return (MODEL_HUB_SLUGS as readonly string[]).includes(value)
}

/**
 * A row on a brand hub page (/harga-{brand}-terpakai).
 *
 * `hubSlug` present  -> the model has an all-years hub; render it as a link.
 * `hubSlug` absent   -> year pages exist but no hub does; render the same row
 *                       unlinked and keep every year chip.
 *
 * Absence means "no hub", which is why this is `hubSlug?: ModelHubSlug` rather
 * than a boolean flag — it names the real route, so there is nothing left to
 * derive and nothing to get wrong.
 */
export type BrandModel = {
  hubSlug?: ModelHubSlug
  model:    string
  /**
   * Key used in the /harga-{yearKey}-{year} year pages, AND the key the live
   * price span is looked up under — it is the yearKey in lib/market-coverage.ts.
   */
  yearKey:  string
  years:    string[]
  tag:      string
}

/**
 * NOTE: there is deliberately no `range` field.
 *
 * Every brand hub and the model index used to carry a hand-typed
 * `range: 'RM33k – RM74k'` per model, rendered as the row's subtitle. Nothing
 * updated them, and by August 2026 all of them overstated the market — Myvi
 * advertised RM33k–RM74k against a real RM25.8k–RM49.8k, Saga RM20k–RM48k
 * against RM13k–RM35.8k. Ranges now come from getCoverageModelSpans() at render
 * time, keyed on `yearKey`, so a figure can only exist where a cohort produced
 * it. Guarded by __tests__/lib/brand-hub-price-claims.test.ts.
 */
