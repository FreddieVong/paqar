import { derivePurchaseInfo, resolveTransactionMatch, type PurchaseInfo } from './purchase-info'

export type PaymentDisplayState =
  | { state: 'verified_paid'; purchaseInfo: PurchaseInfo; buyerEmail?: string }
  | { state: 'pending_verification' }
  | { state: 'invalid' }

export function resolvePaymentDisplayState(params: {
  checkId:         string
  billId:          string
  signedPaid:      boolean   // billplz[paid] === 'true', read ONLY from verified redirect params by the caller
  report:          { check_id: string; amount_cents: number; add_jomcheck: boolean; status: string; buyer_email: string } | null
  upgradeReport:   { check_id: string; add_jomcheck: boolean; buyer_email: string } | null
  wasJustPaid:     boolean
  wasJustUpgraded: boolean
}): PaymentDisplayState {
  const match = resolveTransactionMatch({ checkId: params.checkId, report: params.report, upgradeReport: params.upgradeReport })

  if (match.kind === 'not_found' || match.kind === 'ambiguous' || match.kind === 'checkid_mismatch') {
    return { state: 'invalid' }
  }
  if (!params.signedPaid) {
    return { state: 'pending_verification' }
  }

  const purchaseInfo = derivePurchaseInfo({
    billId:          params.billId,
    isUpgradeBranch: match.kind === 'upgrade',
    wasJustPaid:     params.wasJustPaid,
    wasJustUpgraded: params.wasJustUpgraded,
    upgradeReport:   params.upgradeReport,
    report:          params.report,
  })

  if (!purchaseInfo) return { state: 'pending_verification' }

  const buyerEmail = match.kind === 'normal' ? match.report.buyer_email : match.upgradeReport.buyer_email
  return { state: 'verified_paid', purchaseInfo, buyerEmail }
}
