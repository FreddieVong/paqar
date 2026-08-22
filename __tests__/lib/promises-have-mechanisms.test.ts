import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * Every promise on a public page must have a mechanism behind it.
 *
 * This is the failure mode that keeps recurring, and it is always the same
 * shape: someone writes the copy, defers the machinery, and the copy ships. It
 * has now produced a 30-day retention promise with no sweeper, an accident
 * report that could not be bought, an instant report that always waited, and a
 * Varian box that renamed the car without repricing it.
 */

describe('retention', () => {
  it('the 30-day promise has a scheduled sweeper behind it', () => {
    const privacy = read('app/privasi/page.tsx')
    if (!/30 hari/.test(privacy)) return // promise withdrawn; nothing to enforce

    const vercel = JSON.parse(read('vercel.json')) as { crons?: { path: string }[] }
    const paths  = (vercel.crons ?? []).map(c => c.path)
    expect(paths, 'privasi promises deletion that nothing performs')
      .toContain('/api/cron/screenshot-cleanup')
  })

  it('the sweeper deletes the object before the row, so nothing is orphaned', () => {
    // The CALL sites, not the imports — import order says nothing.
    const src = read('app/api/cron/screenshot-cleanup/route.ts')
    const body = src.slice(src.indexOf('export async function'))
    expect(body.indexOf('await deleteScreenshots('))
      .toBeLessThan(body.indexOf('await markScreenshotsDeleted('))
  })
})

describe('"we will tell you when we can"', () => {
  it('re-runs the real coverage check before claiming it can', () => {
    const cron = read('app/api/cron/retarget-model/route.ts')
    expect(cron).toContain('assessCoverage')
    expect(cron).toContain('sendCoverageReadyEmail')
  })

  it('sends nothing while the answer has not changed', () => {
    const cron = read('app/api/cron/retarget-model/route.ts')
    // The ineligible branch must continue WITHOUT marking the lead sent, or the
    // buyer is silently dropped the first night their car is still uncovered.
    expect(cron).toMatch(/if \(!coverage\.eligible\) continue/)
  })

  it('gives up eventually rather than retrying a car that will never qualify', () => {
    expect(read('app/api/cron/retarget-model/route.ts')).toContain('GIVE_UP_DAYS')
  })

  it('never sends the generic retarget to someone Paqar turned away', () => {
    const cron = read('app/api/cron/retarget-model/route.ts')
    const noCoverageBranch = cron.slice(cron.indexOf('NO_COVERAGE'), cron.indexOf('sendModelRetargetEmail'))
    expect(noCoverageBranch).not.toContain('sendModelRetargetEmail')
  })

  it('the refusal offers the buyer that choice at all', () => {
    const form = read('components/check/ListingIntakeForm.tsx')
    expect(form).toContain('belum boleh bantu')
    expect(form).toContain('requestNotify')
    expect(form).toContain("verdict: 'no_coverage'")
  })
})

describe('disclosure matches what the site actually loads', () => {
  const privacy = read('app/privasi/page.tsx')

  it('names every processor the code uses', () => {
    for (const vendor of ['Supabase', 'Vercel', 'Resend', 'Billplz', 'Anthropic', 'PostHog', 'Google', 'Meta']) {
      expect(privacy.includes(vendor), `/privasi does not name ${vendor}`).toBe(true)
    }
  })

  it('says a human reads the listing, because one does', () => {
    expect(privacy).toMatch(/disemak oleh seorang pekerja|dibaca oleh manusia|Dibaca Oleh Manusia/i)
  })
})

describe('the checkout form is usable without sight', () => {
  /**
   * All four labels closed BEFORE their input and carried no htmlFor, and the
   * inputs carried no id — so nothing associated them. A screen reader
   * announced four unlabelled boxes on the one form where a mistake costs the
   * buyer money, and where the fields (price, mileage, email, phone) are
   * indistinguishable without their labels.
   */
  it('associates every label with its field', () => {
    const src = read('components/report/PaymentForm.tsx')
    for (const id of ['pf-price', 'pf-mileage', 'pf-email', 'pf-phone']) {
      expect(src, `no label for ${id}`).toContain(`htmlFor="${id}"`)
      expect(src, `no input id ${id}`).toContain(`id="${id}"`)
    }
  })

  it('keeps the autofill hints the browser needs', () => {
    const src = read('components/report/PaymentForm.tsx')
    expect(src).toContain('autoComplete="email"')
    expect(src).toContain('autoComplete="tel"')
  })
})

describe('the page has a landmark to skip to', () => {
  it('renders one main landmark and a focusable skip link', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain('<main id="main-content">')
    expect(layout).toContain('href="#main-content"')
    expect(layout).toMatch(/focus:not-sr-only/)
  })
})
