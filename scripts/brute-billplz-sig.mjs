// Brute-forces the real Billplz redirect X-Signature construction using the
// ground-truth payload + signature from bill 3bc6ba628d0ba087, so we learn the
// EXACT format Billplz uses instead of guessing from docs.
//
// Run with your real X Signature Key (stays in your terminal):
//   BILLPLZ_X_SIGNATURE_KEY='PASTE_REAL_XSIG_KEY' node scripts/brute-billplz-sig.mjs
//
// Paste me the output. A "MATCH FOUND" line tells me the precise recipe to
// implement. "No match" means the key itself isn't the signing key.

import { createHmac } from 'crypto'

const key = process.env.BILLPLZ_X_SIGNATURE_KEY
if (!key) {
  console.error('ERROR: set BILLPLZ_X_SIGNATURE_KEY when running this script.')
  process.exit(1)
}

const received = '1ff91b618f76db36686e73b6ed909b29b64c350c6c0822814581e71e7e9ed93a'
const hmac = (s) => createHmac('sha256', key).update(s).digest('hex')

const id   = '3bc6ba628d0ba087'
const paid = 'true'
const paidAtVariants = {
  decoded: '2026-07-22 23:50:42 +0800',
  plus:    '2026-07-22+23:50:42+0800',
}

// How each param key appears inside the source string
const schemes = {
  billplzConcat: { id: 'billplzid',     paid: 'billplzpaid',     paid_at: 'billplzpaid_at' },
  stripped:      { id: 'id',            paid: 'paid',            paid_at: 'paid_at' },
  brackets:      { id: 'billplz[id]',   paid: 'billplz[paid]',   paid_at: 'billplz[paid_at]' },
}

const kvSeps    = ['', '|', '=']       // between key and value
const entrySeps = ['', '|', '&', '\n'] // between entries

const candidates = []
for (const [schemeName, k] of Object.entries(schemes)) {
  for (const [paName, paVal] of Object.entries(paidAtVariants)) {
    const full = [[k.id, id], [k.paid, paid], [k.paid_at, paVal]]
    const noPaidAt = [[k.id, id], [k.paid, paid]]
    const orders = {
      sorted:  [...full].sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1)),
      natural: full,
      idPaidatPaid: [full[0], full[2], full[1]],
    }
    for (const [orderName, entries] of Object.entries(orders)) {
      for (const kv of kvSeps) {
        for (const sep of entrySeps) {
          candidates.push({
            recipe: `scheme=${schemeName} paidAt=${paName} order=${orderName} kv="${kv}" sep=${JSON.stringify(sep)}`,
            source: entries.map(([kk, vv]) => `${kk}${kv}${vv}`).join(sep),
          })
        }
      }
      // values only, no keys
      for (const sep of ['', '|', '&']) {
        candidates.push({
          recipe: `VALUES-ONLY paidAt=${paName} order=${orderName} sep=${JSON.stringify(sep)}`,
          source: entries.map(([, vv]) => vv).join(sep),
        })
      }
    }
    // without paid_at at all
    for (const kv of kvSeps) {
      for (const sep of entrySeps) {
        candidates.push({
          recipe: `NO-PAIDAT scheme=${schemeName} kv="${kv}" sep=${JSON.stringify(sep)}`,
          source: noPaidAt.map(([kk, vv]) => `${kk}${kv}${vv}`).join(sep),
        })
      }
    }
  }
}

let found = false
for (const c of candidates) {
  if (hmac(c.source) === received) {
    found = true
    console.log('✅ MATCH FOUND')
    console.log('   recipe:', c.recipe)
    console.log('   source:', JSON.stringify(c.source))
    console.log('')
  }
}
console.log(found
  ? 'Done — send me the MATCH FOUND block(s) above.'
  : `❌ No match among ${candidates.length} candidates — the key itself is likely not the signing key.`)
