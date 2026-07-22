export interface PurchaseInfo {
  transactionId: string
  valueRm: number
  itemId: string
  itemName: string
}

const JOMCHECK_UPGRADE_VALUE_RM  = 88.00
const JOMCHECK_UPGRADE_ITEM_ID   = 'claim_check_upgrade'
const JOMCHECK_UPGRADE_ITEM_NAME = 'Semakan Accident/Claim (Upgrade)'
const BASE_REPORT_ITEM_ID        = 'buyer_report'
const BASE_REPORT_ITEM_NAME      = 'Laporan Pembeli'
const COMBINED_ITEM_ID           = 'buyer_report_claim_check'
const COMBINED_ITEM_NAME         = 'Laporan Pembeli + Semakan Accident/Claim'

interface ReportRow        { check_id: string; amount_cents: number; add_jomcheck: boolean; status: string; buyer_email: string }
interface UpgradeReportRow { check_id: string; add_jomcheck: boolean; buyer_email: string }

// Step 1: which transaction (if any) does this billId resolve to, and does it
// actually belong to the route's checkId? Database-driven — never trusts the
// Paqar-owned `upgrade=1` URL flag to decide the path.
export type TransactionMatch =
  | { kind: 'normal';  report: ReportRow }
  | { kind: 'upgrade'; upgradeReport: UpgradeReportRow }
  | { kind: 'not_found' }
  | { kind: 'ambiguous' }        // billId matched both tables — should never happen with real Billplz IDs; fail safe
  | { kind: 'checkid_mismatch' } // matched a real transaction, but for a different check

export function resolveTransactionMatch(params: {
  checkId:       string
  report:        ReportRow | null
  upgradeReport: UpgradeReportRow | null
}): TransactionMatch {
  if (params.report && params.upgradeReport) return { kind: 'ambiguous' }
  const transaction = params.report ?? params.upgradeReport
  if (!transaction) return { kind: 'not_found' }
  if (transaction.check_id !== params.checkId) return { kind: 'checkid_mismatch' }
  return params.report ? { kind: 'normal', report: params.report } : { kind: 'upgrade', upgradeReport: params.upgradeReport! }
}

// Step 2: given a bound, matched transaction, is it actually paid, and what
// product/value does it represent? Handles the Promise.all read/write race:
// wasJustPaid/wasJustUpgraded (true only if THIS request's own atomic UPDATE
// won) covers "I just paid it"; the freshly-read row covers "already paid
// before I got here" (webhook won first). Either is sufficient.
export function derivePurchaseInfo(params: {
  billId:          string
  isUpgradeBranch: boolean
  wasJustPaid:     boolean
  wasJustUpgraded: boolean
  upgradeReport:   UpgradeReportRow | null
  report:          ReportRow | null
}): PurchaseInfo | null {
  if (params.isUpgradeBranch) {
    const verifiedPaid = params.wasJustUpgraded || params.upgradeReport?.add_jomcheck === true
    if (!verifiedPaid || !params.upgradeReport) return null
    return { transactionId: params.billId, valueRm: JOMCHECK_UPGRADE_VALUE_RM, itemId: JOMCHECK_UPGRADE_ITEM_ID, itemName: JOMCHECK_UPGRADE_ITEM_NAME }
  }

  const verifiedPaid = params.wasJustPaid || params.report?.status === 'paid'
  if (!verifiedPaid || !params.report) return null
  return {
    transactionId: params.billId,
    valueRm: params.report.amount_cents / 100,
    itemId:   params.report.add_jomcheck ? COMBINED_ITEM_ID   : BASE_REPORT_ITEM_ID,
    itemName: params.report.add_jomcheck ? COMBINED_ITEM_NAME : BASE_REPORT_ITEM_NAME,
  }
}
