import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { getExpiriesOnDate }         from '@/lib/db/document-expiries'
import { sendExpiryNotification }    from '@/lib/email/expiry-notification'
import { decrypt }                   from '@/lib/crypto'
import { env }                       from '@/lib/env'
import type { DocType }              from '@/types/domain'

const NOTIFICATION_DAYS = [1, 7, 30, 60, 90] as const

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

export async function GET(request: NextRequest) {
  const auth          = request.headers.get('authorization')
  const expectedToken = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null

  if (expectedToken && auth !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today    = new Date()
  today.setHours(0, 0, 0, 0)

  let emailsSent = 0
  const errors: string[] = []

  for (const daysUntil of NOTIFICATION_DAYS) {
    const targetDate = addDays(today, daysUntil)
    const expiries   = await getExpiriesOnDate(targetDate)

    for (const expiry of expiries) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(expiry.user_id)
        const email = userData.user?.email
        if (!email) continue

        let platePlain: string | null = null
        if (expiry.vehicle_id) {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('plate_encrypted')
            .eq('id', expiry.vehicle_id)
            .single()
          if (vehicle?.plate_encrypted) {
            platePlain = decrypt(vehicle.plate_encrypted as string)
          }
        }

        await sendExpiryNotification({
          toEmail:    email,
          docType:    expiry.document_type as DocType,
          expiresOn:  expiry.expires_on,
          platePlain,
          daysUntil,
        })
        emailsSent++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`expiry ${expiry.id}: ${msg}`)
        console.error('[cron/check-expiries]', expiry.id, err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: today.toISOString().split('T')[0],
    emailsSent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
