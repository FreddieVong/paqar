import { describe, it, expect } from 'vitest'
import { variantLabel, variantLabelList } from '@/lib/variant-label'

describe('variantLabel', () => {
  it('drops a leading engine displacement', () => {
    expect(variantLabel('1.3 X')).toBe('X')
    expect(variantLabel('1.5 AV')).toBe('AV')
    expect(variantLabel('2.5 SC')).toBe('SC')
  })

  it('drops a parenthetical gloss', () => {
    expect(variantLabel('1.3 G (Standard)')).toBe('G')
    expect(variantLabel('1.3 Premium (X)')).toBe('Premium')
  })

  it('keeps the first of alternative names', () => {
    expect(variantLabel('1.3 Advance / AV')).toBe('Advance')
    expect(variantLabel('S / E')).toBe('S')
  })

  it('leaves an already-clean trim untouched', () => {
    expect(variantLabel('V')).toBe('V')
    expect(variantLabel('240X')).toBe('240X')
  })

  it('keeps multi-word trims intact', () => {
    expect(variantLabel('3.5 Executive Lounge')).toBe('Executive Lounge')
  })
})

describe('variantLabelList', () => {
  // The actual bug: these are real VARIANT_GUIDES entries whose titles
  // rendered as meaningless duplicates before the fix.
  it('produces distinct trims for the Myvi newest generation', () => {
    const names = ['1.3 G (Standard)', '1.3 X', '1.5 H', '1.5 AV']
    expect(variantLabelList(names)).toBe('G vs X vs H vs AV')
  })

  it('produces distinct trims for the Bezza newest generation', () => {
    const names = ['1.0 G', '1.3 X', '1.3 Advance / AV']
    expect(variantLabelList(names)).toBe('G vs X vs Advance')
  })

  it('produces distinct trims for the Alphard newest generation', () => {
    const names = ['2.5 X', '2.5 G', '2.5 SC', '3.5 Executive Lounge']
    expect(variantLabelList(names)).toBe('X vs G vs SC vs Executive Lounge')
  })

  it('never emits the same trim twice', () => {
    expect(variantLabelList(['1.3 X', '1.5 X'])).toBe('X')
  })

  it('caps the number of trims so the title tag stays reasonable', () => {
    const names = ['1.0 A', '1.0 B', '1.0 C', '1.0 D', '1.0 E', '1.0 F']
    expect(variantLabelList(names)).toBe('A vs B vs C vs D')
    expect(variantLabelList(names, 2)).toBe('A vs B')
  })

  it('returns an empty string for no usable names', () => {
    expect(variantLabelList([])).toBe('')
  })

  // Regression guard for the original defect: first-token extraction.
  it('does not regress to engine-size duplication', () => {
    const result = variantLabelList(['1.3 G (Standard)', '1.3 X', '1.5 H', '1.5 AV'])
    expect(result).not.toContain('1.3 vs 1.3')
    expect(result).not.toMatch(/^\d/)
  })
})
