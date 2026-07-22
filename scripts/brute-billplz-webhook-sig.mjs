// Brute-forces the real Billplz CALLBACK (webhook) X-Signature construction
// using the ground-truth payload + signature captured from a real Billplz
// callback (User-Agent: Ruby) for bill 3bc6ba628d0ba087.
//
// Sweeps field subsets (Billplz may exclude empty/some fields), key orderings,
// and separators. Run with your real X Signature Key:
//   BILLPLZ_X_SIGNATURE_KEY='PASTE_REAL_XSIG_KEY' node scripts/brute-billplz-webhook-sig.mjs
//
// Paste me the "MATCH FOUND" block(s).

import { createHmac } from 'crypto'

const key = process.env.BILLPLZ_X_SIGNATURE_KEY
if (!key) {
  console.error('ERROR: set BILLPLZ_X_SIGNATURE_KEY when running this script.')
  process.exit(1)
}

const received = 'a69b748e115478fee1d7f8f9bcfcc4e91ac30e37a9180ede6137b2788285fa2c'
const hmac = (s) => createHmac('sha256', key).update(s).digest('hex')

// Exact params from the real callback (insertion order preserved as Billplz sent them)
const params = {
  id:            '3bc6ba628d0ba087',
  collection_id: 'dptd0er6',
  paid:          'true',
  state:         'paid',
  amount:        '1200',
  paid_amount:   '1200',
  due_at:        '2026-7-22',
  email:         'invisible4v@gmail.com',
  mobile:        '',
  name:          'INVISIBLE4V@GMAIL.COM',
  url:           'https://www.billplz.com/bills/3bc6ba628d0ba087',
  paid_at:       '2026-07-22 23:50:42 +0800',
}
const keys = Object.keys(params)

function* subsets(arr) {
  const n = arr.length
  for (let mask = 1; mask < (1 << n); mask++) {
    const s = []
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s.push(arr[i])
    yield s
  }
}

const orderings = {
  alpha:     (ks) => [...ks].sort(),
  insertion: (ks) => ks, // subset already preserves Billplz's sent order
}
const kvSeps    = ['', '|']
const entrySeps = ['|', '', '&', '\n']

const found = []
let tried = 0
for (const sub of subsets(keys)) {
  for (const [ordName, ord] of Object.entries(orderings)) {
    const ordered = ord(sub)
    for (const kv of kvSeps) {
      for (const sep of entrySeps) {
        tried++
        const source = ordered.map((k) => `${k}${kv}${params[k]}`).join(sep)
        if (hmac(source) === received) {
          found.push({ recipe: `fields=[${sub.join(',')}] order=${ordName} kv="${kv}" sep=${JSON.stringify(sep)}`, source })
        }
      }
    }
    for (const sep of ['|', '', '&']) {
      tried++
      const source = ordered.map((k) => params[k]).join(sep)
      if (hmac(source) === received) {
        found.push({ recipe: `VALUES-ONLY fields=[${sub.join(',')}] order=${ordName} sep=${JSON.stringify(sep)}`, source })
      }
    }
  }
}

for (const f of found) {
  console.log('✅ MATCH FOUND')
  console.log('   recipe:', f.recipe)
  console.log('   source:', JSON.stringify(f.source))
  console.log('')
}
console.log(found.length
  ? `Done (${tried} combinations tried) — send me the MATCH FOUND block(s).`
  : `❌ No match among ${tried} combinations. Format is more exotic — tell me and I'll widen the search.`)
