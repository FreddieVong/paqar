// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

// lib/jomcheck/index.ts is server-only and reads env — mock both before importing
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: { JOMCHECK_MODE: 'manual' },
}))

import { buildManualJomCheckResult } from '@/lib/jomcheck'

describe('buildManualJomCheckResult', () => {
  it('returns a clean result when all counts are zero', () => {
    const result = buildManualJomCheckResult('WXY 1234', {
      accident: 0, flood: 0, windscreen: 0, total_loss: 0,
    })

    expect(result.plate).toBe('WXY1234')
    expect(result.totalClaims).toBe(0)
    expect(result.claims).toEqual([])
    expect(typeof result.checkedAt).toBe('string')
    expect(new Date(result.checkedAt).getTime()).not.toBeNaN()
  })

  it('includes only claim types with count > 0, always with amount null', () => {
    const result = buildManualJomCheckResult('abc123', {
      accident: 2, flood: 1, windscreen: 0, total_loss: 0,
    })

    expect(result.totalClaims).toBe(3)
    expect(result.claims).toEqual([
      { type: 'accident', count: 2, amount: null },
      { type: 'flood',    count: 1, amount: null },
    ])
  })

  it('normalises the plate (uppercase, no spaces)', () => {
    const result = buildManualJomCheckResult('vbu 55', {
      accident: 0, flood: 0, windscreen: 1, total_loss: 0,
    })

    expect(result.plate).toBe('VBU55')
    expect(result.totalClaims).toBe(1)
  })

  it('sums all four types into totalClaims', () => {
    const result = buildManualJomCheckResult('JJJ1', {
      accident: 1, flood: 2, windscreen: 3, total_loss: 4,
    })

    expect(result.totalClaims).toBe(10)
    expect(result.claims.map(c => c.type)).toEqual(['accident', 'flood', 'windscreen', 'total_loss'])
  })
})
