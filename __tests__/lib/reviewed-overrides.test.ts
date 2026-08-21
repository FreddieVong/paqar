import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOverrides, applyOverrides, correctedCarLabel } from '@/lib/reviewed-overrides'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

/**
 * THE DEFECT THIS PINS.
 *
 * reviewed_overrides was written on release and read by nothing. A reviewer
 * could correct the price or the model, press release, and the buyer received
 * the uncorrected machine output — under a note implying a human had checked
 * it. Both parties then believed something untrue, which is worse than having
 * no correction feature at all.
 */
describe('the overrides actually reach the report', () => {
  it('the report page parses and applies them', () => {
    const src = read('app/laporan-pembeli/[checkId]/page.tsx')
    expect(src).toContain('parseOverrides(report.reviewed_overrides)')
    expect(src).toContain('applyOverrides(')
  })

  it('the rendered price comes from the corrected value, not the raw row', () => {
    const src = read('app/laporan-pembeli/[checkId]/page.tsx')
    expect(src).toContain('askingPriceRm={reviewed.askingPriceRm}')
    expect(src).not.toContain('askingPriceRm={report.asking_price_rm ?? null}')
  })

  it('a suppressed mileage finding is honoured', () => {
    const src = read('app/laporan-pembeli/[checkId]/page.tsx')
    expect(src).toContain('rollbackSuppressed={reviewed.suppressMileageWarning}')
  })
})

describe('parseOverrides discards anything it does not recognise', () => {
  it('returns an empty object for absent or malformed input', () => {
    for (const bad of [null, undefined, 'string', 42, [], true]) {
      expect(parseOverrides(bad)).toEqual({})
    }
  })

  /** The column is JSONB fed by a form; a stray key must not reach rendering. */
  it('ignores keys outside the allowed set', () => {
    expect(parseOverrides({ brand: 'Honda', evil: '<script>', __proto__: 'x' }))
      .toEqual({ brand: 'Honda' })
  })

  it('trims text and drops blanks rather than blanking a real value', () => {
    expect(parseOverrides({ brand: '  Honda  ', model: '   ' })).toEqual({ brand: 'Honda' })
  })

  it('accepts the string a form submits for a number', () => {
    expect(parseOverrides({ askingPriceRm: '35000' })).toEqual({ askingPriceRm: 35000 })
  })

  /** An empty field must not become 0, and 0 must not become "free". */
  it.each([
    ['empty string', ''],
    ['zero',         0],
    ['below floor',  999],
    ['above cap',    3_000_000],
    ['not a number', 'abc'],
    ['fractional',   1000.5],
  ])('refuses an asking price that is %s', (_l, v) => {
    expect(parseOverrides({ askingPriceRm: v }).askingPriceRm).toBeUndefined()
  })

  it('accepts the suppression flag in either form', () => {
    expect(parseOverrides({ suppressMileageWarning: true }).suppressMileageWarning).toBe(true)
    expect(parseOverrides({ suppressMileageWarning: 'true' }).suppressMileageWarning).toBe(true)
    expect(parseOverrides({ suppressMileageWarning: false }).suppressMileageWarning).toBeUndefined()
  })
})

describe('applyOverrides', () => {
  it('prefers the reviewer value where one exists', () => {
    expect(applyOverrides({
      overrides: { askingPriceRm: 35000 }, askingPriceRm: 55000, mileageKm: 85000,
    })).toEqual({ askingPriceRm: 35000, mileageKm: 85000, suppressMileageWarning: false })
  })

  it('keeps the draft value where the reviewer changed nothing', () => {
    expect(applyOverrides({ overrides: {}, askingPriceRm: 55000, mileageKm: 85000 }))
      .toEqual({ askingPriceRm: 55000, mileageKm: 85000, suppressMileageWarning: false })
  })

  it('carries nulls through rather than inventing figures', () => {
    expect(applyOverrides({ overrides: {}, askingPriceRm: null, mileageKm: null }))
      .toEqual({ askingPriceRm: null, mileageKm: null, suppressMileageWarning: false })
  })

  /**
   * A reviewer reading a mileage off a screenshot has transcribed the SELLER's
   * claim. Provenance is not upgraded, so lib/mileage-provenance still refuses
   * to build a tampering finding on it.
   */
  it('does not upgrade provenance', () => {
    const src = read('lib/reviewed-overrides.ts')
    expect(src).not.toMatch(/official_record|reviewer_confirmed/)
  })
})

describe('correctedCarLabel', () => {
  it('uses corrections over the intake values', () => {
    expect(correctedCarLabel({ model: 'Civic' }, { brand: 'Honda', model: 'City', year: '2019' }))
      .toBe('Honda Civic 2019')
  })

  it('includes a variant the reviewer added', () => {
    expect(correctedCarLabel({ variant: '1.5 V' }, { brand: 'Honda', model: 'City', year: '2019' }))
      .toBe('Honda City 1.5 V 2019')
  })

  it('returns null when there is nothing to label', () => {
    expect(correctedCarLabel({}, {})).toBeNull()
  })
})
