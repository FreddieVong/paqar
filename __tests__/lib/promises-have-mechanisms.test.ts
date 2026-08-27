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
    const crons  = vercel.crons ?? []

    // ONE schedule, because the plan caps them. Six were listed, two were
    // allowed, and the rest silently never ran — including the sweep behind
    // this promise. A single entry cannot exceed any limit.
    expect(crons.length, 'more schedules than a plan may allow').toBe(1)
    expect(crons[0]!.path).toBe('/api/cron/daily')

    // And the sweep must actually be inside it.
    const daily = read('app/api/cron/daily/route.ts')
    expect(daily, 'the daily cron does not run the sweep')
      .toContain("'screenshot-cleanup'")
  })

  it('the sweeper deletes the object before the row, so nothing is orphaned', () => {
    // The CALL sites, not the imports — import order says nothing.
    const src = read('app/api/cron/screenshot-cleanup/route.ts')
    const body = src.slice(src.indexOf('export async function'))
    expect(body.indexOf('await deleteScreenshots('))
      .toBeLessThan(body.indexOf('await markScreenshotsDeleted('))
  })
})

describe('the one daily cron carries every job', () => {
  const daily = read('app/api/cron/daily/route.ts')

  it('runs all six, so none is silently unscheduled', () => {
    for (const job of [
      'screenshot-cleanup', 'check-expiries', 'retarget-model',
      'retarget', 'meta-ads', 'warm-cache',
    ]) expect(daily, `${job} is not in the daily run`).toContain(`'${job}'`)
  })

  it('isolates each job, so one failure does not cost the others', () => {
    expect(daily).toMatch(/try \{[\s\S]*?\} catch/)
  })

  it('still requires the cron secret', () => {
    expect(daily).toContain('CRON_SECRET')
  })

  it('puts the buyer-facing promise first in the sequence', () => {
    const order = ['screenshot-cleanup', 'check-expiries', 'warm-cache']
      .map(j => daily.indexOf(`'${j}',`))
    expect(order[0]).toBeLessThan(order[1]!)
    expect(order[1]).toBeLessThan(order[2]!)
  })
})

describe('a release notification actually leaves the building', () => {
  /**
   * These were bare floating promises in a Server Action. The invocation can be
   * frozen the moment its response is sent, so the fetch to Resend never
   * completed and no email was ever sent — found by releasing a real report and
   * finding nothing in the inbox, while the release itself had worked.
   */
  it('keeps the invocation alive until the mail settles', () => {
    const actions = read('app/admin/review/_actions.ts')
    expect(actions).toContain('waitUntil')
    expect(actions).toContain('notifyInBackground')
  })

  it('leaves no notification floating unawaited', () => {
    const actions = read('app/admin/review/_actions.ts')
    expect(actions).not.toMatch(/notifyBuyer\([^)]*\)\s*\n\s*\.catch/)
    expect(actions).not.toMatch(/sendRefundCompletedEmail\([^)]*\)\s*\n\s*\.catch/)
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

describe('every control can be hit and every word can be read', () => {
  /**
   * Measured on the live site at 390x844: thirteen footer links rendered 18px
   * tall. WCAG 2.5.8 asks for 24px, and a 12px link with no padding cannot
   * reach it. Padding lifts them to 30px without touching the type.
   */
  it('gives footer links a real tap target', () => {
    const bare = /className="font-body text-\[12px\] text-\[#6B7280\] hover:text-\[#3D472F\]/
    const offenders = ['app/page.tsx', 'components/layout/Shell.tsx']
      .filter(f => bare.test(read(f)))
    expect(offenders, `footer links with no vertical padding: ${offenders.join(', ')}`).toEqual([])
  })

  /**
   * #D1D5DB on white is about 1.5:1 — lighter than anything already fixed for
   * contrast, and it was colouring the line that says Paqar is not a
   * government service. Still fine as a placeholder or a bullet glyph.
   */
  it('never sets prose in the lightest grey', () => {
    const bad: string[] = []
    for (const f of ['app/page.tsx', 'components/layout/Shell.tsx']) {
      if (/<p className="[^"]*text-\[#D1D5DB\]/.test(read(f))) bad.push(f)
    }
    expect(bad, `unreadable prose in: ${bad.join(', ')}`).toEqual([])
  })
})

describe('the page has a landmark to skip to', () => {
  /**
   * The landmark and the skip TARGET are deliberately different elements.
   *
   * This asserted `<main id="main-content">` in the root layout, which pinned
   * two defects at once. Shell rendered a second <main> inside that one, so
   * every public page shipped nested main landmarks — invalid, and it makes
   * the landmark useless for navigating by region. And the root <main> wraps
   * the page's <Nav />, so "Terus ke kandungan" jumped to a point ABOVE the
   * navigation: the one thing a skip link exists not to do.
   *
   * The landmark stays in the layout; the id moved to where content actually
   * begins.
   */
  it('the layout owns the one main landmark', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toMatch(/<main>/)
    expect(layout, 'the skip target is back on the landmark, above the nav')
      .not.toContain('<main id="main-content">')
    expect(layout).toContain('href="#main-content"')
    expect(layout).toMatch(/focus:not-sr-only/)
  })

  it('and nothing else renders a second one', () => {
    // Admin pages are excluded: they are behind ADMIN_SECRET, render no Nav
    // and no Shell, and own their own landmark.
    // Comments stripped: the comment explaining why this is a div says the
    // word <main>, and a naive match finds the tag in the note about its own
    // removal. Fourth time this exact trap has bitten in this codebase.
    const shell = read('components/layout/Shell.tsx')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(shell, 'Shell renders a nested <main> again').not.toMatch(/<main[\s>]/)
    expect(shell).toContain('id="main-content"')
  })

  it('the homepage has its own target, since it does not use Shell', () => {
    // It lays out full-bleed sections itself. Without this the skip link lands
    // nowhere on the page most people arrive at.
    expect(read('app/page.tsx')).toContain('id="main-content"')
  })
})

/**
 * The intake card's ground changes with the phase: dark while it IS the call
 * to action, light once it holds content the buyer must read and correct.
 *
 * It was dark for every phase and only the first was restyled, so labels,
 * helper text and buttons rendered near-black on near-black — invisible.
 * Freddie found it on his phone, which is the only place it was visible as a
 * problem, because in source every one of those elements is unremarkable.
 */
describe('nothing renders dark on dark', () => {
  const form = read('components/check/ListingIntakeForm.tsx')

  it('the card only goes dark while it is the call to action', () => {
    expect(form).toContain("const onDark = phase === 'start' || phase === 'working'")
    expect(form, 'the dark ground is applied unconditionally again')
      .not.toMatch(/<div className="bg-\[#3D472F\] rounded-\[18px\]/)
  })

  it('the later phases keep the shared dark-text label class', () => {
    // LABEL_CLS is near-black. It is correct ONLY on a light ground, so its
    // presence is what makes the conditional above load-bearing.
    expect(form).toContain("text-[#111827] mb-1.5")
  })

  it('sets no prose in the lightest grey on white', () => {
    // #9CA3AF is ~2.5:1 on white. Fine for a placeholder, not for words.
    const prose = form.split('\n').filter(l =>
      l.includes('text-[#9CA3AF]') && !l.includes('placeholder:'))
    expect(prose, `low-contrast text: ${prose.join(' | ')}`).toEqual([])
  })

  it('never calls provider data an official record', () => {
    expect(form).not.toMatch(/rekod rasmi/)
    expect(form).toContain('penyedia data pihak ketiga')
  })
})

/**
 * The last block before the pay button led with "Dalam tempoh 24 jam" in bold,
 * and that ceiling was the only number on it. Presented alone it is the worst
 * case — and it misrepresents the product pessimistically: the typical is
 * thirty minutes and the one real review took two.
 *
 * expectedDeliveryCopy already computed the true expected time and was shown
 * only on the waiting screen, AFTER payment, so the reassuring number arrived
 * too late to inform the decision it should have informed.
 */
describe('the wait is quoted honestly in both directions', () => {
  const form = read('components/report/PaymentForm.tsx')

  it('leads with the real expected time, not the ceiling', () => {
    expect(form).toContain('expectedDelivery')
    expect(form, 'the 24-hour ceiling is still the first thing quoted')
      .not.toMatch(/Dalam tempoh\{' '\}\s*<span[^>]*>\{REVIEW_SLA_HOURS\} jam<\/span>/)
  })

  it('still states the guarantee explicitly', () => {
    // Removing it would be the betrayal this block exists to prevent: a buyer
    // discovering a 24-hour ceiling only after paying.
    expect(form).toContain('REVIEW_SLA_HOURS')
    expect(form).toMatch(/Dijamin dalam \{REVIEW_SLA_HOURS\} jam/)
  })

  it('computes the time on the server, so it cannot mismatch on hydration', () => {
    const page = read('app/laporan-pembeli/[checkId]/page.tsx')
    expect(page).toContain('expectedDelivery={expectedDeliveryCopy()}')
    expect(form, 'PaymentForm reads the clock itself')
      .not.toContain('expectedDeliveryCopy(')
  })
})

/**
 * The homepage earns a referral commission on physical inspection and
 * insurance. Those partners used to be promoted two sections below the hero —
 * before the page had said what RM29 buys, before it answered "why not just
 * check Mudah myself", and before it admitted its own limits.
 *
 * That is both a worse funnel and a worse look on a page that makes a point of
 * saying it is not paid by sellers. The proof comes first now.
 */
describe('the homepage proves the product before it monetises the reader', () => {
  const page = read('app/page.tsx')
  const at = (marker: string) => {
    const i = page.indexOf(marker)
    expect(i, `missing homepage section: ${marker}`).toBeGreaterThan(-1)
    return i
  }

  it('what RM29 buys comes before the referral partners', () => {
    expect(at('SATU TEMPAT SEBELUM BELI KERETA')).toBeGreaterThan(at('APA YANG ANDA DAPAT'))
  })

  it('so does the objection, and so do the limits and the refund', () => {
    expect(at('SATU TEMPAT SEBELUM BELI KERETA')).toBeGreaterThan(at('KENAPA TAK SEMAK SENDIRI'))
    expect(at('SATU TEMPAT SEBELUM BELI KERETA')).toBeGreaterThan(at('HAD & JAMINAN'))
  })

  it('and the intake still comes first', () => {
    expect(at('APA YANG ANDA DAPAT')).toBeGreaterThan(at('── HERO ──'))
  })
})
