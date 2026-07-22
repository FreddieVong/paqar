// Standalone diagnostic — reproduces the redirect X-Signature for a REAL Billplz
// payment using whatever key you pass in, and compares to the signature Billplz
// actually sent. No deploy, no secret leaves your machine.
//
// Run it TWICE — once with each key from your Billplz dashboard:
//
//   BILLPLZ_X_SIGNATURE_KEY='<your X Signature Key>' node scripts/debug-billplz-sig.mjs
//   BILLPLZ_X_SIGNATURE_KEY='<your API Secret Key>'  node scripts/debug-billplz-sig.mjs
//
// Paste me the OUTPUT (source string + MATCH line). Do NOT paste the key itself.

import { createHmac } from 'crypto'

// --- Real payload from the failed production payment (bill 3bc6ba628d0ba087) ---
// Decoded from the redirect URL query string.
const params = {
  billplzid:      '3bc6ba628d0ba087',
  billplzpaid:    'true',
  billplzpaid_at: '2026-07-22 23:50:42 +0800',
}
const receivedSignature = '1ff91b618f76db36686e73b6ed909b29b64c350c6c0822814581e71e7e9ed93a'

// --- Exact copy of the algorithm in lib/billplz/index.ts ---
function compareCaseInsensitive(a, b) {
  const la = a.toLowerCase()
  const lb = b.toLowerCase()
  return la < lb ? -1 : la > lb ? 1 : 0
}
function buildSignatureSourceString(p) {
  return Object.keys(p)
    .sort(compareCaseInsensitive)
    .map((k) => `${k}${p[k] ?? ''}`)
    .join('|')
}

const key = process.env.BILLPLZ_X_SIGNATURE_KEY
if (!key) {
  console.error('ERROR: set BILLPLZ_X_SIGNATURE_KEY when running this script.')
  process.exit(1)
}

const source   = buildSignatureSourceString(params)
const computed = createHmac('sha256', key).update(source).digest('hex')
const match    = computed === receivedSignature

console.log('source string :', source)
console.log('computed sig  :', computed)
console.log('received sig  :', receivedSignature)
console.log('MATCH         :', match)
console.log('')
console.log(match
  ? '=> This key is the correct signing key. The algorithm is right.'
  : '=> This key does NOT reproduce the signature. Try the other key.')
