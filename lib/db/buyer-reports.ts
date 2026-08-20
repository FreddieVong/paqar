import { createServiceClient } from '@/lib/supabase/server'
import type { BuyerReport }    from '@/types/domain'

export async function createBuyerReport(params: {
  checkId:          string
  buyerEmail:       string
  billplzBillId:    string
  /** Billplz returns the payment URL once, at creation. Stored so a repeat
   *  checkout can hand back the SAME payable bill (migration 029). */
  billplzBillUrl?:  string | null
  buyerPhone?:      string | null
  amountCents:      number
  addJomCheck?:     boolean
  askingPriceRm?:   number
  claimedMileageKm?: number
  listingUrl?:      string
}): Promise<BuyerReport> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .insert({
      check_id:            params.checkId,
      buyer_email:         params.buyerEmail,
      billplz_bill_id:     params.billplzBillId,
      billplz_bill_url:    params.billplzBillUrl ?? null,
      // Migration 026 added this column so an abandoned checkout can be
      // followed up on WhatsApp. It was accepted as a parameter but never
      // written, so every row was NULL and the whole feature was a no-op on
      // Paqar's side — the number reached Billplz and nothing else.
      buyer_phone:         params.buyerPhone ?? null,
      amount_cents:        params.amountCents,
      add_jomcheck:        params.addJomCheck ?? false,
      jomcheck_status:     'not_requested',
      asking_price_rm:     params.askingPriceRm ?? null,
      claimed_mileage_km:  params.claimedMileageKm ?? null,
      listing_url:         params.listingUrl ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as BuyerReport
}

/**
 * THE report for a check — the one that carries the entitlement.
 *
 * A paid row always wins, whatever its age. This used to take the newest row
 * outright, which is only the same thing while a check has at most one report,
 * and nothing guarantees that: an abandoned checkout, a retry, or a second tab
 * all leave a `pending` row behind. A pending row created AFTER a payment then
 * masked the paid one, and every consumer reads entitlement off this:
 *
 *   the report page        isPaid = false  -> the paywall, shown to a customer
 *                                             who has already paid
 *   initiateJomCheckUpgrade "Laporan belum dibayar"
 *   the asking-price PATCH  404
 *
 * So one stray pending row locked a paying customer out of what they bought.
 *
 * Among paid rows the newest wins, which is the RM12 -> RM100 case: the later
 * purchase is the larger entitlement.
 */
export async function getBuyerReport(checkId: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('check_id', checkId)
    .order('created_at', { ascending: false })
    // Bounded rather than 1: the decision needs to see the pending rows in
    // order to look past them. A check accumulating more than this is itself a
    // signal worth noticing, not a case worth paginating.
    .limit(10)
  if (error && error.code !== 'PGRST116') throw error

  const rows = (data ?? []) as BuyerReport[]
  return rows.find(r => r.status === 'paid') ?? rows[0] ?? null
}

// Returns true if this call was the one that transitioned pending→paid.
// Using .eq('status','pending') makes the update atomic — only one caller wins.
export async function markReportPaid(billplzBillId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      status:     'paid',
      paid_at:    new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('billplz_bill_id', billplzBillId)
    .eq('status', 'pending')
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function getUserBuyerReports(userId: string): Promise<Array<{
  report:         BuyerReport
  plateEncrypted: string | null
}>> {
  const supabase = createServiceClient()

  const { data: checks, error: checksError } = await supabase
    .from('checks')
    .select('id, plate_encrypted')
    .eq('user_id', userId)

  if (checksError) throw checksError
  if (!checks?.length) return []

  const checkIds = checks.map(c => c.id as string)

  const { data: reports, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .in('check_id', checkIds)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(10)

  if (error) throw error

  return (reports ?? []).map(r => ({
    report:         r as BuyerReport,
    plateEncrypted: (checks.find(c => c.id === r.check_id)?.plate_encrypted as string | null) ?? null,
  }))
}

export async function setVehicleApiData(reportId: string, data: unknown): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({ vehicleapi_data: data, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw error
}

export async function checkHasPaidReport(checkId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('buyer_reports')
    .select('id')
    .eq('check_id', checkId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function updateAskingPrice(reportId: string, askingPriceRm: number): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({ asking_price_rm: askingPriceRm, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw error
}

export async function getBuyerReportByBillId(billId: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('billplz_bill_id', billId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as BuyerReport | null
}

// ── JomCheck add-on upgrade (+RM88 on an existing paid RM12 report) ──────────

/**
 * Records the outstanding upgrade bill AND the URL needed to return to it.
 *
 * The URL is the whole point. Billplz hands it over once, at creation, and it
 * was being discarded — so a buyer who abandoned the payment page could only be
 * given a NEW bill, which overwrote this column and orphaned the old one while
 * it stayed payable at Billplz. Keeping the URL lets a retry hand back the same
 * bill, so only one upgrade bill can ever be outstanding per report.
 */
export async function setUpgradeBillId(
  reportId: string, billId: string, billUrl?: string | null,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({
      upgrade_bill_id:  billId,
      upgrade_bill_url: billUrl ?? null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', reportId)
  if (error) throw error
}

/**
 * Grants the upgrade entitlement by REPORT id rather than by bill id.
 *
 * The reconciliation path. markUpgradePaid matches on upgrade_bill_id, which is
 * exactly what a superseded bill no longer matches, so a bill created before
 * migration 028 can still be paid and land nowhere. The webhook resolves such a
 * bill through checkout_attributions — one durable, UNIQUE row per bill — and
 * finishes here.
 *
 * Same atomic guard as markUpgradePaid: `.eq('add_jomcheck', false)` means one
 * winner between a duplicate webhook, a retry and the redirect page. Returns
 * true only for the call that actually flipped it.
 */
export async function markUpgradePaidByReportId(reportId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      add_jomcheck:         true,
      upgrade_paid_at:      now,
      upgrade_amount_cents: 8800,
      updated_at:           now,
    })
    .eq('id', reportId)
    .eq('add_jomcheck', false)
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function getBuyerReportByUpgradeBillId(billId: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('upgrade_bill_id', billId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as BuyerReport | null
}

// Returns true if this call flipped add_jomcheck false→true (atomic — one winner
// between the webhook and the redirect page, mirroring markReportPaid).
// The +RM88 upgrade previously recorded only add_jomcheck=true — no amount and
// no timestamp — so upgrade revenue had no row-level record and could not be
// assigned to a reporting day. Both are now written atomically with the flag.
export async function markUpgradePaid(billId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('buyer_reports')
    .update({
      add_jomcheck:         true,
      upgrade_paid_at:      now,
      upgrade_amount_cents: 8800,
      updated_at:           now,
    })
    .eq('upgrade_bill_id', billId)
    .eq('add_jomcheck', false)
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// ── Receipt delivery state ────────────────────────────────────────────────
//
// waitUntil() keeps the function alive; it does not make delivery observable.
// These record what actually happened so a lost receipt becomes a visible,
// retryable row instead of silence — see migration 026 for why that matters
// (the receipt is the only durable copy of an anonymous buyer's access URL).
//
// Migration 026 is applied in production (2026-08-05), so these columns exist.
// The earlier "swallow everything, assume success" compatibility behaviour has
// been removed: it existed only to survive the window before the schema landed,
// and leaving it in would mean an untracked delivery could masquerade as a
// tracked one.
//
// Writers still do not THROW — a bookkeeping failure must never roll back a
// confirmed payment — but they now report failure to the caller and log it
// loudly with the operation name and safe identifiers.

export type ReceiptStatus = 'pending' | 'sending' | 'sent' | 'failed'

async function updateReceiptState(
  buyerReportId: string,
  patch: Record<string, unknown>,
  op: string,
): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('buyer_reports')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', buyerReportId)
    if (error) throw error
    return true
  } catch (err) {
    console.error(`[receipt-state:${op}]`, { buyerReportId, error: String(err) })
    return false
  }
}

export type ReceiptClaim = 'granted' | 'already_delivered' | 'claim_error'

/**
 * Atomically claim the right to send. This IS the idempotency mechanism:
 * `.not('receipt_status','in','("sending","sent")')` means only one caller can
 * transition a row, so a duplicate Billplz callback, a webhook racing the
 * browser return, or a double-clicked retry cannot each send a receipt.
 *
 * On an unexpected DB error it returns 'claim_error' and does NOT grant the
 * send. It used to fail OPEN and return true, which quietly turned a database
 * problem into duplicate customer email while still calling itself idempotent.
 * Now the caller surfaces the error and an operator retries deliberately.
 */
export async function claimReceiptSend(buyerReportId: string): Promise<ReceiptClaim> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('buyer_reports')
      .update({ receipt_status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', buyerReportId)
      // An ALLOWLIST, not a denylist. `NOT IN ('sending','sent')` looks
      // equivalent but is not: receipt_status is NULL on every new purchase
      // (the column has no default), and SQL three-valued logic makes
      // `NULL NOT IN (...)` evaluate to NULL — so the row matched nothing, the
      // claim was refused as "already delivered", and no receipt was ever sent.
      // Verified in production on 2026-08-05 after a real RM12 purchase
      // produced receipt_status = NULL and no Paqar receipt.
      .or('receipt_status.is.null,receipt_status.in.(pending,failed)')
      .select('id')
    if (error) throw error
    return (data?.length ?? 0) > 0 ? 'granted' : 'already_delivered'
  } catch (err) {
    console.error('[receipt-state:claim] FAILED — send withheld', {
      op: 'receipt_claim', buyerReportId, error: String(err),
    })
    return 'claim_error'
  }
}

/** Returns false when the state could NOT be recorded — the caller must not
 *  report a tracked delivery in that case. */
export async function markReceiptSent(buyerReportId: string): Promise<boolean> {
  return updateReceiptState(buyerReportId, {
    receipt_status:     'sent',
    receipt_sent_at:    new Date().toISOString(),
    receipt_last_error: null,
  }, 'sent')
}

/** `reason` must already be safe: no token, no address, no credentials. */
export async function markReceiptFailed(buyerReportId: string, reason: string): Promise<boolean> {
  let attempts = 1
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('buyer_reports').select('receipt_attempts').eq('id', buyerReportId).single()
    attempts = ((data?.receipt_attempts as number | null) ?? 0) + 1
  } catch { /* fall back to 1 */ }

  return updateReceiptState(buyerReportId, {
    receipt_status:     'failed',
    receipt_attempts:   attempts,
    receipt_last_error: reason.slice(0, 300),
  }, 'failed')
}

/** Operational queue: paid purchases whose receipt did not land. */
export async function getUndeliveredReceipts(limit = 50): Promise<BuyerReport[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('status', 'paid')
    .or('receipt_status.is.null,receipt_status.eq.failed,receipt_status.eq.pending')
    .order('paid_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as BuyerReport[]
}

export async function getBuyerReportById(id: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports').select('*').eq('id', id).single()
  if (error && error.code !== 'PGRST116') throw error
  return data as BuyerReport | null
}

/**
 * The outstanding, still-unpaid base bill for this check, if one exists.
 *
 * WHY
 *
 * initiateBuyerReport minted a fresh Billplz bill on every attempt. Two real
 * external buyers did this in production: one check produced 2 bills 87
 * seconds apart, another produced 3 across about 4 minutes. None were paid, so
 * nobody was charged twice — but each extra bill is independently payable, and
 * a buyer holding several live payment links is a double-payment surface that
 * only luck has kept closed.
 *
 * MATCHED ON AMOUNT, deliberately. A buyer who first chose RM12 and then chose
 * the RM100 bundle must NOT be handed back the RM12 bill; that would take less
 * money than the product they asked for. A differing amount falls through to a
 * new bill.
 *
 * Only `pending` rows are considered. A paid row is handled earlier and much
 * more bluntly by checkHasPaidReport.
 *
 * Rows predating migration 029 have an id but no URL. They cannot be reused —
 * there is no way to rebuild a Billplz URL without guessing their format — so
 * they fall through to a replacement, exactly as before this change. Their old
 * bill keeps its own row, so a late payment still reconciles through
 * getBuyerReportByBillId.
 */
export async function getReusableBaseBill(
  checkId: string,
  amountCents: number,
): Promise<{ id: string; billId: string; billUrl: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('buyer_reports')
    .select('id, billplz_bill_id, billplz_bill_url')
    .eq('check_id', checkId)
    .eq('status', 'pending')
    .eq('amount_cents', amountCents)
    .not('billplz_bill_id', 'is', null)
    .not('billplz_bill_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = data?.[0]
  if (!row?.billplz_bill_id || !row?.billplz_bill_url) return null
  return {
    id:      String(row.id),
    billId:  String(row.billplz_bill_id),
    billUrl: String(row.billplz_bill_url),
  }
}

/**
 * Write the stable purchaser identity, once, when payment completes.
 *
 * Guarded on `purchaser_id IS NULL` so a resent webhook cannot rewrite an
 * identity that history already depends on. Best-effort by design: failing to
 * record an analytics identifier must never fail a payment the buyer has
 * already made.
 */
export async function setPurchaserIdentity(
  buyerReportId: string,
  id: string,
  version: number,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({ purchaser_id: id, purchaser_id_version: version })
    .eq('id', buyerReportId)
    .is('purchaser_id', null)
  if (error) throw error
}
