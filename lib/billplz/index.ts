import { env } from '@/lib/env'
import { createHmac, timingSafeEqual } from 'crypto'

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

// Deterministic, non-locale-dependent case-insensitive comparator (avoids
// localeCompare, which can vary by ICU/locale configuration).
function compareCaseInsensitive(a: string, b: string): number {
  const la = a.toLowerCase()
  const lb = b.toLowerCase()
  return la < lb ? -1 : la > lb ? 1 : 0
}

// Per Billplz docs: sort keys ascending case-insensitively, concatenate each
// key directly with its value (no separator), join entries with '|'.
export function buildSignatureSourceString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort(compareCaseInsensitive)
    .map((k) => `${k}${params[k] ?? ''}`)
    .join('|')
}

function computeSignature(params: Record<string, string>): string {
  return createHmac('sha256', env.BILLPLZ_X_SIGNATURE_KEY!)
    .update(buildSignatureSourceString(params))
    .digest('hex')
}

const HEX_64 = /^[0-9a-f]{64}$/i

// Format-checked, constant-time comparison. Never throws.
function safeCompareSignature(expectedHex: string, providedHex: string): boolean {
  if (!HEX_64.test(expectedHex) || !HEX_64.test(providedHex)) return false
  try {
    const expected = Buffer.from(expectedHex, 'hex')
    const provided = Buffer.from(providedHex, 'hex')
    return expected.length === provided.length && timingSafeEqual(expected, provided)
  } catch {
    return false
  }
}

export function verifyWebhookSignature(
  params: Record<string, string>,
  signature: string
): boolean {
  if (!env.BILLPLZ_X_SIGNATURE_KEY) return false
  return safeCompareSignature(computeSignature(params), signature)
}

// Redirect params arrive as billplz[id], billplz[paid], billplz[paid_at], and
// optionally billplz[transaction_id]/billplz[transaction_status] (only when
// "Extra Payment Completion Information" is enabled on the collection) plus
// billplz[x_signature]. The signed key is the bracket-stripped, "billplz"-
// prefixed field name (e.g. "billplz[id]" -> "billplzid").
const BILLPLZ_PARAM_KEY = /^billplz(?:\[([^\]]*)\]|%5B([^%]*)%5D)$/i

export function extractRedirectSignatureParams(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(searchParams)) {
    const match = rawKey.match(BILLPLZ_PARAM_KEY)
    if (!match) continue
    const field = (match[1] ?? match[2] ?? '').toLowerCase()
    if (field === 'x_signature') continue
    if (rawValue === undefined) continue
    if (Array.isArray(rawValue)) return null // malformed/unexpected repeated param — reject, don't coerce
    out[`billplz${field}`] = rawValue // empty-string values retained intentionally
  }
  return out
}

// CRITICAL: Billplz's REDIRECT (return_url) X-Signature uses a FIXED key order —
// NOT an alphabetical sort like the callback/webhook signature. Empirically
// confirmed against a real payment (bill 3bc6ba628d0ba087):
//   billplzid{id}|billplzpaid_at{paid_at}|billplzpaid{paid}
// Note paid_at precedes paid, which no lexicographic sort would produce. Keys
// are billplz-prefixed and concatenated directly with their values (no key/value
// separator); entries are joined by '|'. The optional transaction fields, when
// the collection sends them, follow in this documented order.
const REDIRECT_KEY_ORDER = [
  'billplzid',
  'billplzpaid_at',
  'billplzpaid',
  'billplztransaction_id',
  'billplztransaction_status',
]

export function buildRedirectSignatureSource(params: Record<string, string>): string {
  return REDIRECT_KEY_ORDER
    .filter((k) => k in params)
    .map((k) => `${k}${params[k] ?? ''}`)
    .join('|')
}

function computeRedirectSignature(params: Record<string, string>): string {
  return createHmac('sha256', env.BILLPLZ_X_SIGNATURE_KEY!)
    .update(buildRedirectSignatureSource(params))
    .digest('hex')
}

// Returns the verified param set (so the caller reads billplz[paid]/[id] only
// from values that were actually part of the signed payload) or null if
// verification fails for any reason.
export function verifyRedirectSignature(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string> | null {
  if (!env.BILLPLZ_X_SIGNATURE_KEY) return null
  const rawSignature = searchParams['billplz[x_signature]'] ?? searchParams['billplz%5Bx_signature%5D']
  if (typeof rawSignature !== 'string') return null
  const params = extractRedirectSignatureParams(searchParams)
  if (!params) return null
  return safeCompareSignature(computeRedirectSignature(params), rawSignature) ? params : null
}
