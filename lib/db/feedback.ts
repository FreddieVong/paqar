import { createServiceClient } from '@/lib/supabase/server'

export async function saveReportFeedback(params: {
  checkId: string
  plate:   string
  helpful: boolean
  quote?:  string
  name?:   string
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('report_feedback').insert({
    check_id: params.checkId,
    plate:    params.plate,
    helpful:  params.helpful,
    quote:    params.quote ?? null,
    name:     params.name  ?? null,
  })
  if (error) throw error
}
