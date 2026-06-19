import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import type { JomCheckResult, JomCheckStatus } from './index'

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
