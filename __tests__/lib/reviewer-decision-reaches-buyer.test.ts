import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * The reviewer's JUDGEMENT is the product. It has to reach the buyer.
 *
 * Three override fields — finalDecision, nextAction, sellerQuestions — were
 * collected from the release form, validated, written to reviewed_overrides,
 * and read by nothing. So a reviewer who disagreed with the draft typed their
 * decision, pressed release, and the buyer received the machine's verdict
 * under a note saying a person had decided.
 *
 * That produced a real report in testing where the human note read "RM52,000
 * tinggi untuk City 2018 ... jangan bayar deposit" while the decision card
 * directly above it said "WAJAR — Teruskan". Two opposite decisions on one
 * screen, in the product whose entire premise is that a person checked it.
 *
 * This is the third time a module was built, tested and never called
 * (see wired-not-just-built), so these assertions are about the WIRING, not
 * the parsing — the parsing already had passing tests while nothing read it.
 */
describe('what the reviewer decides is what the buyer reads', () => {
  const page   = read('app/laporan-pembeli/[checkId]/page.tsx')
  const report = read('components/report/BuyerReportContent.tsx')
  const admin  = read('app/admin/review/page.tsx')

  it.each([
    ['finalDecision',   'reviewerDecision'],
    ['nextAction',      'reviewerNextAction'],
    ['sellerQuestions', 'reviewerSellerQuestions'],
  ])('%s is passed to the report as %s', (override, prop) => {
    expect(page, `${override} never leaves reviewed_overrides`).toContain(`overrides.${override}`)
    expect(page).toContain(`${prop}={`)
    expect(report, `${prop} is accepted but never rendered`).toContain(prop)
  })

  it('every override the parser accepts has an input a reviewer can type into', () => {
    // A read with no write is the mirror of the original bug: sellerQuestions
    // was parsed and stored by the action, with no field on the form.
    const parser = read('lib/reviewed-overrides.ts')
    // Scoped to the interface. Reading the whole file also picked up
    // applyOverrides' own parameter named `overrides`.
    const iface = parser.slice(
      parser.indexOf('export interface ReviewedOverrides'),
      parser.indexOf('const TEXT_FIELDS'),
    )
    const keys = [...iface.matchAll(/^\s{2}(\w+)\??:/gm)].map(m => m[1]!)
      // A checkbox, not a typed field — asserted separately by its own name.
      .filter(k => k !== 'suppressMileageWarning')
    expect(keys.length, 'no override keys found — the guard would be vacuous')
      .toBeGreaterThan(5)
    for (const k of keys) {
      // Either a raw input (override_x) or the <Override name="x"> helper,
      // which prefixes the name itself.
      const present = admin.includes(`override_${k}`) || admin.includes(`<Override name="${k}"`)
      expect(present, `no admin input writes ${k}`).toBe(true)
    }
  })

  it('the human decision REPLACES the machine verdict rather than joining it', () => {
    // Two verdicts on one screen is worse than either alone: the buyer cannot
    // tell which one a person stood behind.
    const i = report.indexOf('if (reviewerDecision)')
    const j = report.indexOf('const kepConfig')
    expect(i, 'no reviewer-decision branch').toBeGreaterThan(-1)
    expect(i, 'the machine verdict is built before the human override can win').toBeLessThan(j)
    // And it returns, so the machine card cannot also render.
    expect(report.slice(i, j)).toContain('return (')
  })

  it('the reviewer’s questions come before the generic ones', () => {
    // The generic five are what any assistant writes. The reviewer's were
    // written after reading THIS advert, so they lead.
    const merged = report.slice(report.indexOf('const reviewerQuestions'))
    const spread = merged.slice(0, merged.indexOf('allQuestions.map'))
    expect(spread).toMatch(/\[\s*\.\.\.reviewerQuestions,\s*\.\.\.generic\s*\]/)
  })
})

describe('a plateless check is a first-class buyer', () => {
  const page   = read('app/laporan-pembeli/[checkId]/page.tsx')
  const report = read('components/report/BuyerReportContent.tsx')

  it('the paid report finds comparables without a plate lookup', () => {
    // Gated on vehicleData?.make, "PERBANDINGAN HARGA" rendered as a heading
    // with nothing under it for every plateless buyer — the section RM29 is
    // sold on — while the free coverage check had just told them Paqar had
    // enough ads for this car.
    // Anchored on the declaration, not the import of MarketPricePoller which
    // sits at the top of the file and made this slice empty.
    // The identity resolver now owns this, shared with the reviewer's queue so
    // the two surfaces cannot compute different cohorts for one car.
    expect(page).toContain('resolveCarIdentity({ check: row.check, vehicleData, overrides })')
    const identity = read('lib/report-identity.ts')
    expect(identity, 'the check row must be the floor').toContain('params.check.brand')
    expect(identity, 'the check row must be the floor').toContain('params.check.year')
    expect(identity, 'the reviewer’s corrections must pick the cohort').toContain('o.year')
    // And the report must actually use it, rather than the plate lookup alone.
    const report = read('components/report/BuyerReportContent.tsx')
    expect(report).toContain('cohortYear   ?? vehicleData?.registrationYear')
  })

  it('does not claim a plate lookup failed when no plate was given', () => {
    expect(report).toContain('plateSupplied && !vehicleData?.make')
  })

  it('shows the market spinner only when a refresh is genuinely in flight', () => {
    // Otherwise an unidentifiable car spins for ever on a page already paid for.
    expect(page).toContain('marketRefreshStarted')
    expect(page).not.toContain('active={!!vehicleData?.make && !marketPrices}')
  })

  it('mounts no plate-dependent teaser without a plate', () => {
    expect(page).toContain('{plate && <VehiclePreviewTeaser')
  })
})
