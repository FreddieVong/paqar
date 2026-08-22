/**
 * The brand palette, in one place.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Changing the hero colour touched 102 files and 529 literal hex strings, and
 * five tests failed because they had hardcoded the old value independently.
 * Nothing was wrong with any of them individually; there was simply no single
 * place that said what the brand colour IS.
 *
 * Components still write the literal hex, because Tailwind resolves arbitrary
 * values at build time and cannot read a runtime constant. So this is not a
 * substitute for those literals — it is the reference they are checked
 * against, by __tests__/lib/brand-palette, which fails if a component uses a
 * brand-family colour this file does not name.
 *
 * Semantic colours are deliberately absent. Success green, warning amber and
 * error red mean something regardless of what the brand looks like, and
 * folding them in here would invite repainting a warning to match a logo.
 */
export const BRAND = {
  /** The hero. Every primary button, every brand accent. */
  primary: '#3D472F',
  /** Hover and pressed states for anything filled with `primary`. */
  deep: '#2E3523',
  /** Mid-weight accent: section eyebrows, secondary emphasis. */
  mid: '#55663F',
  /** Tinted surface — callouts and panels that belong to the brand. */
  surface: '#F4F6F0',
  /** Border for `surface` panels. */
  border: '#CBD4BB',
} as const

export type BrandColor = typeof BRAND[keyof typeof BRAND]

/** Every brand hex, for scans that need to recognise one. */
export const BRAND_HEXES: readonly string[] = Object.values(BRAND)
