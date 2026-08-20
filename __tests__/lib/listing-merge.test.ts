import { describe, it, expect } from 'vitest'
import {
  mergeListing, readyForCoverage, hasCriticalConflict, fieldsStillNeeded,
} from '@/lib/listing-merge'
import type { ExtractedListing, FieldStatus } from '@/lib/listing-extract'

const f = <T>(value: T | null, status: FieldStatus) => ({ value, status, evidence: null })

const src = (o: Partial<Record<keyof ExtractedListing, [unknown, FieldStatus]>>): ExtractedListing => ({
  brand:         f((o.brand?.[0] ?? null) as string, o.brand?.[1] ?? 'missing'),
  model:         f((o.model?.[0] ?? null) as string, o.model?.[1] ?? 'missing'),
  year:          f((o.year?.[0] ?? null) as string, o.year?.[1] ?? 'missing'),
  askingPriceRm: f((o.askingPriceRm?.[0] ?? null) as number, o.askingPriceRm?.[1] ?? 'missing'),
  mileageKm:     f((o.mileageKm?.[0] ?? null) as number, o.mileageKm?.[1] ?? 'missing'),
  variant:       f((o.variant?.[0] ?? null) as string, o.variant?.[1] ?? 'missing'),
})

const FULL_URL = src({
  brand: ['Honda', 'high'], model: ['City', 'high'], year: ['2019', 'high'],
  askingPriceRm: [55000, 'high'], mileageKm: [85000, 'medium'],
})

describe('agreement proceeds passively', () => {
  const m = mergeListing({ fromUrl: FULL_URL })

  it('keeps high confidence and its provenance', () => {
    expect(m.brand.value).toBe('Honda')
    expect(m.brand.status).toBe('high')
    expect(m.brand.provenance).toBe('url_metadata')
  })

  it('is ready for coverage with nothing to ask', () => {
    expect(readyForCoverage(m)).toBe(true)
    expect(hasCriticalConflict(m)).toBe(false)
    expect(fieldsStillNeeded(m)).toEqual([])
  })
})

describe('two sources agreeing', () => {
  it('does not manufacture a conflict', () => {
    const m = mergeListing({
      fromUrl: FULL_URL,
      fromScreenshots: src({ brand: ['Honda', 'medium'], askingPriceRm: [55000, 'medium'] }),
    })
    expect(m.askingPriceRm.conflict).toBeUndefined()
    expect(m.askingPriceRm.value).toBe(55000)
  })
})

/**
 * Silently preferring one source is how RM35,000 became RM55,000. A wrong
 * asking price produces a confidently wrong decision the buyer cannot detect.
 */
describe('critical conflicts are surfaced, never resolved silently', () => {
  it('refuses to choose between two equally-strong prices', () => {
    const m = mergeListing({
      fromUrl:         src({ askingPriceRm: [55000, 'high'] }),
      fromScreenshots: src({ askingPriceRm: [35000, 'high'] }),
    })
    expect(m.askingPriceRm.conflict).toBeDefined()
    expect(m.askingPriceRm.status).toBe('missing')
    expect(hasCriticalConflict(m)).toBe(true)
    expect(readyForCoverage(m)).toBe(false)
  })

  it('names both candidate values so the buyer can pick', () => {
    const m = mergeListing({
      fromUrl:         src({ askingPriceRm: [55000, 'high'] }),
      fromScreenshots: src({ askingPriceRm: [35000, 'high'] }),
    })
    expect(m.askingPriceRm.conflict!.map(c => c.value).sort()).toEqual([35000, 55000])
  })

  it('lets a stronger source win over a weaker one, but at reduced confidence', () => {
    const m = mergeListing({
      fromUrl:         src({ model: ['City', 'high'] }),
      fromScreenshots: src({ model: ['Civic', 'medium'] }),
    })
    expect(m.model.value).toBe('City')
    expect(m.model.status).toBe('medium')
    expect(m.model.conflict).toBeUndefined()
  })

  it('does not block on a non-critical disagreement', () => {
    const m = mergeListing({
      fromUrl:         { ...FULL_URL, mileageKm: f(85000, 'high') },
      fromScreenshots: src({ mileageKm: [90000, 'high'] }),
    })
    expect(hasCriticalConflict(m)).toBe(false)
    expect(readyForCoverage(m)).toBe(true)
  })
})

/**
 * A buyer correcting the mileage has told us what the ADVERT says, not what the
 * odometer reads. Promoting the edit to 'high' would let it flow into places
 * that treat high confidence as evidence — eventually including a tampering
 * finding.
 */
describe('buyer edits win the value but not the authority', () => {
  it('overrides even a high-confidence source', () => {
    const m = mergeListing({ fromUrl: FULL_URL, buyerEdits: { askingPriceRm: 35000 } })
    expect(m.askingPriceRm.value).toBe(35000)
    expect(m.askingPriceRm.provenance).toBe('buyer_entry')
  })

  it('never reaches high confidence', () => {
    const m = mergeListing({ fromUrl: FULL_URL, buyerEdits: { mileageKm: 60000 } })
    expect(m.mileageKm.status).toBe('medium')
    expect(m.mileageKm.status).not.toBe('high')
  })

  it('resolves a conflict the buyer was asked about', () => {
    // FULL_URL supplies brand/model/year, so readyForCoverage is testing the
    // conflict resolution rather than failing on unrelated missing fields.
    const m = mergeListing({
      fromUrl:         { ...FULL_URL, askingPriceRm: f(55000, 'high') },
      fromScreenshots: src({ askingPriceRm: [35000, 'high'] }),
      buyerEdits:      { askingPriceRm: 35000 },
    })
    expect(m.askingPriceRm.conflict).toBeUndefined()
    expect(m.askingPriceRm.value).toBe(35000)
    expect(readyForCoverage(m)).toBe(true)
  })

  it('ignores a blank edit rather than erasing a known value', () => {
    const m = mergeListing({ fromUrl: FULL_URL, buyerEdits: { model: '   ' } })
    expect(m.model.value).toBe('City')
  })
})

describe('screenshots alone', () => {
  it('can carry an intake, at medium confidence throughout', () => {
    const m = mergeListing({
      fromScreenshots: src({
        brand: ['Perodua', 'medium'], model: ['Myvi', 'medium'],
        year: ['2018', 'medium'], askingPriceRm: [42000, 'medium'],
      }),
    })
    expect(readyForCoverage(m)).toBe(true)
    expect(m.brand.status).toBe('medium')
    expect(m.brand.provenance).toBe('screenshot_ocr')
  })

  it('carries a plate from OCR without inventing one', () => {
    expect(mergeListing({ plateFromOcr: 'WXY1234' }).plate.value).toBe('WXY1234')
    expect(mergeListing({}).plate.value).toBeNull()
  })
})

describe('nothing at all', () => {
  it('asks for every critical field', () => {
    const m = mergeListing({})
    expect(readyForCoverage(m)).toBe(false)
    expect(fieldsStillNeeded(m).sort()).toEqual(['askingPriceRm', 'brand', 'model', 'year'])
  })
})
