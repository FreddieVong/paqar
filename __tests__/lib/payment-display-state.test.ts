import { describe, it, expect } from 'vitest'
import { resolvePaymentDisplayState } from '@/lib/payment-display-state'

describe('Payment Display State Resolution', () => {
  const validCheckId = 'check-123'
  const differentCheckId = 'check-456'
  const billId = 'bill-xyz'

  describe('verified_paid state', () => {
    it('shows verified_paid when match found, signedPaid true, and row confirms paid', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('verified_paid')
      if (state.state === 'verified_paid') {
        expect(state.purchaseInfo.valueRm).toBe(12.00)
        expect(state.buyerEmail).toBe('test@example.com')
      }
    })

    it('includes correct purchase info for RM100 combined purchase', () => {
      const report = { check_id: validCheckId, amount_cents: 10000, add_jomcheck: true, status: 'paid', buyer_email: 'user@test.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('verified_paid')
      if (state.state === 'verified_paid') {
        expect(state.purchaseInfo.valueRm).toBe(100.00)
        expect(state.purchaseInfo.itemId).toBe('buyer_report_claim_check')
      }
    })

    it('includes upgrade purchase info for RM88 path', () => {
      const upgradeReport = { check_id: validCheckId, add_jomcheck: true, buyer_email: 'user@test.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report: null,
        upgradeReport,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('verified_paid')
      if (state.state === 'verified_paid') {
        expect(state.purchaseInfo.valueRm).toBe(88.00)
        expect(state.purchaseInfo.itemId).toBe('claim_check_upgrade')
      }
    })
  })

  describe('pending_verification state', () => {
    it('shows pending when signedPaid is false', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'pending', buyer_email: 'test@example.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: false,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('pending_verification')
    })

    it('shows pending when signedPaid true but derivePurchaseInfo returns null (edge race)', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'pending', buyer_email: 'test@example.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('pending_verification')
    })
  })

  describe('invalid state', () => {
    it('shows invalid when report not found', () => {
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report: null,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('invalid')
    })

    it('shows invalid when both report and upgradeReport exist (ambiguous)', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const upgradeReport = { check_id: validCheckId, add_jomcheck: true, buyer_email: 'test@example.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report,
        upgradeReport,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('invalid')
    })

    it('shows invalid when checkId does not match (cross-check attack)', () => {
      const report = { check_id: differentCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const state = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state.state).toBe('invalid')
    })

    it('shows invalid regardless of signedPaid value when checkId mismatches', () => {
      const report = { check_id: differentCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const state1 = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: true,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      const state2 = resolvePaymentDisplayState({
        checkId: validCheckId,
        billId,
        signedPaid: false,
        report,
        upgradeReport: null,
        wasJustPaid: false,
        wasJustUpgraded: false,
      })
      expect(state1.state).toBe('invalid')
      expect(state2.state).toBe('invalid')
    })
  })
})
