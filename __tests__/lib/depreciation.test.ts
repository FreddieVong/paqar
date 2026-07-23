import { describe, it, expect } from 'vitest'
import { assessDepreciation } from '@/lib/depreciation'

describe('assessDepreciation', () => {
  it('returns null for implausibly high retention (real bug: corrupted 2014 Camry V wmNewPrice)', () => {
    // Ground truth from a real customer report (check ch_9di_UUk2rY): the
    // vehicle_valuations row for this NVIC (I6414A) has a corrupted
    // wm_new_price of 62,800 — the real 2014 Camry V price is ~RM180k-190k
    // (matches 2012's RM174,821 and 2018+'s RM189,900 in the same table).
    // Live market median for this exact car was RM42,800, age 12 years.
    // Before the fix this produced ratio ≈3.16 and incorrectly returned the
    // "retains value well, easy to resell" note.
    const result = assessDepreciation(62_800, 42_800, 12)
    expect(result).toBeNull()
  })

  it('still returns the positive note for genuinely good retention (within the new ceiling)', () => {
    // age 12 -> expected = 0.88^12 ≈ 0.2158. retention = 0.35 -> ratio ≈ 1.62
    // (comfortably between 1.4 and the new 2.5 ceiling — sanity check the
    // ceiling doesn't eat the legitimate positive case)
    const result = assessDepreciation(100_000, 35_000, 12)
    expect(result?.note).toContain('pegang nilai')
  })

  it('returns the steep-depreciation note for genuinely poor retention', () => {
    // age 5 -> expected = 0.88^5 ≈ 0.5277. retention = 0.30 -> ratio ≈ 0.568
    const result = assessDepreciation(100_000, 30_000, 5)
    expect(result?.note).toContain('Susut nilai curam')
  })

  it('returns the normal-depreciation note for typical retention', () => {
    // age 5 -> expected ≈ 0.5277. retention = 0.50 -> ratio ≈ 0.948 (within 0.65-1.4)
    const result = assessDepreciation(100_000, 50_000, 5)
    expect(result?.note).toBe('Susut nilai biasa untuk kereta umur macam ni.')
  })

  it('still returns null when median >= new price (pre-existing guard)', () => {
    expect(assessDepreciation(50_000, 50_000, 5)).toBeNull()
    expect(assessDepreciation(50_000, 60_000, 5)).toBeNull()
  })

  it('still returns null for out-of-range ages (pre-existing guard)', () => {
    expect(assessDepreciation(100_000, 50_000, 1)).toBeNull()
    expect(assessDepreciation(100_000, 50_000, 26)).toBeNull()
  })

  it('still returns null for non-positive prices (pre-existing guard)', () => {
    expect(assessDepreciation(0, 50_000, 5)).toBeNull()
    expect(assessDepreciation(100_000, 0, 5)).toBeNull()
  })
})
