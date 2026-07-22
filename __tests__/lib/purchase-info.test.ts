import { describe, it, expect } from 'vitest'
import { resolveTransactionMatch, derivePurchaseInfo, type TransactionMatch } from '@/lib/purchase-info'

describe('Transaction Resolution', () => {
  const validCheckId = 'check-123'
  const differentCheckId = 'check-456'

  describe('resolveTransactionMatch', () => {
    it('returns normal when report matches checkId', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const result = resolveTransactionMatch({ checkId: validCheckId, report, upgradeReport: null })
      expect(result).toEqual({ kind: 'normal', report })
    })

    it('returns upgrade when upgradeReport matches checkId', () => {
      const upgradeReport = { check_id: validCheckId, add_jomcheck: true, buyer_email: 'test@example.com' }
      const result = resolveTransactionMatch({ checkId: validCheckId, report: null, upgradeReport })
      expect(result).toEqual({ kind: 'upgrade', upgradeReport })
    })

    it('returns checkid_mismatch when report check_id differs', () => {
      const report = { check_id: differentCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const result = resolveTransactionMatch({ checkId: validCheckId, report, upgradeReport: null })
      expect(result).toEqual({ kind: 'checkid_mismatch' })
    })

    it('returns checkid_mismatch when upgradeReport check_id differs', () => {
      const upgradeReport = { check_id: differentCheckId, add_jomcheck: true, buyer_email: 'test@example.com' }
      const result = resolveTransactionMatch({ checkId: validCheckId, report: null, upgradeReport })
      expect(result).toEqual({ kind: 'checkid_mismatch' })
    })

    it('returns not_found when neither report nor upgradeReport exists', () => {
      const result = resolveTransactionMatch({ checkId: validCheckId, report: null, upgradeReport: null })
      expect(result).toEqual({ kind: 'not_found' })
    })

    it('returns ambiguous when both report and upgradeReport exist', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const upgradeReport = { check_id: validCheckId, add_jomcheck: true, buyer_email: 'test@example.com' }
      const result = resolveTransactionMatch({ checkId: validCheckId, report, upgradeReport })
      expect(result).toEqual({ kind: 'ambiguous' })
    })
  })

  describe('derivePurchaseInfo', () => {
    const billId = 'bill-xyz'

    it('normal path: RM12 base report, status paid', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'paid', buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: false,
        wasJustPaid: false,
        wasJustUpgraded: false,
        upgradeReport: null,
        report,
      })
      expect(result).toEqual({
        transactionId: billId,
        valueRm: 12.00,
        itemId: 'buyer_report',
        itemName: 'Laporan Pembeli',
      })
    })

    it('normal path: RM100 combined report, status paid with add_jomcheck', () => {
      const report = { check_id: validCheckId, amount_cents: 10000, add_jomcheck: true, status: 'paid', buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: false,
        wasJustPaid: false,
        wasJustUpgraded: false,
        upgradeReport: null,
        report,
      })
      expect(result).toEqual({
        transactionId: billId,
        valueRm: 100.00,
        itemId: 'buyer_report_claim_check',
        itemName: 'Laporan Pembeli + Semakan Accident/Claim',
      })
    })

    it('upgrade path: RM88 upgrade, add_jomcheck true', () => {
      const upgradeReport = { check_id: validCheckId, add_jomcheck: true, buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: true,
        wasJustPaid: false,
        wasJustUpgraded: false,
        upgradeReport,
        report: null,
      })
      expect(result).toEqual({
        transactionId: billId,
        valueRm: 88.00,
        itemId: 'claim_check_upgrade',
        itemName: 'Semakan Accident/Claim (Upgrade)',
      })
    })

    it('normal path: returns null if status is not paid and wasJustPaid false', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'pending', buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: false,
        wasJustPaid: false,
        wasJustUpgraded: false,
        upgradeReport: null,
        report,
      })
      expect(result).toBeNull()
    })

    it('normal path: handles race where wasJustPaid true but row still pending', () => {
      const report = { check_id: validCheckId, amount_cents: 1200, add_jomcheck: false, status: 'pending', buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: false,
        wasJustPaid: true,
        wasJustUpgraded: false,
        upgradeReport: null,
        report,
      })
      expect(result).toEqual({
        transactionId: billId,
        valueRm: 12.00,
        itemId: 'buyer_report',
        itemName: 'Laporan Pembeli',
      })
    })

    it('upgrade path: returns null if add_jomcheck false and wasJustUpgraded false', () => {
      const upgradeReport = { check_id: validCheckId, add_jomcheck: false, buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: true,
        wasJustPaid: false,
        wasJustUpgraded: false,
        upgradeReport,
        report: null,
      })
      expect(result).toBeNull()
    })

    it('upgrade path: handles race where wasJustUpgraded true but row shows false', () => {
      const upgradeReport = { check_id: validCheckId, add_jomcheck: false, buyer_email: 'test@example.com' }
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: true,
        wasJustPaid: false,
        wasJustUpgraded: true,
        upgradeReport,
        report: null,
      })
      expect(result).toEqual({
        transactionId: billId,
        valueRm: 88.00,
        itemId: 'claim_check_upgrade',
        itemName: 'Semakan Accident/Claim (Upgrade)',
      })
    })

    it('normal path: returns null if report is null', () => {
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: false,
        wasJustPaid: true,
        wasJustUpgraded: false,
        upgradeReport: null,
        report: null,
      })
      expect(result).toBeNull()
    })

    it('upgrade path: returns null if upgradeReport is null', () => {
      const result = derivePurchaseInfo({
        billId,
        isUpgradeBranch: true,
        wasJustPaid: false,
        wasJustUpgraded: true,
        upgradeReport: null,
        report: null,
      })
      expect(result).toBeNull()
    })
  })
})
