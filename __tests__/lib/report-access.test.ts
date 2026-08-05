import { describe, it, expect } from 'vitest'
import { buildBuyerReportAccessUrl, describeAccessFailure } from '@/lib/report-access'

// app/laporan-pembeli/[checkId]/page.tsx accepts a request only when
// ?claim_token= matches checks.claim_token, or a signed-in user owns the check.
// Verified live on production: the bare URL returns 404. A receipt carrying a
// tokenless link would therefore hand a paying customer a 404.

describe('buildBuyerReportAccessUrl', () => {
  it('builds a tokenised URL when both values are present', () => {
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc123', claimToken: 'tok-1' }))
      .toBe('https://paqar.my/laporan-pembeli/ch_abc123?claim_token=tok-1')
  })

  it('returns null without a token, rather than a bare URL', () => {
    // The whole point: no link beats a 404 link.
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc123' })).toBeNull()
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc123', claimToken: null })).toBeNull()
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc123', claimToken: undefined })).toBeNull()
  })

  it('returns null for an empty or whitespace token', () => {
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc', claimToken: '' })).toBeNull()
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc', claimToken: '   ' })).toBeNull()
  })

  it('rejects stringified null/undefined', () => {
    // `${undefined}` in a template literal is how claim_token=undefined was born.
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc', claimToken: 'undefined' })).toBeNull()
    expect(buildBuyerReportAccessUrl({ checkId: 'ch_abc', claimToken: 'null' })).toBeNull()
  })

  it('returns null without a check id', () => {
    expect(buildBuyerReportAccessUrl({ checkId: '', claimToken: 'tok' })).toBeNull()
    expect(buildBuyerReportAccessUrl({ checkId: '  ', claimToken: 'tok' })).toBeNull()
  })

  it('URL-encodes the token', () => {
    const url = buildBuyerReportAccessUrl({ checkId: 'ch_a', claimToken: 'a b&c=d' })!
    expect(url).toContain('claim_token=a%20b%26c%3Dd')
    expect(url).not.toContain('a b&c=d')
  })

  it('never emits undefined, null or an empty token in any output', () => {
    const inputs = [
      { checkId: 'ch_1', claimToken: 'tok' },
      { checkId: 'ch_2', claimToken: crypto.randomUUID() },
    ]
    for (const i of inputs) {
      const url = buildBuyerReportAccessUrl(i)!
      expect(url).not.toMatch(/claim_token=(undefined|null)?(&|$)/)
      expect(url).toMatch(/^https:\/\/paqar\.my\/laporan-pembeli\/[^?]+\?claim_token=.+$/)
    }
  })

  it('uses the shared site URL constant', () => {
    expect(buildBuyerReportAccessUrl({ checkId: 'c', claimToken: 't' }))
      .toMatch(/^https:\/\/paqar\.my\//)
  })
})

describe('describeAccessFailure', () => {
  it('names the reason without leaking the token', () => {
    expect(describeAccessFailure({ checkId: 'ch_1' })).toBe('missing_claim_token')
    expect(describeAccessFailure({ checkId: '', claimToken: 't' })).toBe('missing_check_id')
    expect(describeAccessFailure({ checkId: 'ch_1', claimToken: 'secret-token' })).toBeNull()
  })

  it('returns a fixed vocabulary safe to store in receipt_last_error', () => {
    const reason = describeAccessFailure({ checkId: 'ch_1', claimToken: null })
    expect(['missing_check_id', 'missing_claim_token']).toContain(reason)
    expect(reason).not.toContain('secret')
  })
})
