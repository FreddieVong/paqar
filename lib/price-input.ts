/**
 * Asking-price input: readable on screen, unchanged on the wire.
 *
 * WHY THIS EXISTS
 *
 * Four forms ask for the seller's asking price, and all four used
 * `type="number"`, which cannot show thousands separators. `59000` and `590000`
 * differ by one glyph in a field a buyer fills once, on a phone, in a hurry.
 * Formatting the display fixes that.
 *
 * THE RULE THAT MAKES IT SAFE
 *
 * State stays DIGIT-ONLY. Only the rendered value is formatted. Three call
 * sites break silently otherwise, and none of them would fail a type check:
 *
 *   - `parseInt(askingPrice, 10)` — parseInt('59,000') is 59, not 59000;
 *   - `params.set('asking_price', askingPrice)` — the raw string enters the URL
 *     and is re-parsed by the page that receives it;
 *   - `submissionAttemptId(\`…|${askingPrice}\`)` — the idempotency key is
 *     derived from the string, so a formatting change silently re-keys retries.
 *
 * So `toDigits` runs on the way IN (typing, pasting) and `formatPriceInput`
 * runs only on the way OUT (rendering). The value posted to the API is byte-for
 * byte what it was before this module existed.
 */

/**
 * Strip everything that is not a digit.
 *
 * Accepts what a buyer actually pastes out of an advert: `59000`, `59,000`,
 * `RM 59,000`, `RM59k` → `59`, which then fails the existing range check rather
 * than silently becoming a wrong number. Leading zeros are dropped so `059000`
 * and `59000` produce one canonical string, keeping the idempotency key stable.
 */
export function toDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  return digits
}

/**
 * Render digits with thousands separators. Empty in, empty out — so a cleared
 * field shows the placeholder rather than "0".
 */
export function formatPriceInput(digits: string): string {
  if (!digits) return ''
  return Number(digits).toLocaleString('en-MY')
}

/**
 * The canonical numeric value, or null when the field cannot yield one.
 *
 * Callers keep their own range checks — this only answers "is there a number
 * here at all", so no validation rule moves out of the form that owns it.
 */
export function parsePriceInput(raw: string): number | null {
  const digits = toDigits(raw)
  if (!digits) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}
