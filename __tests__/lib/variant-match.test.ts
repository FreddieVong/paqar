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
  it('matches whole words only — "E" is not found inside SEDAN or EXECUTIVE', () => {
    // Found in review: substring matching let a City E "match" a City S SEDAN,
    // and the paid report printed "sepadan dengan rekod" for a wrong trim.
    expect(missingTrimWords('1.5 E', 'CITY 1.5 S SEDAN')).toEqual(['E'])
    expect(missingTrimWords('1.5 V', 'MYVI 1.5 AV')).toEqual(['V'])
    expect(missingTrimWords('SE', 'SEDAN 1.6')).toEqual(['SE'])
  })

  it('accepts a hyphenated advert trim the record writes as one word, and vice versa', () => {
    // Found in review: whole-word matching split "GR-S" into GR and S and
    // reported GR missing from a record that says GRS.
    expect(missingTrimWords('1.5 GR-S', 'YARIS 1.5 GRS')).toEqual([])
    expect(missingTrimWords('2.5 X-Line', 'CX-5 2.5 XLINE')).toEqual([])
    expect(missingTrimWords('1.5 GRS', 'YARIS 1.5 GR-S')).toEqual([])
    // But a hyphenated trim the record really lacks is still reported, as written.
    expect(missingTrimWords('1.5 GR-S', 'YARIS 1.5 G')).toEqual(['GR-S'])
  })

  it('reports a trim as the trim, not as a mangled engine fragment', () => {
    // Found in review: "1.5-E" against "1.5 S" reported "5-E" to the buyer.
    expect(missingTrimWords('1.5-E', 'CITY 1.5 S')).toEqual(['E'])
    expect(missingTrimWords('1.5-E', 'CITY 1.5 E')).toEqual([])
  })

  it('is empty when there is nothing to compare', () => {
    expect(missingTrimWords(null, 'EXORA PREMIUM')).toEqual([])
    expect(missingTrimWords('Premium', '')).toEqual([])
  })
})
