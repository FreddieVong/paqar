import { createServiceClient } from '@/lib/supabase/server'
import type { BuyerReport }    from '@/types/domain'

export async function createBuyerReport(params: {
  checkId:          string
  buyerEmail:       string
  billplzBillId:    string
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

export async function getBuyerReport(checkId: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('check_id', checkId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as BuyerReport | null
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

export async function setUpgradeBillId(reportId: string, billId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({ upgrade_bill_id: billId, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw error
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
