import { createServiceClient } from '@/lib/supabase/server'
import type { SellerTrustCard } from '@/types/domain'

export async function createTrustCard(params: {
  checkId:       string
  sellerEmail:   string
  publicToken:   string
  billplzBillId: string
  platePlain:    string
}): Promise<SellerTrustCard> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('seller_trust_cards')
    .insert({
      check_id:        params.checkId,
      seller_email:    params.sellerEmail,
      public_token:    params.publicToken,
      billplz_bill_id: params.billplzBillId,
      amount_cents:    2900,
      plate_plain:     params.platePlain,
    })
    .select()
    .single()
  if (error) throw error
  return data as SellerTrustCard
}

export async function getTrustCardByToken(token: string): Promise<SellerTrustCard | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('seller_trust_cards')
    .select('*')
    .eq('public_token', token)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as SellerTrustCard | null
}

export async function getTrustCardByBillId(billId: string): Promise<SellerTrustCard | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('seller_trust_cards')
    .select('*')
    .eq('billplz_bill_id', billId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as SellerTrustCard | null
}

export async function getUserTrustCards(userId: string): Promise<SellerTrustCard[]> {
  const supabase = createServiceClient()

  const { data: checks, error: checksError } = await supabase
    .from('checks')
    .select('id')
    .eq('user_id', userId)

  if (checksError) throw checksError
  if (!checks?.length) return []

  const checkIds = checks.map(c => c.id as string)

  const { data: cards, error } = await supabase
    .from('seller_trust_cards')
    .select('*')
    .in('check_id', checkIds)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(10)

  if (error) throw error
  return (cards ?? []) as SellerTrustCard[]
}

export async function markTrustCardPaid(billplzBillId: string): Promise<void> {
  const supabase = createServiceClient()
  const now     = new Date()
  const expires = new Date(now)
  expires.setDate(expires.getDate() + 30)
  const { error } = await supabase
    .from('seller_trust_cards')
    .update({
      status:     'paid',
      paid_at:    now.toISOString(),
      expires_at: expires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('billplz_bill_id', billplzBillId)
  if (error) throw error
}
