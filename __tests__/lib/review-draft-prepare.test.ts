import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const getReportForReview   = vi.fn()
const getCheck             = vi.fn()
const reviewPriceContext   = vi.fn()
const generateReviewDraft  = vi.fn()
const saveReviewDraft      = vi.fn()
const saveReviewDraftError = vi.fn()

vi.mock('@/lib/db/report-review',        () => ({ getReportForReview: (...a: unknown[]) => getReportForReview(...a) }))
vi.mock('@/lib/db/checks',               () => ({ getCheck: (...a: unknown[]) => getCheck(...a) }))
vi.mock('@/lib/review-price-context',    () => ({ reviewPriceContext: (...a: unknown[]) => reviewPriceContext(...a) }))
vi.mock('@/lib/review-draft/generate',   () => ({ generateReviewDraft: (...a: unknown[]) => generateReviewDraft(...a) }))
const intakeExtractedForCheck = vi.fn()
vi.mock('@/lib/db/listing-intake',       () => ({ intakeExtractedForCheck: (...a: unknown[]) => intakeExtractedForCheck(...a) }))
vi.mock('@/lib/db/buyer-reports',        () => ({
  saveReviewDraft:      (...a: unknown[]) => saveReviewDraft(...a),
  saveReviewDraftError: (...a: unknown[]) => saveReviewDraftError(...a),
}))

import { prepareReviewDraft } from '@/lib/review-draft/prepare'

/**
 * The orchestration: load what the queue card loads, generate, store.
 *
 * Runs in the background at payment (so the draft is waiting when the
 * Telegram ping arrives) and on demand from "Jana semula". Both paths must
 * leave a row that says what happened — a draft, or a reason there is none —
 * because a reviewer staring at empty boxes needs to know whether to wait,
 * retry, or just write.
 */
const paidReport = { id: 'br_1', check_id: 'ch_1', status: 'paid', asking_price_rm: 28_999, claimed_mileage_km: 37_000, vehicleapi_data: { registrationYear: '2019' } }
const checkRow   = { check: { id: 'ch_1', brand: 'Proton', model: 'Exora', year: '2020', plate_encrypted: 'enc', listing_url: 'https://mudah.my/x', buyer_concern: null } }
const draft      = { version: 1, generatedAt: 'now', model: 'claude-opus-5', issues: [], corrections: {}, note: 'n', finalDecision: 'd', nextAction: 'a', sellerQuestions: [] }

beforeEach(() => {
  vi.clearAllMocks()
  getReportForReview.mockResolvedValue(paidReport)
  getCheck.mockResolvedValue(checkRow)
  reviewPriceContext.mockResolvedValue({ median: 24_400, min: 21_000, max: 28_800, count: 14 })
  generateReviewDraft.mockResolvedValue({ ok: true, draft })
  saveReviewDraft.mockResolvedValue(true)
  saveReviewDraftError.mockResolvedValue(true)
  intakeExtractedForCheck.mockResolvedValue({ variant: '1.6 Premium', mileageKm: 37_000, askingPriceRm: 28_999 })
})

describe('prepareReviewDraft', () => {
  it('feeds the generator the same report, check and prices the card renders', async () => {
    await prepareReviewDraft('br_1')
    const input = generateReviewDraft.mock.calls[0]![0] as Record<string, unknown>
    expect(input.report).toBe(paidReport)
    expect(input.check).toBe(checkRow.check)
    expect(reviewPriceContext).toHaveBeenCalledWith({ check: checkRow.check, askingPriceRm: 28_999 })
    expect(input.prices).toEqual({ median: 24_400, min: 21_000, max: 28_800, count: 14 })
    // And what the advert itself said, so the draft can compare advert with record.
    expect(intakeExtractedForCheck).toHaveBeenCalledWith('ch_1')
    expect(input.intake).toEqual({ variant: '1.6 Premium', mileageKm: 37_000, askingPriceRm: 28_999 })
  })

  it('stores the draft on the row', async () => {
    const r = await prepareReviewDraft('br_1')
    expect(r).toEqual({ ok: true })
    expect(saveReviewDraft).toHaveBeenCalledWith('br_1', draft)
    expect(saveReviewDraftError).not.toHaveBeenCalled()
  })

  it('stores the reason when the generator declines, so the card can say why', async () => {
    generateReviewDraft.mockResolvedValue({ ok: false, reason: 'rejected: invented_figure: RM30,000' })
    const r = await prepareReviewDraft('br_1')
    expect(r).toEqual({ ok: false, reason: 'rejected: invented_figure: RM30,000' })
    expect(saveReviewDraftError).toHaveBeenCalledWith('br_1', 'rejected: invented_figure: RM30,000')
    expect(saveReviewDraft).not.toHaveBeenCalled()
  })

  it('refuses to draft for a report that is not paid', async () => {
    getReportForReview.mockResolvedValue({ ...paidReport, status: 'pending' })
    const r = await prepareReviewDraft('br_1')
    expect(r).toEqual({ ok: false, reason: 'not_paid' })
    expect(generateReviewDraft).not.toHaveBeenCalled()
  })

  it('still drafts when the price context is unavailable — the issues list says so', async () => {
    reviewPriceContext.mockRejectedValue(new Error('cache miss'))
    await prepareReviewDraft('br_1')
    const input = generateReviewDraft.mock.calls[0]![0] as Record<string, unknown>
    expect(input.prices).toBeNull()
  })

  it('never throws into a webhook', async () => {
    getReportForReview.mockRejectedValue(new Error('db down'))
    await expect(prepareReviewDraft('br_1')).resolves.toMatchObject({ ok: false, reason: expect.stringMatching(/^load_failed/) })
  })
})

describe('wiring', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('the webhook prepares a draft in the background after payment, after the vehicle data is warm', () => {
    const src = strip(readFileSync('app/api/webhooks/billplz/route.ts', 'utf8'))
    expect(src).toContain('prepareReviewDraft')
    // After the warm-up writes the registration year and the market cache —
    // the draft compares against both — and awaited inside that same
    // waitUntil so the runtime keeps the invocation alive for it.
    const afterWarm = src.slice(src.indexOf('fetchAndCacheMarketPrices(apiResult.make'))
    expect(afterWarm).toContain('await prepareReviewDraft(buyerReport.id)')
    // And the no-plate order, which has no warm-up to wait for, still gets one.
    expect(afterWarm).toContain('waitUntil(prepareReviewDraft(buyerReport.id))')
  })

  it('the review card pre-fills every box from the draft and shows the issues', () => {
    const page = strip(readFileSync('app/admin/review/page.tsx', 'utf8'))
    for (const field of ['note', 'finalDecision', 'nextAction', 'sellerQuestions', 'issues', 'corrections']) {
      expect(page, field).toMatch(new RegExp(`draft(?:\\?)?\\.${field}`))
    }
    expect(page).toContain('regenerateDraftAction')
    expect(page).toContain('review_draft_error')
  })

  it('a regenerate action exists and is admin-gated', () => {
    const actions = strip(readFileSync('app/admin/review/_actions.ts', 'utf8'))
    const fn = actions.slice(actions.indexOf('export async function regenerateDraftAction'))
    expect(fn).toContain('isAdminAuthenticated()')
    expect(fn).toContain('prepareReviewDraft')
  })
})
