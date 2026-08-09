/**
 * Malaysian mobile normalisation for Billplz.
 *
 * Billplz wants digits with country code and rejects anything malformed, so a
 * number is only ever attached when it is confidently valid. A wrong number
 * that blocks a bill is worse than no number: checkout already converts at
 * roughly 1%, and the phone is a follow-up convenience, never a requirement.
 *
 * The rule is a MOBILE-PREFIX rule, not a length rule. Every Malaysian mobile
 * begins 01 (national) / 601 (international); 03, 04, 05… are fixed lines.
 * Checking length alone accepted '03-1234 5678' — ten digits starting with a
 * zero — normalised it to 60312345678, and Billplz answered 422. createBill
 * throws on a non-2xx, initiateBuyerReport catches it, and the buyer was shown
 * "Ralat membuat pembayaran" with no way through: retyping the same landline
 * failed identically. A typo in an optional field could end a sale.
 *
 * This is the first of two guards. The second lives in initiateBuyerReport,
 * which retries the bill without the mobile if Billplz rejects it for any
 * reason this function did not anticipate. Neither alone is enough: a
 * normaliser cannot know every rule Billplz enforces, and a retry alone would
 * mean routinely sending numbers we already know are wrong.
 */

/** 01X (national) — 10 or 11 digits total: 0123456789, 01123456789. */
const NATIONAL        = /^01\d{8,9}$/
/** 601X (international) — 11 or 12 digits total: 60123456789, 601123456789. */
const INTERNATIONAL   = /^601\d{8,9}$/
/** 1X, when the leading zero was dropped — 9 or 10 digits total. */
const NO_LEADING_ZERO = /^1\d{8,9}$/

export function normaliseMyMobile(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // 01X-XXXXXXX  ->  60 1X XXXXXXX
  if (NATIONAL.test(digits))        return `6${digits}`
  // Already 601X…
  if (INTERNATIONAL.test(digits))   return digits
  // Bare 1XXXXXXXX (user dropped the leading zero)
  if (NO_LEADING_ZERO.test(digits)) return `60${digits}`

  return null // unrecognised — send nothing rather than risk the bill
}
