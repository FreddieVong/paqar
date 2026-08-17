/**
 * Keeps a meta description inside what Google actually renders.
 *
 * Google shows roughly 155-160 characters on desktop and less on mobile,
 * then cuts with an ellipsis of its own. Anything past that is invisible, so
 * the useful budget is the first ~155 characters and the words spent beyond
 * it are wasted.
 *
 * Measured on production 2026-08-14: /varian/* descriptions ran 238-284
 * characters, so between a third and a half of each was never displayed —
 * including, on every one of them, the trailing generic clause. Those are
 * pages that rank (average position 10.6-11.6) and convert poorly (0-3.5%
 * CTR), which is where the visible snippet matters most.
 *
 * Cuts on a sentence boundary when one falls in the back half of the budget,
 * otherwise on a word boundary. Never mid-word, and never leaves dangling
 * punctuation. Adds no ellipsis — Google supplies its own, and ours would
 * only consume budget.
 */
export const META_DESCRIPTION_MAX = 155

export function clampMetaDescription(text: string, max: number = META_DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean

  const window = clean.slice(0, max + 1)

  // Prefer a full sentence, but only if it keeps most of the budget — cutting
  // at the first full stop of a long description would throw away the answer.
  const lastStop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  if (lastStop >= Math.floor(max * 0.6)) {
    return clean.slice(0, lastStop + 1).trim()
  }

  const lastSpace = window.lastIndexOf(' ')
  const cut = lastSpace > 0 ? window.slice(0, lastSpace) : clean.slice(0, max)
  return cut.replace(/[\s,;:—–-]+$/, '').trim()
}
