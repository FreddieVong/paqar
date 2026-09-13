import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatMalayDate, formatMalayDateTime, formatMalayMonthYear } from '@/lib/format-date-my'

/**
 * Every date a Malaysian buyer reads must be a Malaysian date.
 *
 * ── THE BUG THIS PINS ──────────────────────────────────────────────────────
 *
 * A real customer paid for a report at 05:46 on 12 September, Kuala Lumpur
 * time. Their report says "Dijana: 11 Sep 2026". BuyerReportContent formatted
 * the date with `getDate()` on a server whose clock is UTC (Vercel), and at
 * that hour UTC is still on yesterday. lib/email/receipt.ts had already been
 * fixed for the identical defect with an explicit timeZone; the report page
 * had not, and neither had the admin queue, which showed the release at 00:41
 * instead of 08:41.
 *
 * The suite runs with TZ=UTC (package.json) so this fails on the naive code
 * wherever it is run. On a developer machine set to +08 the naive code happens
 * to be right, which is exactly why the defect shipped.
 */

// The real purchase: 2026-09-11T21:46:11Z is 2026-09-12 05:46 in Kuala Lumpur.
const CUSTOMER_PAID_AT = '2026-09-11T21:46:11.452+00:00'
const CUSTOMER_RELEASED_AT = '2026-09-12T00:41:20.877+00:00'

describe('formatMalayDate', () => {
  it('dates the real customer\'s report to the day they paid, in Malaysia', () => {
    expect(formatMalayDate(CUSTOMER_PAID_AT)).toBe('12 Sep 2026')
  })

  it('rolls the day at Malaysian midnight, not UTC midnight', () => {
    expect(formatMalayDate('2026-09-11T15:59:59Z')).toBe('11 Sep 2026')
    expect(formatMalayDate('2026-09-11T16:00:00Z')).toBe('12 Sep 2026')
  })

  it('rolls the month and the year at Malaysian midnight too', () => {
    expect(formatMalayDate('2026-08-31T16:00:00Z')).toBe('1 Sep 2026')
    expect(formatMalayDate('2026-12-31T16:00:00Z')).toBe('1 Jan 2027')
  })

  it('keeps the Malay month names the report has always used', () => {
    // "Ogos" and "Mac" and "Dis" — not ICU's "Ogo", "Mac", "Dis" mix, and not English.
    expect(formatMalayDate('2026-08-15T04:00:00Z')).toBe('15 Ogos 2026')
    expect(formatMalayDate('2026-03-15T04:00:00Z')).toBe('15 Mac 2026')
    expect(formatMalayDate('2026-05-15T04:00:00Z')).toBe('15 Mei 2026')
    expect(formatMalayDate('2026-12-15T04:00:00Z')).toBe('15 Dis 2026')
  })

  it('returns an empty string for an unparseable value so callers can skip the label', () => {
    expect(formatMalayDate('not a date')).toBe('')
    expect(formatMalayDate('')).toBe('')
  })

  it('accepts a Date as well as an ISO string', () => {
    expect(formatMalayDate(new Date(CUSTOMER_PAID_AT))).toBe('12 Sep 2026')
  })
})

describe('formatMalayDateTime', () => {
  it('shows the release at the hour the reviewer actually pressed the button', () => {
    expect(formatMalayDateTime(CUSTOMER_RELEASED_AT)).toBe('12 Sep 08:41')
  })

  it('never renders a 24:xx hour', () => {
    // 16:00Z is exactly 00:00 KL — the case where hourCycle bugs surface.
    expect(formatMalayDateTime('2026-09-11T16:00:00Z')).toBe('12 Sep 00:00')
  })

  it('renders a dash for a missing value', () => {
    expect(formatMalayDateTime(null)).toBe('—')
    expect(formatMalayDateTime(undefined)).toBe('—')
  })
})

describe('formatMalayMonthYear', () => {
  it('rolls the month at Malaysian midnight', () => {
    expect(formatMalayMonthYear('2026-08-31T16:00:00Z')).toBe('Sep 2026')
    expect(formatMalayMonthYear('2026-08-31T15:59:59Z')).toBe('Ogos 2026')
  })

  it('returns an empty string for an unparseable value', () => {
    expect(formatMalayMonthYear('nope')).toBe('')
  })
})

/**
 * The helper only fixes the bug if the surfaces use it. Each of these files
 * rendered a date on the server with the process timezone; none may define its
 * own month table or call getDate()/toLocale*String without a timeZone again.
 */
describe('no buyer- or operator-facing surface formats a date in the server timezone', () => {
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const SURFACES = [
    'components/report/BuyerReportContent.tsx',
    'components/report/JomCheckSection.tsx',
    'lib/offer-snapshot.ts',
    'lib/market-price-format.ts',
    'app/dashboard/page.tsx',
    'app/admin/review/page.tsx',
    'app/admin/jomcheck/page.tsx',
    'app/admin/receipts/page.tsx',
  ]

  for (const file of SURFACES) {
    it(`${file} formats through lib/format-date-my`, () => {
      const src = stripComments(readFileSync(file, 'utf8'))
      expect(src, 'must import the shared formatter').toContain("from '@/lib/format-date-my'")
      expect(src, 'must not keep a private month table').not.toMatch(/'Ogos'/)
      expect(src, 'must not read calendar fields in process time').not.toMatch(/\.getDate\(\)/)
      // toLocale*String without an explicit timeZone is the same bug in
      // different clothing: Vercel is UTC.
      expect(src, 'must not print a UTC ISO slice as a date').not.toMatch(/toISOString\(\)\.slice\(0, 1[06]\)/)
      for (const m of src.matchAll(/toLocale(?:Date|Time)?String\('ms-MY'[\s\S]*?\)/g)) {
        expect(m[0], `${file}: ${m[0]}`).toContain('timeZone')
      }
    })
  }
})
