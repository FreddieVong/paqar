// Variant price ladder query for /varian/[model].
//
// Deliberately NOT in lib/db/vehicle-valuations.ts, and deliberately not using
// lib/supabase/server. That module imports `next/headers`, and pulling
// next/headers into a statically-generated route's render path drops it out of
// static generation entirely — the page still builds and Next still prints the
// SSG marker, but no HTML is emitted and every request becomes a server
// render. /varian/* is prerendered and must stay that way.
//
// Uses the raw supabase-js client instead, the same pattern app/harga-model
// already relies on. No cookies, no request context, safe at build time.

import { createClient } from '@supabase/supabase-js'

export interface VariantLadderQueryResult {
  rows: { variant: string; wm_new_pr: number }[]
  year: string | null
}

const EMPTY: VariantLadderQueryResult = { rows: [], year: null }

/**
 * Rows for the model's most recent model year. The gaps between trims are the
 * useful part and they move slowly within a generation, so the newest year is
 * a fair stand-in for the current ladder.
 *
 * Returns empty rather than throwing — this block is supplementary and the
 * page must render without it.
 */
export async function getVariantLadderRows(
  make: string,
  family: string,
): Promise<VariantLadderQueryResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return EMPTY

  const supabase = createClient(url, key)

  const { data: newest } = await supabase
    .from('vehicle_valuations')
    .select('year')
    .ilike('make', make)
    .ilike('family', family)
    .gt('wm_new_pr', 10_000) // table carries junk RM0/near-zero rows
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  const year = (newest?.year as string | undefined) ?? null
  if (!year) return EMPTY

  const { data } = await supabase
    .from('vehicle_valuations')
    .select('variant, wm_new_pr')
    .ilike('make', make)
    .ilike('family', family)
    .eq('year', year)
    .gt('wm_new_pr', 10_000)

  return { rows: (data ?? []) as { variant: string; wm_new_pr: number }[], year }
}
