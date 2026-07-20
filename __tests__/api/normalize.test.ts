import { normalizePlate, validatePlate } from '@/lib/api/normalize'
import { ApiError } from '@/lib/api/errors'

describe('normalizePlate', () => {
  it('converts lowercase to uppercase', () => {
    expect(normalizePlate('wph925')).toBe('WPH925')
  })

  it('removes dashes', () => {
    expect(normalizePlate('WPH-925')).toBe('WPH925')
  })

  it('removes spaces', () => {
    expect(normalizePlate('WPH 925')).toBe('WPH925')
  })

  it('handles mixed case with dashes', () => {
    expect(normalizePlate('wph-925')).toBe('WPH925')
  })

  it('rejects empty string', () => {
    expect(() => normalizePlate('')).toThrow(ApiError)
  })

  it('rejects non-alphanumeric (except dash/space)', () => {
    expect(() => normalizePlate('WPH@925')).toThrow(ApiError)
  })

  it('rejects if result is not 6 characters', () => {
    expect(() => normalizePlate('WPH92')).toThrow(ApiError)
    expect(() => normalizePlate('WPH9255')).toThrow(ApiError)
  })

  it('accepts valid plate format (3 letters + 3 digits)', () => {
    expect(normalizePlate('ABC123')).toBe('ABC123')
  })
})

describe('validatePlate', () => {
  it('returns true for valid plates', () => {
    expect(validatePlate('WPH925')).toBe(true)
    expect(validatePlate('ABC123')).toBe(true)
  })

  it('returns false for invalid plates', () => {
    expect(validatePlate('')).toBe(false)
    expect(validatePlate('WPH92')).toBe(false)
    expect(validatePlate('WPH@925')).toBe(false)
  })
})
