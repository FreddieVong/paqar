import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildComparableCohort } from '@/lib/comparables'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

/**
 * The reviewer and the buyer must be looking at the same cohort.
 *
 * A reviewer approving a decision computed from one set of listings while the
 * buyer reads another is a failure neither of them can see. It happened: the
 * queue showed 13 comparables with a RM49,900 ceiling while the report showed
 * a RM56,980 ceiling for the same car, and only appeared because both numbers
 * were finally on screen at once.
 *
 * The cause was the report passing `year: vehicleData?.registrationYear`,
 * which is NULL for a plateless check — the default journey since migration
 * 032. A null year applies no year filter at all, so a 2019 Honda City was
 * priced against City listings of every year. That lifted the top of the range
 * above the asking price and turned an overpriced car into "WAJAR".
 */
describe('a missing year must never mean "every year"', () => {
  const listings = [
    { price: 40_000, title: 'Honda City 2019 E', year: '2019', url: 'a', mileage: null },
    { price: 42_000, title: 'Honda City 2019 S', year: '2019', url: 'b', mileage: null },
    { price: 43_000, title: 'Honda City 2019 V', year: '2019', url: 'c', mileage: null },
    { price: 44_000, title: 'Honda City 2019 E', year: '2019', url: 'd', mileage: null },
    // A much newer car. It belongs to a different market and must not set the
    // ceiling a 2019 buyer is judged against.
    { price: 78_000, title: 'Honda City 2024 RS', year: '2024', url: 'e', mileage: null },
  ]

  it('filters to the buyer’s year when one is supplied', () => {
    const c = buildComparableCohort(listings, {
      year: '2019', officialVariant: null, model: null, isSpecialVariant: false,
    })
    expect(c.max).toBe(44_000)
    expect(c.count).toBe(4)
  })

  it('and a null year lets the newer car in — which is why null must not reach it', () => {
    // Documents the behaviour rather than endorsing it: buildComparableCohort
    // is right to apply no filter when it is told nothing. The bug was the
    // CALLER passing null, so the guard belongs at the call site below.
    const c = buildComparableCohort(listings, {
      year: null, officialVariant: null, model: null, isSpecialVariant: false,
    })
    expect(c.max).toBe(78_000)
  })
})

describe('both surfaces resolve the car the same way', () => {
  it('the report and the queue share one resolver', () => {
    expect(read('app/laporan-pembeli/[checkId]/page.tsx')).toContain('resolveCarIdentity')
    expect(read('lib/review-price-context.ts')).toContain('resolveCarIdentity')
  })

  it('the report prefers the resolved year over the plate lookup', () => {
    const report = read('components/report/BuyerReportContent.tsx')
    const call = report.slice(report.indexOf('const cohort           = buildComparableCohort'))
      .slice(0, 400)
    expect(call).toContain('cohortYear   ?? vehicleData?.registrationYear')
    expect(call).toContain('cohortModel  ?? vehicleData?.model')
  })

  it('the resolver refuses to answer rather than returning a null year', () => {
    // Returning a partial identity would put the null back into the cohort by
    // another route.
    const src = read('lib/report-identity.ts')
    expect(src).toContain("if (!brand || !model || !/^\\d{4}$/.test(year)) return null")
  })

  it('the reviewer’s correction picks the cohort on both surfaces', () => {
    const src = read('lib/report-identity.ts')
    // Order of authority: reviewer, then registry, then the check row.
    const brandLine = src.split('\n').find(l => l.includes('const brand ='))!
    expect(brandLine.indexOf('o.brand')).toBeLessThan(brandLine.indexOf('v!.make'))
    expect(brandLine.indexOf('v!.make')).toBeLessThan(brandLine.indexOf('params.check.brand'))
  })
})
