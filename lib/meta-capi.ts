import 'server-only'
import { createHash } from 'crypto'
import { env } from '@/lib/env'

/**
 * Meta Conversions API — server-side Purchase events. The browser pixel loses
 * 30-50% of events to iOS privacy/ad-blockers; the Billplz webhook knows the
 * exact payment moment, so purchases are reported from here with certainty.
 * event_id = billId lets Meta dedupe if both webhook and redirect page fire.
 * Dormant until META_PIXEL_ID + META_CAPI_TOKEN are set.
 */
export async function sendPurchaseEvent(params: {
  email:       string
  amountCents: number
  billId:      string
  sourceUrl?:  string
}): Promise<void> {
  const pixelId = env.META_PIXEL_ID
  const token   = env.META_CAPI_TOKEN
  if (!pixelId || !token) return

  const hashedEmail = createHash('sha256')
    .update(params.email.trim().toLowerCase())
    .digest('hex')

  try {
    await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        data: [{
          event_name:       'Purchase',
          event_time:       Math.floor(Date.now() / 1000),
          event_id:         params.billId,
          action_source:    'website',
          event_source_url: params.sourceUrl ?? 'https://paqar.my/laporan-pembeli',
          user_data:        { em: [hashedEmail] },
          custom_data:      { currency: 'MYR', value: params.amountCents / 100 },
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error('[meta-capi]', err)
  }
}
