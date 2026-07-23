import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import type { JomCheckResult, JomCheckStatus } from './index'
import type { BuyerReport } from '@/types/domain'

export interface AdminReportRow {
  report:         BuyerReport
  plateEncrypted: string | null
  claimToken:     string | null
}

async function joinChecks(reports: BuyerReport[]): Promise<AdminReportRow[]> {
  if (!reports.length) return []
  const supabase = createServiceClient()
  const checkIds = [...new Set(reports.map(r => r.check_id))]

  const { data: checks, error } = await supabase
    .from('checks')
    .select('id, plate_encrypted, claim_token')
    .in('id', checkIds)
  if (error) throw error

  return reports.map(r => {
    const check = checks?.find(c => c.id === r.check_id)
    return {
      report:         r,
      plateEncrypted: (check?.plate_encrypted as string | null) ?? null,
      claimToken:     (check?.claim_token as string | null) ?? null,
    }
  })
}

// Manual-fulfillment queue: paid add-on orders the owner still has to fulfil.
export async function listManualPendingReports(): Promise<AdminReportRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('status', 'paid')
    .eq('add_jomcheck', true)
    .not('jomcheck_status', 'in', '("success","failed")')
    .order('paid_at', { ascending: false })
  if (error) throw error
  return joinChecks((data ?? []) as BuyerReport[])
}

// Read-only verification list for the admin page.
export async function listRecentlyFulfilledReports(days = 7): Promise<AdminReportRow[]> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('add_jomcheck', true)
    .eq('jomcheck_status', 'success')
    .gte('jomcheck_checked_at', since)
    .order('jomcheck_checked_at', { ascending: false })
  if (error) throw error
  return joinChecks((data ?? []) as BuyerReport[])
}

export async function getBuyerReportById(reportId: string): Promise<BuyerReport | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('buyer_reports')
    .select('*')
    .eq('id', reportId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as BuyerReport | null
}

export async function setJomCheckStatus(reportId: string, status: JomCheckStatus): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({ jomcheck_status: status, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw error
}

export async function setJomCheckSuccess(reportId: string, data: JomCheckResult): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('buyer_reports')
    .update({
      jomcheck_status:     'success',
      jomcheck_data:       data,
      jomcheck_checked_at: new Date().toISOString(),
      jomcheck_error:      null,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', reportId)
  if (error) throw error
}

export async function setJomCheckFailed(reportId: string, error: string): Promise<void> {
  const supabase = createServiceClient()
  const { error: dbError } = await supabase
    .from('buyer_reports')
    .update({
      jomcheck_status: 'failed',
      jomcheck_error:  error,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', reportId)
  if (dbError) throw dbError
}
