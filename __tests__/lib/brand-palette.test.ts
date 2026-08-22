import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BRAND, BRAND_HEXES } from '@/lib/brand'

const ROOT = join(__dirname, '..', '..')

function sourceFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (['node_modules', '.next', '__tests__'].includes(entry)) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (!/\.(tsx?|css)$/.test(entry)) continue
      out.push({ path: full.slice(ROOT.length + 1), text: readFileSync(full, 'utf8') })
    }
  }
  for (const d of ['app', 'components', 'lib']) walk(join(ROOT, d))
  return out
}

/**
 * Changing the hero colour touched 102 files and 529 literal hex strings, and
 * five tests failed because each had hardcoded the old value independently.
 * Components must keep writing literal hex — Tailwind resolves arbitrary
 * values at build time and cannot read a runtime constant — so the guard is
 * not "use the constant" but "every brand-family colour in the tree is one
 * this file names".
 *
 * That makes the next repaint a one-line edit here plus a sed, with this test
 * naming any file the sed missed.
 */
describe('the brand palette has one definition', () => {
  const files = sourceFiles()

  /**
   * Colours retired in the move from teal to olive. If one reappears, a file
   * was missed or someone copied an old snippet — either way the page renders
   * two brands at once.
   */
  const RETIRED = ['064E4A', '053D3A', '0F766E', 'F0FAFA', '99D4D1', '14453D', '0F3530']

  it('contains no retired brand colour', () => {
    const offenders: string[] = []
    for (const f of files) {
      for (const hex of RETIRED) {
        if (new RegExp(hex, 'i').test(f.text)) offenders.push(`${f.path} (${hex})`)
      }
    }
    expect(offenders, `retired brand colours still in the tree:\n${offenders.join('\n')}`).toEqual([])
  })

  it('defines the hero colour Freddie chose', () => {
    expect(BRAND.primary).toBe('#3D472F')
  })

  it('states the hero colour in the CSS variable too', () => {
    expect(readFileSync(join(ROOT, 'app/globals.css'), 'utf8'))
      .toContain(`--brand: ${BRAND.primary}`)
  })

  it('keeps a hover shade distinct from the primary', () => {
    expect(BRAND.deep).not.toBe(BRAND.primary)
    expect(BRAND_HEXES).toContain(BRAND.deep)
  })

  /**
   * The hero is white-on-brand at button size. WCAG AA needs 4.5:1; anything
   * less and the one control the whole funnel depends on is hard to read.
   */
  it('carries enough contrast for white text', () => {
    const lin = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
    }
    for (const shade of [BRAND.primary, BRAND.deep, BRAND.mid]) {
      const ratio = 1.05 / (luminance(shade) + 0.05)
      expect(ratio, `white on ${shade} is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
