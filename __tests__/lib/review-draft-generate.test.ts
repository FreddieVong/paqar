import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildReviewDraftFacts } from '@/lib/review-draft/facts'
import { validateDraftOutput } from '@/lib/review-draft/validate'
import { generateReviewDraft, type ModelComplete } from '@/lib/review-draft/generate'

const { envState } = vi.hoisted(() => ({ envState: {} as { ANTHROPIC_API_KEY?: string } }))
vi.mock('@/lib/env', () => ({ env: envState }))

/**
 * The model writes the words; it does not get to choose the facts.
 *
 * Every figure in the draft must already be in the facts object, every year
 * must be one of the two the order carries, and the copy rules the rest of
 * the product is tested against (seller not penjual, deposit not booking,
 * never a tampering claim) apply here before a reviewer ever sees the text.
 * A draft that breaks any of these is dropped, not "fixed": the box stays
 * empty and the reviewer writes it, which is what happened before.
 */
const exora = {
  report: {
    id: 'br_1', check_id: 'ch_1',
    asking_price_rm: 28_999, claimed_mileage_km: 37_000, jomcheck_status: null,
    vehicleapi_data: { make: 'PROTON', model: 'EXORA', registrationYear: '2019', description: 'PROTON EXORA PREMIUM', valuation: { variant: 'EXORA PREMIUM' } },
  },
  check: {
    brand: 'Proton', model: 'Exora', year: '2020', plate_encrypted: 'enc',
    listing_url: 'https://www.mudah.my/2020-exora-1-6-premium-38k-km-115701988.htm', buyer_concern: 'Mileage rendah sangat, betul ke?',
  },
  prices: {
    label: 'Proton Exora 2019', median: 24_400, min: 21_000, max: 28_800, fullMin: 11_900, fullMax: 29_800,
    count: 14, gapFromMedian: 4_599, cheaperThanAsking: 12, mixedVariants: false, market: 'used' as const,
    variantOptions: [], variantApplied: null,
  },
  now: new Date('2026-09-12T02:00:00Z'),
}
const facts = buildReviewDraftFacts(exora)

const good = {
  note: 'Iklan kata 2020 tapi rekod JPJ kata didaftar 2019 — tanya seller kenapa. Harga RM28,999 di atas julat biasa RM21,000–RM28,800. Boleh shortlist, tapi minta rekod servis untuk sokong mileage 37,000 km. Target RM22,000–RM24,000, dan buat inspection sebelum bayar deposit.',
  finalDecision: 'Agak mahal — tawar dulu sebelum setuju.',
  nextAction: 'Tanya seller tahun sebenar, kemudian minta rekod servis.',
  sellerQuestions: ['Iklan tulis 2020 tapi geran 2019 — yang mana betul?', 'Ada rekod servis penuh untuk sokong 37,000 km?'],
}

describe('validateDraftOutput', () => {
  it('accepts a draft that only uses the order\'s own figures and years', () => {
    expect(validateDraftOutput(good, facts)).toEqual({ ok: true, value: good })
  })

  it('rejects an RM figure the facts do not contain', () => {
    const r = validateDraftOutput({ ...good, note: 'Harga tengah RM30,000 — mahal.' }, facts)
    expect(r).toMatchObject({ ok: false })
    expect((r as { reasons: string[] }).reasons.join()).toMatch(/invented_figure.*30,000/)
  })

  it('rejects a year the order does not carry', () => {
    const r = validateDraftOutput({ ...good, note: 'Kereta ini model 2021, bukan 2020.' }, facts)
    expect((r as { reasons: string[] }).reasons.join()).toMatch(/invented_year.*2021/)
  })

  it.each([
    ['penjual',  'Tanya penjual tentang servis.'],
    ['booking',  'Jangan bayar booking dulu.'],
    ['diputar',  'Meter mungkin diputar.'],
    ['dipusing', 'Meter mungkin dipusing balik.'],
    ['percuma',  'Semakan ini percuma.'],
    ['dijamin',  'Harga ini dijamin berbaloi.'],
    ['kami sahkan', 'Kami sahkan mileage ini betul.'],
  ])('rejects the phrase "%s"', (phrase, note) => {
    const r = validateDraftOutput({ ...good, note }, facts)
    expect((r as { reasons: string[] }).reasons.join()).toMatch(new RegExp(`forbidden_phrase.*${phrase}`))
  })

  it('rejects a note that runs past six sentences', () => {
    const r = validateDraftOutput({ ...good, note: 'Satu. Dua. Tiga. Empat. Lima. Enam. Tujuh.' }, facts)
    expect((r as { reasons: string[] }).reasons.join()).toMatch(/too_long/)
  })

  it('rejects more than three seller questions', () => {
    const r = validateDraftOutput({ ...good, sellerQuestions: ['a?', 'b?', 'c?', 'd?'] }, facts)
    expect(r.ok).toBe(false)
  })

  it('rejects an empty note — the box is required for a reason', () => {
    expect(validateDraftOutput({ ...good, note: '   ' }, facts).ok).toBe(false)
  })
})

describe('generateReviewDraft', () => {
  const complete = vi.fn<ModelComplete>()
  beforeEach(() => { vi.clearAllMocks(); envState.ANTHROPIC_API_KEY = 're_x' })

  it('hands the model the issues and the figures, and marks the listing text untrusted', async () => {
    complete.mockResolvedValue(good)
    await generateReviewDraft(exora, { complete })
    const req = complete.mock.calls[0]![0]
    expect(req.user).toContain('Iklan kata 2020, tapi rekod JPJ kata kereta ini didaftar 2019')
    expect(req.user).toContain('RM28,999')
    expect(req.user).toContain('RM24,400')
    expect(req.user).toContain('RM22,000')
    expect(req.user).toContain('Mileage rendah sangat, betul ke?')
    // The ad URL and the buyer's own words are data, never instructions.
    expect(req.user).toMatch(/UNTRUSTED[\s\S]*mudah\.my/)
    expect(req.system).toMatch(/seller/)
    expect(req.system).toMatch(/deposit/)
  })

  it('returns a draft whose issues and corrections come from code, not the model', async () => {
    complete.mockResolvedValue(good)
    const r = await generateReviewDraft(exora, { complete })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.draft.issues.map(i => i.code)).toEqual(['year_mismatch', 'price_above_range', 'mileage_low'])
    expect(r.draft.corrections).toEqual({ year: '2019' })
    expect(r.draft.note).toBe(good.note)
    expect(r.draft.sellerQuestions).toHaveLength(2)
    expect(r.draft.model).toBe('claude-opus-5')
    expect(r.draft.version).toBe(1)
  })

  it('drops a draft the validator rejects rather than showing it', async () => {
    complete.mockResolvedValue({ ...good, note: 'Tanya penjual. Harga tengah RM30,000.' })
    const r = await generateReviewDraft(exora, { complete })
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/^rejected:/) })
  })

  it('reports a missing API key instead of a mysterious failure', async () => {
    delete envState.ANTHROPIC_API_KEY
    const r = await generateReviewDraft(exora, { complete })
    expect(r).toEqual({ ok: false, reason: 'no_api_key' })
    expect(complete).not.toHaveBeenCalled()
  })

  it('reports a model failure without throwing into the caller', async () => {
    complete.mockRejectedValue(new Error('boom'))
    const r = await generateReviewDraft(exora, { complete })
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/^model_failed/) })
  })

  it('still produces the issue list when there is no market data — the reviewer needs it most then', async () => {
    complete.mockResolvedValue({ ...good, note: 'Tiada data harga cukup. Iklan kata 2020 tapi rekod kata 2019 — tanya seller. Minta rekod servis sebelum bayar deposit.', sellerQuestions: [] })
    const r = await generateReviewDraft({ ...exora, prices: null }, { complete })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.draft.issues.map(i => i.code)).toContain('no_market_data')
  })
})
