// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { canonicalModelKeyword, MODELS_BY_BRAND, BRANDS } from '@/lib/model-catalog'

/**
 * The free model checker's model field is free text, and the market-price cache
 * is keyed on whatever gets typed. That split "Civic" and "Civic 1.8S" into
 * separate rows, and the qualified one was thinner. Measured in production:
 *
 *   perodua / "myvi 1.3 cc ezi outo" / 2011     5 listings   ("myvi"  has 15)
 *   honda   / "civic 1.8s"           / 2022     5 listings   ("civic" has 15)
 *   bmw     / 2020 alone held four spellings: 3, 3 series, 320, 330
 *
 * comparableConfidence bands at 5 and 10 and the verdict is suppressed below 3,
 * so a variant-qualified name got a LOWER-confidence answer — or none — for the
 * same car, plus a ~25s wait while it re-scraped.
 *
 * The danger in fixing it is over-merging. These tests pin both directions.
 */

describe('a variant-qualified model reaches the canonical row', () => {
  it.each([
    ['Perodua', 'Myvi 1.5 AV',            'Myvi'],
    ['Perodua', 'myvi 1.3 cc ezi outo',   'Myvi'],
    ['Honda',   'Civic 1.8S',             'Civic'],
    ['Nissan',  'Almera 1.0 VLT Turbo',   'Almera'],
    ['Perodua', 'Alza AV',                'Alza'],
    ['Perodua', 'Viva Elite',             'Viva'],
    ['Honda',   'HR-V Turbo V',           'HR-V'],
    ['Toyota',  'Camry 2.0G',             'Camry'],
  ])('%s / "%s" -> %s', (brand, typed, expected) => {
    expect(canonicalModelKeyword(brand, typed)).toBe(expected)
  })

  it('is case-insensitive on both brand and model', () => {
    expect(canonicalModelKeyword('perodua', 'MYVI 1.5 AV')).toBe('Myvi')
    expect(canonicalModelKeyword('PERODUA', 'myvi')).toBe('Myvi')
  })

  it('normalises an exact match to the catalogue spelling', () => {
    // "hr-v" and "HR-V" must not remain two different cache rows.
    expect(canonicalModelKeyword('Honda', 'hr-v')).toBe('HR-V')
  })

  it('trims', () => {
    expect(canonicalModelKeyword('Perodua', '  Myvi 1.5  ')).toBe('Myvi')
  })
})

describe('it never merges two genuinely different models', () => {
  it('keeps CX-30 out of CX-3', () => {
    // The token-boundary guard. Without it "CX-30" starts with "CX-3" and a
    // whole model would collapse into its smaller sibling.
    expect(canonicalModelKeyword('Mazda', 'CX-30')).toBe('CX-30')
    expect(canonicalModelKeyword('Mazda', 'CX-3')).toBe('CX-3')
  })

  it('prefers the longest match', () => {
    expect(canonicalModelKeyword('Mazda', 'Mazda 3 Sedan')).toBe('Mazda 3')
    expect(canonicalModelKeyword('Tesla', 'Model 3 Long Range')).toBe('Model 3')
  })

  it('does not match a model that is merely a prefix of a word', () => {
    // "Myvia" is not a Myvi.
    expect(canonicalModelKeyword('Perodua', 'Myvia')).toBe('Myvia')
    expect(canonicalModelKeyword('Proton', 'X50i')).toBe('X50i')
  })

  it('leaves an unknown model exactly as typed', () => {
    // Kelisa and "Odyssey Absolute" used to sit here. Both are now KNOWN —
    // Kelisa was added to the catalogue, and "Odyssey Absolute" canonicalises
    // to "Odyssey", which is this function working, not failing: a variant
    // reaching the same warm cache row as the plain model is the whole point.
    // These two are genuinely absent, so they exercise the passthrough.
    expect(canonicalModelKeyword('Perodua', 'Rusa')).toBe('Rusa')
    expect(canonicalModelKeyword('Honda',   'Legend Exclusive')).toBe('Legend Exclusive')
  })

  it('leaves everything alone for an unknown brand', () => {
    expect(canonicalModelKeyword('Ferrari', 'F40')).toBe('F40')
  })

  it('does not cross brands', () => {
    // Proton has an X50; BMW does not. A BMW input must not borrow it.
    expect(canonicalModelKeyword('BMW', 'X50')).toBe('X50')
    expect(canonicalModelKeyword('Proton', 'X50')).toBe('X50')
  })

  it('handles empty and whitespace input without inventing a model', () => {
    expect(canonicalModelKeyword('Perodua', '')).toBe('')
    expect(canonicalModelKeyword('Perodua', '   ')).toBe('')
  })
})

describe('the catalogue itself', () => {
  it('is shared, not duplicated in the form', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const form = readFileSync(
      join(__dirname, '..', '..', 'components/check/OverpricedCheckerForm.tsx'), 'utf-8')
    expect(form).toContain("from '@/lib/model-catalog'")
    expect(form).not.toMatch(/^const MODELS_BY_BRAND/m)
    expect(form).not.toMatch(/^const BRANDS = \[/m)
  })

  it('lists models for every brand the selector offers', () => {
    const missing = BRANDS.filter(b => !(MODELS_BY_BRAND[b]?.length))
    // A brand with no models gives the buyer an empty datalist and guarantees
    // a free-text cache key.
    expect(missing).toEqual([])
  })

  it('has no duplicate model within a brand', () => {
    for (const [brand, models] of Object.entries(MODELS_BY_BRAND)) {
      expect(new Set(models.map(m => m.toLowerCase())).size, brand).toBe(models.length)
    }
  })
})
