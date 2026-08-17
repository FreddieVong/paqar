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
