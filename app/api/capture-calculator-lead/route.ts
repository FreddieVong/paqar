import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { sendCalculationEmail } from '@/lib/email/calculation'

const schema = z.object({
  email:         z.string().email().max(200),
  priceRm:       z.number().int().min(1000).max(2_000_000),
  depositRm:     z.number().int().min(0).max(2_000_000),
  monthlyRm:     z.number().int().min(1).max(100_000),
  totalInterest: z.number().int().min(0).max(2_000_000),
  years:         z.number().int().min(1).max(9),
  ratePct:       z.number().min(0).max(15),
  roadTaxRm:     z.number().int().min(0).max(10_000).nullable().optional(),
  insLowRm:      z.number().int().min(0).max(100_000).nullable().optional(),
  insHighRm:     z.number().int().min(0).max(100_000).nullable().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const p = parsed.data

  const supabase = createServiceClient()
  const { error } = await supabase.from('calculator_leads').insert({
    email:      p.email.trim().toLowerCase(),
    price_rm:   p.priceRm,
    monthly_rm: p.monthlyRm,
  })
  if (error) console.error('[capture-calculator-lead]', error)

  // Send the calculation regardless of insert outcome — the email is the value
  sendCalculationEmail({
    toEmail:       p.email.trim(),
    priceRm:       p.priceRm,
    depositRm:     p.depositRm,
    monthlyRm:     p.monthlyRm,
    totalInterest: p.totalInterest,
    years:         p.years,
    ratePct:       p.ratePct,
    roadTaxRm:     p.roadTaxRm,
    insLowRm:      p.insLowRm,
    insHighRm:     p.insHighRm,
  }).catch(err => console.error('[calculation-email]', err))

  return NextResponse.json({ ok: true })
}
