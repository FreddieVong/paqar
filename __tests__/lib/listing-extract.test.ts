import { describe, it, expect } from 'vitest'
import {
  extractFromHtml, fieldsNeedingInput, canProceedPassively, needsPriceConfirmation,
  parseRinggit, parseMileage, parseYear, parseVehicle,
} from '@/lib/listing-extract'

const page = (o: Record<string, string>) =>
  Object.entries(o).map(([k, v]) => `<meta property="${k}" content="${v}">`).join('\n')

const RICH = page({
  'og:title':              'Honda City 1.5 V 2019 - Mudah.my',
  'og:description':        'Mileage 85,000 km. Tip-top condition, one owner.',
  'product:price:amount':  '55000',
})

describe('field parsers', () => {
  it.each([
    ['RM 55,000', 55_000],
    ['RM55000',   55_000],
    ['RM 5,500',   5_500],
  ])('parses %s', (t, n) => expect(parseRinggit(t)).toBe(n))

  it('refuses a price outside plausible bounds', () => {
    expect(parseRinggit('RM 12')).toBeNull()
    expect(parseRinggit('RM 99,999,999')).toBeNull()
  })

  it.each([['85,000 km', 85_000], ['85k km', 85_000], ['85000km', 85_000]])(
    'parses mileage %s', (t, n) => expect(parseMileage(t)).toBe(n),
  )

  it('parses a plausible year and ignores a stray number', () => {
    expect(parseYear('Honda City 2019 1500cc')).toBe('2019')
    expect(parseYear('Honda City 1500cc')).toBeNull()
  })

  /** A model is only accepted under a brand — never on its own. */
  it('requires the brand before matching its model', () => {
    expect(parseVehicle('Honda City 2019')).toEqual({ brand: 'Honda', model: 'City' })
    expect(parseVehicle('City 2019')).toEqual({ brand: null, model: null })
  })
})

describe('extractFromHtml — high confidence', () => {
  const x = extractFromHtml(RICH)

  it('reads the vehicle from structured metadata', () => {
    expect(x.brand.value).toBe('Honda')
    expect(x.model.value).toBe('City')
    expect(x.year.value).toBe('2019')
    expect(x.brand.status).toBe('high')
  })

  it('treats a price meta tag as the site’s own statement', () => {
    expect(x.askingPriceRm.value).toBe(55_000)
    expect(x.askingPriceRm.status).toBe('high')
  })

  it('proceeds without asking about brand, model or year', () => {
    expect(canProceedPassively(x)).toBe(true)
  })

  /**
   * No extra tap for a price the site itself published. The value is shown
   * prominently with an Ubah action directly above the pay button, and pressing
   * that button is the confirmation. An extra "Ya, betul" bought no additional
   * signal and reintroduced the friction this intake removes.
   */
  it('does not interrupt for a price the source stated unambiguously', () => {
    expect(needsPriceConfirmation(x)).toBe(false)
    expect(fieldsNeedingInput(x)).toEqual([])
  })

  /** Variant is never read from prose — short tokens collide with real words. */
  it('never guesses the variant', () => {
    expect(x.variant.value).toBeNull()
    expect(x.variant.status).toBe('missing')
  })
})

describe('extractFromHtml — medium confidence', () => {
  const x = extractFromHtml(page({
    'og:title':       'Honda City 2019 RM55,000 nego',
    'og:description': 'Call now',
  }))

  it('marks a title-scraped price medium, not high', () => {
    // A number in a human-written title is as likely to be a monthly
    // instalment or a second car's price.
    expect(x.askingPriceRm.value).toBe(55_000)
    expect(x.askingPriceRm.status).toBe('medium')
  })

  it('asks only about the uncertain field', () => {
    expect(fieldsNeedingInput(x)).toEqual(['askingPriceRm'])
    expect(needsPriceConfirmation(x)).toBe(true)
  })
})

describe('extractFromHtml — nothing usable', () => {
  const x = extractFromHtml('<html><head><title>Mudah.my</title></head></html>')

  it('reports every required field as missing rather than guessing', () => {
    for (const k of ['brand', 'model', 'year', 'askingPriceRm'] as const) {
      expect(x[k].value, k).toBeNull()
      expect(x[k].status, k).toBe('missing')
    }
  })

  it('cannot proceed passively', () => {
    expect(canProceedPassively(x)).toBe(false)
  })

  it('asks for exactly the minimum coverage needs', () => {
    expect(fieldsNeedingInput(x)).toEqual(['brand', 'model', 'year', 'askingPriceRm'])
  })

  it('records no evidence for a field it could not read', () => {
    expect(x.brand.evidence).toBeNull()
  })
})

describe('mileage provenance is carried through, not asserted', () => {
  it('marks an extracted mileage medium — it is still the seller’s claim', () => {
    const x = extractFromHtml(RICH)
    expect(x.mileageKm.value).toBe(85_000)
    expect(x.mileageKm.status).toBe('medium')
  })
})
