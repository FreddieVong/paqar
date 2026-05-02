import { describe, it, expect } from 'vitest'
import { icSchema, normalise } from './ic'

describe('IC validation', () => {
  it('normalises by stripping hyphens', () => {
    expect(normalise('880614-10-5421')).toBe('880614105421')
  })

  it('accepts valid 12-digit IC', () => {
    expect(icSchema.safeParse('880614105421').success).toBe(true)
    expect(icSchema.safeParse('880614-10-5421').success).toBe(true)
  })

  it('rejects IC with invalid month', () => {
    expect(icSchema.safeParse('881314105421').success).toBe(false)
  })

  it('rejects IC with fewer than 12 digits', () => {
    expect(icSchema.safeParse('88061410542').success).toBe(false)
  })
})
