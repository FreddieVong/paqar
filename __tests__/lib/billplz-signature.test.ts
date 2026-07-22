// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

// Mock env before importing billplz
vi.mock('@/lib/env', () => ({
  env: {
    BILLPLZ_X_SIGNATURE_KEY: 'test-x-signature-key',
    BILLPLZ_API_KEY: 'test-api-key',
    BILLPLZ_COLLECTION_ID: 'test-collection',
  },
}))

const TEST_KEY = 'test-x-signature-key'

// Import after mocking env
import { buildSignatureSourceString, buildRedirectSignatureSource, verifyWebhookSignature, extractRedirectSignatureParams, verifyRedirectSignature } from '@/lib/billplz'

describe('Billplz Signature Functions', () => {
  describe('buildSignatureSourceString', () => {
    it('webhook example: produces exact Billplz literal', () => {
      const result = buildSignatureSourceString({
        amount: '100',
        collection_id: 'yhx5t1pp',
        due_at: '2018-9-27',
      })
      expect(result).toBe('amount100|collection_idyhx5t1pp|due_at2018-9-27')
    })

    it('handles empty values', () => {
      const result = buildSignatureSourceString({
        a: 'x',
        b: '',
      })
      expect(result).toBe('ax|b')
    })

    it('sorts case-insensitively', () => {
      const result = buildSignatureSourceString({
        Z: 'z',
        a: 'a',
        M: 'm',
      })
      expect(result).toBe('aa|Mm|Zz')
    })
  })

  describe('concat-then-sort construction (the Billplz rule)', () => {
    it('sorts concatenated key+value strings, so paid_at precedes paid', () => {
      // THE critical regression: '_' (0x5F) < 't' (0x74), so "paid_at2018..."
      // sorts before "paidtrue". A key-only sort puts paid first — that bug
      // rejected every real Billplz signature in production.
      const result = buildSignatureSourceString({
        paid: 'true',
        paid_at: '2018-09-27 15:15:09 +0800',
        paid_amount: '100',
      })
      expect(result).toBe('paid_amount100|paid_at2018-09-27 15:15:09 +0800|paidtrue')
    })

    it('reproduces Billplz\'s documented redirect signature with their sample key', () => {
      // Verbatim from support.billplz.com/api — sample key + expected signature.
      const source = buildRedirectSignatureSource({
        billplzid: 'zq0tm2wc',
        billplzpaid: 'true',
        billplzpaid_at: '2018-09-27 15:15:09 +0800',
      })
      expect(source).toBe('billplzidzq0tm2wc|billplzpaid_at2018-09-27 15:15:09 +0800|billplzpaidtrue')
      const sig = createHmac('sha256', 'S-s7b4yWpp9h7rrkNM1i3Z_g').update(source).digest('hex')
      expect(sig).toBe('4aab095fe5a39b1d534500988f9a0cb085cd1b6d5bbb55dd4e02ea6fa102b47b')
    })

    it('matches the real production payment ground truth (bill 3bc6ba628d0ba087)', () => {
      const result = buildRedirectSignatureSource({
        billplzid: '3bc6ba628d0ba087',
        billplzpaid: 'true',
        billplzpaid_at: '2026-07-22 23:50:42 +0800',
      })
      expect(result).toBe('billplzid3bc6ba628d0ba087|billplzpaid_at2026-07-22 23:50:42 +0800|billplzpaidtrue')
    })

    it('orders the full 12-field callback payload exactly as the doc example', () => {
      // Structure verbatim from Billplz's callback doc example — note
      // paid_amount | paid_at | paid ordering mid-string.
      const result = buildSignatureSourceString({
        id: 'zq0tm2wc', collection_id: 'yhx5t1pp', paid: 'true', state: 'paid',
        amount: '100', paid_amount: '100', due_at: '2018-9-27', email: 'api@billplz.com',
        mobile: '', name: 'TESTER', url: 'http://www.billplz-sandbox.com/bills/zq0tm2wc',
        paid_at: '2018-09-27 15:15:09 +0800',
      })
      expect(result).toBe(
        'amount100|collection_idyhx5t1pp|due_at2018-9-27|emailapi@billplz.com|idzq0tm2wc|mobile|nameTESTER|paid_amount100|paid_at2018-09-27 15:15:09 +0800|paidtrue|statepaid|urlhttp://www.billplz-sandbox.com/bills/zq0tm2wc'
      )
    })
  })

  describe('safeCompareSignature', () => {
    it('returns true for matching 64-char hex signatures', () => {
      const params = { test: 'value' }
      const sig = createHmac('sha256', TEST_KEY).update(buildSignatureSourceString(params)).digest('hex')
      expect(verifyWebhookSignature(params, sig)).toBe(true)
    })

    it('returns false for different signatures', () => {
      const params = { test: 'value' }
      const wrongSig = 'a'.repeat(64)
      expect(verifyWebhookSignature(params, wrongSig)).toBe(false)
    })

    it('returns false for non-hex characters', () => {
      const params = { test: 'value' }
      const invalidSig = 'z'.repeat(64)
      expect(verifyWebhookSignature(params, invalidSig)).toBe(false)
    })

    it('returns false for wrong length', () => {
      const params = { test: 'value' }
      const wrongLength = 'a'.repeat(63)
      expect(verifyWebhookSignature(params, wrongLength)).toBe(false)
    })

    it('never throws on garbage input', () => {
      expect(() => {
        verifyWebhookSignature({ test: 'value' }, 'not a signature at all')
      }).not.toThrow()
    })
  })

  describe('verifyWebhookSignature', () => {
    it('returns true for valid webhook signature', () => {
      const params = { amount: '100', collection_id: 'yhx5t1pp' }
      const sig = createHmac('sha256', TEST_KEY).update(buildSignatureSourceString(params)).digest('hex')
      expect(verifyWebhookSignature(params, sig)).toBe(true)
    })

    it('returns false if signature is missing', () => {
      const params = { amount: '100' }
      expect(verifyWebhookSignature(params, '')).toBe(false)
    })

    it('returns false if value is tampered', () => {
      const params = { amount: '100', collection_id: 'yhx5t1pp' }
      const sig = createHmac('sha256', TEST_KEY).update(buildSignatureSourceString(params)).digest('hex')
      const tamperedParams = { amount: '200', collection_id: 'yhx5t1pp' }
      expect(verifyWebhookSignature(tamperedParams, sig)).toBe(false)
    })
  })

  describe('extractRedirectSignatureParams', () => {
    it('extracts all billplz[...] params except x_signature', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[paid]': 'true',
        'billplz[x_signature]': 'abcd1234',
        other_param: 'ignored',
      }
      const result = extractRedirectSignatureParams(params)
      expect(result).toEqual({
        billplzid: 'zq0tm2wc',
        billplzpaid: 'true',
      })
    })

    it('handles %5B...%5D encoded brackets', () => {
      const params = {
        'billplz%5Bid%5D': 'zq0tm2wc',
        'billplz%5Bx_signature%5D': 'sig',
      }
      const result = extractRedirectSignatureParams(params)
      expect(result).toEqual({
        billplzid: 'zq0tm2wc',
      })
    })

    it('retains empty-string values', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[optional_field]': '',
      }
      const result = extractRedirectSignatureParams(params)
      expect(result).toEqual({
        billplzid: 'zq0tm2wc',
        billplzoptional_field: '',
      })
    })

    it('rejects array values (malformed repeated params)', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[repeated]': ['val1', 'val2'],
      }
      const result = extractRedirectSignatureParams(params)
      expect(result).toBeNull()
    })

    it('ignores undefined values', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[missing]': undefined,
      }
      const result = extractRedirectSignatureParams(params)
      expect(result).toEqual({
        billplzid: 'zq0tm2wc',
      })
    })

    it('dynamically includes any billplz[...] field present', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[paid]': 'true',
        'billplz[transaction_id]': 'tx123',
        'billplz[transaction_status]': 'completed',
        'billplz[custom_future_field]': 'some_value',
      }
      const result = extractRedirectSignatureParams(params)
      expect(result).toEqual({
        billplzid: 'zq0tm2wc',
        billplzpaid: 'true',
        billplztransaction_id: 'tx123',
        billplztransaction_status: 'completed',
        billplzcustom_future_field: 'some_value',
      })
    })
  })

  describe('verifyRedirectSignature', () => {
    it('returns verified params for valid redirect signature', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[paid]': 'true',
        'billplz[paid_at]': '2018-09-27 15:15:09 +0800',
      }
      const sourceParams = {
        billplzid: 'zq0tm2wc',
        billplzpaid: 'true',
        billplzpaid_at: '2018-09-27 15:15:09 +0800',
      }
      const sig = createHmac('sha256', TEST_KEY).update(buildRedirectSignatureSource(sourceParams)).digest('hex')
      const fullParams = { ...params, 'billplz[x_signature]': sig }
      const result = verifyRedirectSignature(fullParams)
      expect(result).toEqual(sourceParams)
    })

    it('returns null if signature is missing', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[paid]': 'true',
      }
      const result = verifyRedirectSignature(params)
      expect(result).toBeNull()
    })

    it('returns null if signature is invalid', () => {
      const params = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[paid]': 'true',
        'billplz[x_signature]': 'a'.repeat(64),
      }
      const result = verifyRedirectSignature(params)
      expect(result).toBeNull()
    })

    it('returns null if billplz[id] is tampered', () => {
      const sourceParams = {
        billplzid: 'zq0tm2wc',
        billplzpaid: 'true',
      }
      const sig = createHmac('sha256', TEST_KEY).update(buildRedirectSignatureSource(sourceParams)).digest('hex')
      const tamperedParams = {
        'billplz[id]': 'different_id',
        'billplz[paid]': 'true',
        'billplz[x_signature]': sig,
      }
      const result = verifyRedirectSignature(tamperedParams)
      expect(result).toBeNull()
    })

    it('returns null if billplz[paid] is tampered', () => {
      const sourceParams = {
        billplzid: 'zq0tm2wc',
        billplzpaid: 'true',
      }
      const sig = createHmac('sha256', TEST_KEY).update(buildRedirectSignatureSource(sourceParams)).digest('hex')
      const tamperedParams = {
        'billplz[id]': 'zq0tm2wc',
        'billplz[paid]': 'false',
        'billplz[x_signature]': sig,
      }
      const result = verifyRedirectSignature(tamperedParams)
      expect(result).toBeNull()
    })
  })
})
