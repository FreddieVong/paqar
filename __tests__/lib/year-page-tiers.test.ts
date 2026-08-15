// @vitest-environment node
//
// The tier list decides which twelve of 58 pages get the pilot treatment. Its
// failure mode is drift: someone adds a variant guide, the "rule" in the doc
// comment stops describing the list, and the pilot silently changes size
// between the measurement that justified it and the measurement that judges it.
import { describe, it, expect } from 'vitest'
import {
  classifyYearPages,
  isTierAYearPage,
  adjacentYears,
  coveredYearsFor,
} from '@/lib/year-page-tiers'
import { MARKET_COVERAGE } from '@/lib/market-coverage'
import { VARIANT_GUIDES } from '@/lib/variant-guides'

describe('classifyYearPages', () => {
  const all = classifyYearPages()

  it('classifies every covered year page exactly once', () => {
    const expected = MARKET_COVERAGE.reduce((n, m) => n + m.years.length, 0)
    expect(all).toHaveLength(expected)
    expect(all).toHaveLength(58)
    expect(new Set(all.map(c => c.slug)).size).toBe(all.length)
  })

  it('puts twelve pages in the pilot', () => {
    // Fewer would weaken the read; many more would stop being a pilot.
    expect(all.filter(c => c.tier === 'A')).toHaveLength(12)
  })

  it('leaves Tier C empty, deliberately', () => {
    // Every year page answers a distinct query and none has another page to be
    // consolidated into. A tier that exists in the type is not a reason to
    // populate it. See lib/year-page-tiers.ts for the full argument.
    expect(all.filter(c => c.tier === 'C')).toHaveLength(0)
  })

  it('accounts for every page in some tier', () => {
    expect(all.filter(c => c.tier === 'B')).toHaveLength(46)
  })

  it('gives every page a reason', () => {
    for (const c of all) expect(c.reason.length).toBeGreaterThan(20)
  })
})

describe('the Tier A rule still describes the Tier A list', () => {
  // The stated rule: a model is Tier A when it has year pages AND an all-years
  // hub AND a variant guide. This test is the reason the list can be written
  // out explicitly without becoming a lie later.
  it('promotes exactly the models with a hub and a variant guide', () => {
    const byRule = MARKET_COVERAGE
      .filter(m => m.hubSlug && VARIANT_GUIDES[m.hubSlug])
      .map(m => m.yearKey)
      .sort()

    const actual = [...new Set(classifyYearPages().filter(c => c.tier === 'A').map(c => c.yearKey))].sort()

    expect(actual).toEqual(byRule)
  })

  it('names the models the rule selects', () => {
    expect([...new Set(classifyYearPages().filter(c => c.tier === 'A').map(c => c.yearKey))].sort())
      .toEqual(['bezza', 'city', 'myvi'])
  })
})

describe('isTierAYearPage', () => {
  it('accepts pilot models and rejects the rest', () => {
    expect(isTierAYearPage('myvi')).toBe(true)
    expect(isTierAYearPage('bezza')).toBe(true)
    expect(isTierAYearPage('city')).toBe(true)
    expect(isTierAYearPage('saga')).toBe(false)
    expect(isTierAYearPage('civic')).toBe(false)
    expect(isTierAYearPage('nonsense')).toBe(false)
  })
})

describe('adjacentYears', () => {
  it('returns both neighbours in the middle of a run', () => {
    expect(adjacentYears('myvi', '2021')).toEqual({ previous: '2020', next: '2022' })
  })

  it('has no previous at the start of coverage', () => {
    expect(adjacentYears('myvi', '2019')).toEqual({ previous: null, next: '2020' })
  })

  it('has no next at the end of coverage', () => {
    expect(adjacentYears('myvi', '2023')).toEqual({ previous: '2022', next: null })
  })

  it('returns nothing for a year outside coverage', () => {
    // A link to an uncovered year lands the reader on the empty-data fallback,
    // which is worse than no link.
    expect(adjacentYears('myvi', '2015')).toEqual({ previous: null, next: null })
    expect(adjacentYears('nonsense', '2021')).toEqual({ previous: null, next: null })
  })

  it('only ever names years the coverage list keeps warm', () => {
    for (const m of MARKET_COVERAGE) {
      for (const y of m.years) {
        const { previous, next } = adjacentYears(m.yearKey, y)
        if (previous) expect(m.years).toContain(previous)
        if (next)     expect(m.years).toContain(next)
      }
    }
  })
})

describe('coveredYearsFor', () => {
  it('returns ascending years for a covered model', () => {
    expect(coveredYearsFor('myvi')).toEqual(['2019', '2020', '2021', '2022', '2023'])
  })

  it('returns nothing for an unknown model', () => {
    expect(coveredYearsFor('nonsense')).toEqual([])
  })
})
