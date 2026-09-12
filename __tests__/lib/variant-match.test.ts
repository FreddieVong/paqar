import { describe, it, expect } from 'vitest'
import { missingTrimWords } from '@/lib/variant-match'

/**
 * One rule for "does the advert's variant match the record", shared by the
 * reviewer's draft and the buyer's Semakan Varian card, so the two can never
 * disagree about the same advert.
 */
describe('missingTrimWords', () => {
  it('is empty when every trim word in the advert appears in the record', () => {
    expect(missingTrimWords('1.6 Premium', 'EXORA PREMIUM')).toEqual([])
    expect(missingTrimWords('1.6 Premium (A) Facelift', 'EXORA PREMIUM')).toEqual([])
  })
  it('names the words the record does not carry', () => {
    expect(missingTrimWords('1.6 Executive', 'EXORA PREMIUM')).toEqual(['EXECUTIVE'])
  })
  it('treats single-letter trims as words', () => {
    expect(missingTrimWords('1.5 V', 'CITY 1.5 E')).toEqual(['V'])
    expect(missingTrimWords('1.5 E', 'CITY 1.5 E')).toEqual([])
  })
  it('ignores engine sizes, transmissions and seller filler', () => {
    expect(missingTrimWords('1.6 Auto CKD Facelift Tiptop', 'EXORA PREMIUM')).toEqual([])
  })
  it('is empty when there is nothing to compare', () => {
    expect(missingTrimWords(null, 'EXORA PREMIUM')).toEqual([])
    expect(missingTrimWords('Premium', '')).toEqual([])
  })
})
