/**
 * Does the advert's variant match the registration record?
 *
 * One rule, shared by the reviewer's draft (lib/review-draft/issues) and the
 * buyer's Semakan Varian card, so the two never disagree about one advert.
 *
 * Every trim word in the advert's text must appear in the record's text.
 * "Premium" advertised on a car registered PREMIUM passes; "Executive" on
 * that car does not. Single letters count — E / S / V / X / H / G are real
 * Malaysian trims — while engine sizes, transmissions and seller filler are
 * ignored. Labelled, never ranked: this says two texts disagree, not which
 * is higher (that needs a variant guide, which most models lack).
 *
 * Whole words, never substrings: "E" is a trim and also the fourth letter of
 * SEDAN. Hyphens are the one softness: "GR-S" in an advert and "GRS" in the
 * registry are the same trim, so a hyphenated group matches if the record
 * has it joined, and a joined word matches if the record has it hyphenated.
 */
const NOT_A_TRIM = new Set([
  'A', 'M', 'AT', 'MT', 'CVT', 'AUTO', 'MANUAL', 'FACELIFT', 'CKD', 'CBU', 'NEW', 'USED',
  'SPEC', 'FULL', 'LOAN', 'TIPTOP', 'TIP', 'TOP', 'WARRANTY', 'ORI', 'ORIGINAL', 'SEDAN', 'HATCHBACK',
])

const isTrim = (w: string) => w !== '' && !/^\d/.test(w) && !NOT_A_TRIM.has(w)

/** The advert's trim words, hyphenated groups kept whole ("GR-S"), as written in upper case. */
export function trimWords(text: string): string[] {
  return text.toUpperCase().split(/[^A-Z0-9-]+/).map(g => g.replace(/^-+|-+$/g, ''))
    .filter(g => g !== '' && g.split('-').some(isTrim))
}

/** Every word of the record, plus every hyphenated group joined ("GR-S" → GRS) and split. */
function recordWords(text: string): Set<string> {
  const out = new Set<string>()
  for (const g of text.toUpperCase().split(/[^A-Z0-9-]+/)) {
    const group = g.replace(/^-+|-+$/g, '')
    if (!group) continue
    out.add(group)
    out.add(group.replace(/-/g, ''))
    for (const part of group.split('-')) if (part) out.add(part)
  }
  return out
}

/**
 * Trim words in the advert that the record does not carry, as written in the
 * advert. Empty = match, or nothing to compare.
 */
export function missingTrimWords(adVariant: string | null | undefined, recordText: string | null | undefined): string[] {
  if (!adVariant || !recordText) return []
  const record = recordWords(recordText)
  return trimWords(adVariant).filter(group => {
    const parts = group.split('-').filter(isTrim)
    if (record.has(group) || record.has(group.replace(/-/g, ''))) return false
    // Every trim part present on its own also counts ("GR-S" against "GR S").
    return !parts.every(p => record.has(p))
  })
}
