import { env } from '@/lib/env'
import { createHmac } from 'crypto'

const BILLPLZ_BASE = 'https://www.billplz.com/api/v3'

export interface BillplzBill {
  id:  string
  url: string
}

export async function createBill(params: {
  email:        string
  name:         string
  amountCents:  number
  description:  string
  callbackUrl:  string
  redirectUrl:  string
  collectionId?: string
}): Promise<BillplzBill> {
  if (!params.collectionId) params.collectionId = env.BILLPLZ_COLLECTION_ID ?? ''
  if (!env.BILLPLZ_API_KEY || !params.collectionId) {
    throw new Error('Billplz credentials not configured')
  }

  const body = new URLSearchParams({
    collection_id:    params.collectionId,
    email:            params.email,
    name:             params.name,
    amount:           params.amountCents.toString(),
    description:      params.description,
    callback_url:     params.callbackUrl,
    redirect_url:     params.redirectUrl,
    'reference[1]':   params.description,
    deliver:          'true',
  })

  const res = await fetch(`${BILLPLZ_BASE}/bills`, {
    method:  'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.BILLPLZ_API_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Billplz API error: ${err}`)
  }

  const data = await res.json() as { id: string; url: string }
  return { id: data.id, url: data.url }
}

export function verifyWebhookSignature(
  params: Record<string, string>,
  signature: string
): boolean {
  if (!env.BILLPLZ_X_SIGNATURE_KEY) return false

  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}|${params[k] ?? ''}`)
    .join('|')

  const computed = createHmac('sha256', env.BILLPLZ_X_SIGNATURE_KEY)
    .update(sorted)
    .digest('hex')

  return computed === signature
}
