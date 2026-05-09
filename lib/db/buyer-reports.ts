import { createServiceClient } from '@/lib/supabase/server'
import type { BuyerReport }    from '@/types/domain'

export async function createBuyerReport(params: {
  checkId:          string
  buyerEmail:       string
  billplzBillId:    string
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
      amount_cents:        1900,
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

export async function markReportPaid(billplzBillId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({
      status:     'paid',
      paid_at:    new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('billplz_bill_id', billplzBillId)
  if (error) throw error
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
