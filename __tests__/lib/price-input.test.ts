import { describe, it, expect } from 'vitest'
import { formatPriceInput, parsePriceInput, toDigits } from '@/lib/price-input'

/**
 * The asking-price field shows "59,000" and sends 59000.
 *
 * The separator is a rendering concern and must never reach state, because
 * three call sites read the state string directly and none of them would fail a
 * type check if it changed: parseInt (which yields 59 for "59,000"), the
 * `asking_price` URL parameter, and the idempotency key derived from the raw
 * string. So these tests pin the boundary, not the cosmetics.
 */

describe('what the buyer sees', () => {
  it('groups thousands', () => {
    expect(formatPriceInput('59000')).toBe('59,000')
    expect(formatPriceInput('590000')).toBe('590,000')
  })

  it('leaves an empty field empty rather than showing 0', () => {
    expect(formatPriceInput('')).toBe('')
  })

  it('does not group below a thousand', () => {
    expect(formatPriceInput('999')).toBe('999')
  })
})

describe('what the buyer types or pastes', () => {
  it.each([
    ['59000',      '59000'],
    ['59,000',     '59000'],
    ['RM 59,000',  '59000'],
    ['RM59000',    '59000'],
    [' 59 000 ',   '59000'],
    ['59.000',     '59000'],
  ])('%s becomes %s', (input, expected) => {
    expect(toDigits(input)).toBe(expected)
  })

  it('drops leading zeros so one price is one string', () => {
    // Otherwise "059000" and "59000" produce different idempotency keys for
    // what the buyer considers the same submission.
    expect(toDigits('059000')).toBe('59000')
  })

  it('yields nothing from text with no digits', () => {
    expect(toDigits('RM')).toBe('')
    expect(parsePriceInput('abc')).toBeNull()
    expect(parsePriceInput('')).toBeNull()
  })
})

describe('the value that reaches the API', () => {
  it('round-trips through display without changing', () => {
    const state = toDigits('RM 59,000')
    expect(formatPriceInput(state)).toBe('59,000')   // what is shown
    expect(parseInt(state, 10)).toBe(59_000)         // what is sent
  })

  it('is never a comma-bearing string that parseInt would truncate', () => {
    // The bug this whole module exists to prevent.
    expect(parseInt('59,000', 10)).toBe(59)
    expect(parseInt(toDigits('59,000'), 10)).toBe(59_000)
  })

  it('parses to the same number the range check expects', () => {
    expect(parsePriceInput('RM 1,000')).toBe(1000)
    expect(parsePriceInput('2,000,000')).toBe(2_000_000)
  })
})
