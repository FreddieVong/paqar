import { describe, it, expect } from 'vitest'
import {
  MARKET_COVERAGE,
  coveredYears,
  coveredCombos,
  coveredYearSlugs,
  coveredModelByHub,
} from '@/lib/market-coverage'
import { MODEL_HUB_SLUGS, isModelHubSlug } from '@/lib/model-hubs'

/**
 * The exact ordered year-page slug list app/sitemap.ts emitted BEFORE coverage
 * was centralised, lifted mechanically from the pre-change file rather than
 * retyped. Deriving the sitemap from MARKET_COVERAGE has to be behaviour
 * neutral: any diff here is a change to what Google is told exists.
 */
const SITEMAP_SLUGS_BEFORE_REFACTOR = [
  'myvi-2019', 'myvi-2020', 'myvi-2021', 'myvi-2022', 'myvi-2023',
  'axia-2020', 'axia-2021', 'axia-2022', 'axia-2023',
  'bezza-2020', 'bezza-2021', 'bezza-2022', 'bezza-2023',
  'alza-2021', 'alza-2022', 'alza-2023',
  'ativa-2021', 'ativa-2022', 'ativa-2023',
  'saga-2019', 'saga-2020', 'saga-2021', 'saga-2022', 'saga-2023',
  'persona-2020', 'persona-2021', 'persona-2022',
  'iriz-2019', 'iriz-2020', 'iriz-2021',
  'x50-2021', 'x50-2022', 'x50-2023',
  'x70-2020', 'x70-2021', 'x70-2022',
  'city-2021', 'city-2022', 'city-2023',
  'civic-2020', 'civic-2021', 'civic-2022',
  'hr-v-2021', 'hr-v-2022', 'hr-v-2023',
  'jazz-2018', 'jazz-2019', 'jazz-2020',
  'vios-2020', 'vios-2021', 'vios-2022', 'vios-2023',
  'yaris-2021', 'yaris-2022', 'yaris-2023',
  'almera-2021', 'almera-2022', 'almera-2023',
]

/** The cron's scrape order before COMBINATIONS moved into market-coverage. */
const CRON_ORDER_BEFORE_REFACTOR: [string, string][] = [
  ['Perodua', 'Myvi'], ['Perodua', 'Axia'], ['Perodua', 'Bezza'],
  ['Perodua', 'Alza'], ['Perodua', 'Ativa'],
  ['Proton', 'Saga'], ['Proton', 'Persona'], ['Proton', 'Iriz'],
  ['Proton', 'X50'], ['Proton', 'X70'],
  ['Honda', 'City'], ['Honda', 'Civic'], ['Honda', 'HR-V'], ['Honda', 'Jazz'],
  ['Toyota', 'Vios'], ['Toyota', 'Yaris'],
  ['Nissan', 'Almera'],
]

describe('MARKET_COVERAGE integrity', () => {
  it('names only hub slugs that actually render', () => {
    for (const m of MARKET_COVERAGE) {
      if (m.hubSlug === undefined) continue
      expect(isModelHubSlug(m.hubSlug), `${m.make} ${m.model} → ${m.hubSlug}`).toBe(true)
    }
  })

  it('covers every model hub, so no hub renders a permanently empty table', () => {
    for (const slug of MODEL_HUB_SLUGS) {
      expect(coveredYears(slug), `hub ${slug} has no coverage`).not.toHaveLength(0)
    }
  })

  it('has no duplicate make/model/year combination', () => {
    const keys = coveredCombos().map(c => `${c.make}|${c.model}|${c.year}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no duplicate year-page slug', () => {
    const slugs = coveredYearSlugs()
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has no duplicate hub slug', () => {
    const hubs = MARKET_COVERAGE.map(m => m.hubSlug).filter(Boolean)
    expect(new Set(hubs).size).toBe(hubs.length)
  })

  it('declares no empty year array', () => {
    for (const m of MARKET_COVERAGE) {
      expect(m.years.length, `${m.make} ${m.model}`).toBeGreaterThan(0)
    }
  })

  it('uses four-digit years only', () => {
    for (const m of MARKET_COVERAGE) {
      for (const y of m.years) expect(y, `${m.model} ${y}`).toMatch(/^\d{4}$/)
    }
  })

  it('uses a yearKey that is URL-safe and lowercase', () => {
    for (const m of MARKET_COVERAGE) {
      expect(m.yearKey, m.model).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('coverage consumers stay behaviour-neutral', () => {
  it('emits exactly the sitemap slug list the hand-maintained version did', () => {
    // Full ordered comparison, not a count: a reordering or a swapped year is
    // still a change to the indexed URL set.
    expect(coveredYearSlugs()).toEqual(SITEMAP_SLUGS_BEFORE_REFACTOR)
  })

  it('emits 58 year pages', () => {
    expect(coveredYearSlugs()).toHaveLength(58)
  })

  it('preserves the cron scrape order', () => {
    const seen: [string, string][] = []
    for (const { make, model } of coveredCombos()) {
      const last = seen[seen.length - 1]
      if (!last || last[0] !== make || last[1] !== model) seen.push([make, model])
    }
    expect(seen).toEqual(CRON_ORDER_BEFORE_REFACTOR)
  })

  it('groups every model contiguously, so the cron never revisits a model', () => {
    const order = coveredCombos().map(c => `${c.make}|${c.model}`)
    const firstSeen = new Map<string, number>()
    order.forEach((k, i) => { if (!firstSeen.has(k)) firstSeen.set(k, i) })
    for (const [key, start] of firstSeen) {
      const count = order.filter(k => k === key).length
      expect(order.slice(start, start + count).every(k => k === key), key).toBe(true)
    }
  })
})

describe('coveredModelByHub', () => {
  it('returns the cache keys the cron writes rows under', () => {
    // 'honda-hrv' → make 'Honda', model 'HR-V'. Deriving these from the hub
    // slug instead is what produced 'honda-hr-v' historically.
    expect(coveredModelByHub('honda-hrv')).toMatchObject({ make: 'Honda', model: 'HR-V' })
    expect(coveredModelByHub('perodua-myvi')).toMatchObject({ make: 'Perodua', model: 'Myvi' })
  })

  it('agrees with coveredYears', () => {
    for (const slug of MODEL_HUB_SLUGS) {
      expect(coveredModelByHub(slug)?.years).toEqual(coveredYears(slug))
    }
  })
})
