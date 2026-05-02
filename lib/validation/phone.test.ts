import { describe, it, expect } from 'vitest'
import { phoneSchema } from './phone'

describe('phone validation', () => {
  it('accepts +60 prefix', () => {
    const r = phoneSchema.safeParse('+60123456789')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('+60123456789')
  })

  it('normalises leading 0 to +60', () => {
    const r = phoneSchema.safeParse('0123456789')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('+60123456789')
  })

  it('normalises 60 prefix to +60', () => {
    const r = phoneSchema.safeParse('60123456789')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('+60123456789')
  })

  it('rejects non-Malaysian numbers', () => {
    expect(phoneSchema.safeParse('+1234567890').success).toBe(false)
  })
})
