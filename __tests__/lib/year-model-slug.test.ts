import { describe, it, expect } from 'vitest'
import { parseSlug, MIN_MODEL_YEAR, maxModelYear } from '@/lib/year-model-slug'

// Fixed "now" so the upper-bound tests don't drift with the real clock.
const NOW = new Date('2026-07-23T00:00:00Z')

describe('parseSlug', () => {
  it('parses a valid model-year slug', () => {
    expect(parseSlug('myvi-2021', NOW)).toEqual({ modelKey: 'myvi', year: '2021' })
  })

  it('keeps hyphenated model keys intact', () => {
    // 'hr-v' is a real MODEL_MAP key — the greedy (.+) must not eat the model's own hyphen
    expect(parseSlug('hr-v-2022', NOW)).toEqual({ modelKey: 'hr-v', year: '2022' })
  })

  it('rejects a slug with no year', () => {
    expect(parseSlug('myvi', NOW)).toBeNull()
  })

  it('rejects a non-4-digit year', () => {
    expect(parseSlug('myvi-21', NOW)).toBeNull()
    expect(parseSlug('myvi-20215', NOW)).toBeNull()
  })

  it('rejects undefined', () => {
    expect(parseSlug(undefined, NOW)).toBeNull()
  })

  // The actual bug: an unbounded year made ~10,000 crawlable 200-responses
  // per model, every one a force-dynamic request doing a Supabase query and
  // rendering the same empty fallback.
  it('rejects implausibly old years', () => {
    expect(parseSlug('myvi-1899', NOW)).toBeNull()
    expect(parseSlug('myvi-0000', NOW)).toBeNull()
    expect(parseSlug('myvi-1979', NOW)).toBeNull()
  })

  it('rejects far-future years', () => {
    expect(parseSlug('myvi-9999', NOW)).toBeNull()
    expect(parseSlug('myvi-3000', NOW)).toBeNull()
    expect(parseSlug('myvi-2099', NOW)).toBeNull()
  })

  it('accepts the exact boundaries', () => {
    expect(parseSlug(`myvi-${MIN_MODEL_YEAR}`, NOW)).toEqual({ modelKey: 'myvi', year: String(MIN_MODEL_YEAR) })
    const max = maxModelYear(NOW)
    expect(parseSlug(`myvi-${max}`, NOW)).toEqual({ modelKey: 'myvi', year: String(max) })
  })

  it('rejects one year past the upper boundary', () => {
    expect(parseSlug(`myvi-${maxModelYear(NOW) + 1}`, NOW)).toBeNull()
  })

  it('allows next model year (announced ahead of the calendar year)', () => {
    expect(parseSlug('myvi-2027', NOW)).toEqual({ modelKey: 'myvi', year: '2027' })
  })

  it('upper bound only ever grows, so previously-valid URLs stay valid', () => {
    const later = new Date('2030-01-01T00:00:00Z')
    expect(parseSlug('myvi-2027', later)).not.toBeNull()
    expect(maxModelYear(later)).toBeGreaterThan(maxModelYear(NOW))
  })
})
