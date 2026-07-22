// Final verification: reproduces the REAL captured webhook signature (bill
// 3bc6ba628d0ba087, resent callback, User-Agent: Ruby) using the corrected
// concat-then-sort construction from lib/billplz.
//
// Run with your real X Signature Key (stays in your terminal):
//   BILLPLZ_X_SIGNATURE_KEY='PASTE_REAL_XSIG_KEY' node scripts/verify-billplz-webhook.mjs
//
// MATCH: true → the webhook fix is confirmed against production ground truth.

import { createHmac } from 'crypto'

const key = process.env.BILLPLZ_X_SIGNATURE_KEY
if (!key) {
  console.error('ERROR: set BILLPLZ_X_SIGNATURE_KEY when running this script.')
  process.exit(1)
}

// Real payload captured from [billplz-webhook-debug] on JUL 23 00:21:57
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
const received = 'a69b748e115478fee1d7f8f9bcfcc4e91ac30e37a9180ede6137b2788285fa2c'

// Same construction as lib/billplz buildSignatureSourceString:
// concat key+value, sort concatenated strings case-insensitively, join '|'
const source = Object.entries(params)
  .map(([k, v]) => `${k}${v ?? ''}`)
  .sort((a, b) => { const la = a.toLowerCase(), lb = b.toLowerCase(); return la < lb ? -1 : la > lb ? 1 : 0 })
  .join('|')
const computed = createHmac('sha256', key).update(source).digest('hex')

console.log('source  :', source)
console.log('computed:', computed)
console.log('received:', received)
console.log('MATCH   :', computed === received)
console.log(computed === received
  ? '\n=> Webhook fix CONFIRMED against production ground truth. Safe to deploy.'
  : '\n=> Still no match — send this output back.')
