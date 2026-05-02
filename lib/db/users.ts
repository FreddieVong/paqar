import { createServiceClient } from '@/lib/supabase/server'

export async function getUserById(id: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.auth.admin.getUserById(id)
  return data.user ?? null
}
