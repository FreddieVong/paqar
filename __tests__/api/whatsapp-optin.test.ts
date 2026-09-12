// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getCheck       = vi.fn()
const getBuyerReport = vi.fn()
const setBuyerPhone  = vi.fn()

vi.mock('@/lib/db/checks',        () => ({ getCheck: (...a: unknown[]) => getCheck(...a) }))
vi.mock('@/lib/db/buyer-reports', () => ({
  getBuyerReport: (...a: unknown[]) => getBuyerReport(...a),
  setBuyerPhone:  (...a: unknown[]) => setBuyerPhone(...a),
}))

import { POST } from '@/app/api/laporan-pembeli/[checkId]/whatsapp/route'

/**
 * The buyer's "WhatsApp me when it's ready" opt-in, on the waiting screen.
 *
 * Same authorization as every other report-page write: the claim token must
 * open the check, and the report must be paid. A number is accepted only when
 * it is confidently a Malaysian mobile (the same rule Billplz checkout uses),
 * and is stored normalised so the operator's wa.me button always works.
 */
const req = (checkId: string, body: unknown) =>
  new NextRequest(`http://localhost/api/laporan-pembeli/${checkId}/whatsapp`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
const params = { params: { checkId: 'ch_1' } }

beforeEach(() => {
  vi.clearAllMocks()
  getCheck.mockResolvedValue({ check: { id: 'ch_1' } })
  getBuyerReport.mockResolvedValue({ id: 'br_1', status: 'paid' })
  setBuyerPhone.mockResolvedValue(true)
})

describe('POST /api/laporan-pembeli/[checkId]/whatsapp', () => {
  it('stores a normalised number and echoes it back in display form', async () => {
    const res = await POST(req('ch_1', { claimToken: 'tok', phone: '012-345 6789' }), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, phone: '012-345 6789' })
    expect(setBuyerPhone).toHaveBeenCalledWith('br_1', '60123456789')
  })

  it('accepts the international form too', async () => {
    const res = await POST(req('ch_1', { claimToken: 'tok', phone: '+60 11 2345 6789' }), params)
    expect(res.status).toBe(200)
    expect(setBuyerPhone).toHaveBeenCalledWith('br_1', '601123456789')
  })

  it('rejects a landline or nonsense with a message the buyer can act on', async () => {
    const res = await POST(req('ch_1', { claimToken: 'tok', phone: '03-1234 5678' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/012-345 6789/)
    expect(setBuyerPhone).not.toHaveBeenCalled()
  })

  it('answers 400, not 500, when the phone is not even a string', async () => {
    const res = await POST(req('ch_1', { claimToken: 'tok', phone: 123456789 }), params)
    expect(res.status).toBe(400)
    expect(setBuyerPhone).not.toHaveBeenCalled()
  })

  it('refuses without a valid claim token', async () => {
    getCheck.mockResolvedValue(null)
    const res = await POST(req('ch_1', { claimToken: 'wrong', phone: '0123456789' }), params)
    expect(res.status).toBe(401)
    expect(setBuyerPhone).not.toHaveBeenCalled()
  })

  it('refuses for a report that is not paid', async () => {
    getBuyerReport.mockResolvedValue({ id: 'br_1', status: 'pending' })
    const res = await POST(req('ch_1', { claimToken: 'tok', phone: '0123456789' }), params)
    expect(res.status).toBe(404)
    expect(setBuyerPhone).not.toHaveBeenCalled()
  })

  it('reports a storage failure honestly rather than showing a tick', async () => {
    setBuyerPhone.mockResolvedValue(false)
    const res = await POST(req('ch_1', { claimToken: 'tok', phone: '0123456789' }), params)
    expect(res.status).toBe(500)
  })
})
