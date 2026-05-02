import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
import { z }         from 'zod'
import { phoneSchema } from '@/lib/validation/phone'

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, '1 h'),
  prefix:  'paqar:otp',
  timeout: 1000,
})

const schema = z.object({ phone: phoneSchema })

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
  }

  let rateLimitResult: { success: boolean; remaining?: number }
  try {
    rateLimitResult = await ratelimit.limit(parsed.data.phone)
  } catch {
    rateLimitResult = { success: true }
  }

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'OTP rate limit exceeded', remaining: 0 },
      { status: 429 }
    )
  }

  return NextResponse.json({ ok: true, remaining: rateLimitResult.remaining ?? 3 })
}
