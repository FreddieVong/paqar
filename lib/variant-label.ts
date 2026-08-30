// Shortens a full variant name to the trim identifier people actually search
// and cross-shop by.
//
// The title on /varian/[model] previously used `name.split(' ')[0]`, which
// takes the engine displacement rather than the trim. Because most variants in
// a generation share a displacement, titles collapsed into nonsense:
//
//   Myvi    "1.3 vs 1.3 vs 1.5 vs 1.5"   (should be G vs X vs H vs AV)
//   Bezza   "1.0 vs 1.3 vs 1.3"          (should be G vs X vs Advance)
//   Alphard "2.5 vs 2.5 vs 2.5 vs 3.5"   (should be X vs G vs SC vs …)
//
// That wasted the most valuable characters in the title tag on a top-earning
// page type, and matched none of the real queries — Search Console shows
// people searching "beza honda city e dan v", i.e. by trim letter.

export function variantLabel(name: string): string {
  return name
    // "1.3 X" -> "X"; leading engine displacement is not the trim
    .replace(/^\d+\.\d+\s+/, '')
    // "G (Standard)" -> "G"; parenthetical gloss is not the trim
    .replace(/\s*\([^)]*\)/g, '')
    // "Advance / AV" -> "Advance"; keep the first of alternative names
    .split('/')[0]!
    .trim()
}

/**
 * A variant that may override the derived label.
 *
 * WHY AN OVERRIDE IS NEEDED. `variantLabel` keeps the first of two
 * slash-separated names, which is right for "Advance / AV" — one trim with two
 * names — and wrong for "S / E", which is two trims sharing one entry. Nothing
 * in the string distinguishes those cases, so the distinction has to be
 * declared rather than inferred.
 *
 * The real defect: Honda City's newest generation lists "S / E", so the page
 * rendered "S vs V vs RS e:HEV" while its own description recommended "varian
 * E" — a trim the reader could not see in the list. That contradiction shipped
 * in the SERP, on a page averaging position 10.6.
 */
export interface LabelledVariant {
  name:   string
  /** Set only where the derived label would be wrong. See above. */
  label?: string
}

/**
 * Builds the "A vs B vs C" fragment for a generation's variants.
 * Deduplicates, drops empties, and caps the count so the title tag stays
 * within roughly what Google renders.
 */
export function variantLabelListFrom(variants: LabelledVariant[], max = 4): string {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const v of variants) {
    const label = (v.label ?? variantLabel(v.name)).trim()
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    labels.push(label)
    if (labels.length >= max) break
  }
  return labels.join(' vs ')
}

/** Name-only convenience wrapper. Kept for callers with no label to declare. */
export function variantLabelList(names: string[], max = 4): string {
  return variantLabelListFrom(names.map(name => ({ name })), max)
}

/**
 * The engine displacements a generation actually spans, written the way people
 * search them.
 *
 * WHY THIS EXISTS. variantLabel deliberately throws the displacement away,
 * because using it as the trim collapsed titles into "1.3 vs 1.3 vs 1.5". That
 * was the right call for the trim list and the wrong one for the whole title:
 * Search Console shows 80 of the 136 attributed impressions on
 * /varian/perodua-bezza are engine queries — "beza bezza 1.0 dan 1.3",
 * "perbezaan bezza 1.0 dan 1.3", "bezza 1.0 vs 1.3" — and the title named
 * neither number. Trim letters and displacements answer different queries, so
 * the title carries both.
 *
 * Emitted only for a generation spanning EXACTLY two displacements. One means
 * the fragment says nothing and the characters are better spent on trims.
 * Three or more cannot be summarised without implying the middle one is absent,
 * so it is omitted rather than made misleading.
 */
export function displacementPair(variants: LabelledVariant[]): string {
  const seen = new Set<string>()
  for (const v of variants) {
    const m = v.name.match(/^(\d+\.\d+)/)
    if (m) seen.add(m[1]!)
  }
  if (seen.size !== 2) return ''
  return [...seen].sort((a, b) => Number(a) - Number(b)).join(' dan ')
}

/**
 * Roughly what Google renders before it truncates. Not a rule Google enforces
 * — it truncates on pixel width — but a budget tight enough that the terms
 * that matter stay visible on a phone.
 */
const TITLE_BUDGET = 60

/**
 * The title tag for /varian/[model].
 *
 * IT LEADS WITH "BEZA" BECAUSE THAT IS THE QUERY. The previous title was
 * "{Model} Varian Mana Patut Beli? {trims} | Paqar" — a question no one types.
 * Every ranking query on these pages is a difference query: "beza bezza 1.0 dan
 * 1.3" (pos 7.5), "perbezaan bezza 1.0 dan 1.3" (8.4), "beza honda city e dan
 * v" (9.6), "myvi h vs x" (8.5). Four pages held 110-odd page-one impressions
 * over 90 days and took zero clicks, because the one word every searcher typed
 * appeared nowhere in the result. The meta descriptions already opened with
 * "Beza varian ..."; only the titles had not caught up.
 *
 * ASSEMBLY IS BUDGET-AWARE, richest form first, dropping the least valuable
 * segment each time until it fits: the make goes before the displacements, and
 * the displacements before a fourth trim. Alphard is why — "Toyota Alphard 2.5
 * dan 3.5 — X vs G vs SC vs Executive Lounge" is 81 characters, and the trim
 * that has to go is the one nobody cross-shops.
 */
export function variantPageTitle(
  guide: { make: string; model: string; variants: LabelledVariant[] }
): string {
  const { make, model, variants } = guide
  const engines = displacementPair(variants)
  // "Honda" + "City" -> "Honda City"; a model already carrying its make is not
  // given it twice.
  const named = model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`

  const build = (name: string, disp: string, max: number) =>
    ['Beza Varian', name, disp, '—', variantLabelListFrom(variants, max), '| Paqar']
      .filter(Boolean)
      .join(' ')

  const candidates = [
    build(named, engines, 4),
    build(model, engines, 4),
    build(model, engines, 3),
    build(model, '',      3),
    build(model, '',      2),
  ]
  return candidates.find(c => c.length <= TITLE_BUDGET) ?? candidates[candidates.length - 1]!
}
