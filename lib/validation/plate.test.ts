import { describe, it, expect } from 'vitest'
import { plateSchema, normalise } from './plate'

describe('plate validation', () => {
  it('normalises to uppercase and strips spaces/hyphens', () => {
    expect(normalise('wvp 1234')).toBe('WVP1234')
    expect(normalise('W-VP-1234')).toBe('WVP1234')
  })

  it('accepts 3-12 alphanumeric chars after normalisation', () => {
    expect(plateSchema.safeParse('WVP1234').success).toBe(true)
    expect(plateSchema.safeParse('W1234').success).toBe(true)
    expect(plateSchema.safeParse('AB').success).toBe(false)              // too short
    expect(plateSchema.safeParse('ABCDEFGHIJKLM').success).toBe(false)   // 13 chars, too long
  })

  it('rejects empty string', () => {
    expect(plateSchema.safeParse('').success).toBe(false)
  })
})
