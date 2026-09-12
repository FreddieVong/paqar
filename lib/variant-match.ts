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
 */
const NOT_A_TRIM = new Set([
  'A', 'M', 'AT', 'MT', 'CVT', 'AUTO', 'MANUAL', 'FACELIFT', 'CKD', 'CBU', 'NEW', 'USED',
  'SPEC', 'FULL', 'LOAN', 'TIPTOP', 'TIP', 'TOP', 'WARRANTY', 'ORI', 'ORIGINAL', 'SEDAN', 'HATCHBACK',
])

export function trimWords(text: string): string[] {
  return text.toUpperCase().split(/[^A-Z0-9]+/).filter(w => w && !/^\d/.test(w) && !NOT_A_TRIM.has(w))
}

/** Trim words in the advert that the record does not carry. Empty = match, or nothing to compare. */
export function missingTrimWords(adVariant: string | null | undefined, recordText: string | null | undefined): string[] {
  if (!adVariant || !recordText) return []
  const record = recordText.toUpperCase()
  return trimWords(adVariant).filter(w => !record.includes(w))
}
