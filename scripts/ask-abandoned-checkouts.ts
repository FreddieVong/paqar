/**
 * Asks the people who tried to pay and stopped, why they stopped.
 *
 * WHY THIS EXISTS
 *
 * As of 2026-08-04 Paqar has never had a paying customer. Every "sale" in
 * buyer_reports belongs to Freddie, test@example.com or two friends. What DOES
 * exist is a handful of strangers who entered an email, generated a Billplz
 * bill, and never completed — one of them twice at RM100 inside a minute.
 *
 * Nobody has ever asked them why. Four replies would say more about the
 * checkout than RM180 of traffic, and cost nothing.
 *
 * The retarget cron already emails these people a "your report is ready, pay
 * RM12" message. It has not converted anyone. This is deliberately NOT that:
 * one question, no pitch, reply-to set to a human.
 *
 *   npx tsx scripts/ask-abandoned-checkouts.ts            # dry run, prints only
 *   npx tsx scripts/ask-abandoned-checkouts.ts --send     # actually sends
 *
 * Dry run by default so the recipient list can be inspected before anything
 * leaves the building.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

try {
  const lines = readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
  }
} catch { /* env already set */ }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Freddie's own addresses and the friends who tested. Excluded because
 * emailing yourself "why didn't you pay?" is not market research, and because
 * every historical conversion rate that included them was meaningless.
 */
const OURS = new Set([
  'invisible4v@gmail.com',
  'test@example.com',
  'lyethengchoo@gmail.com',
  'liyingaun@gmail.com',
  'freddie.vong@yahoo.com',
])

const REPLY_TO = 'freddie.vong@yahoo.com'
const FROM     = 'Freddie dari Paqar <noreply@paqar.my>'
const SUBJECT  = 'Boleh saya tanya satu soalan?'

const body = (billUrl: string) => `Hi,

Saya Freddie, saya yang bina Paqar.

Saya perasan awak ada cuba dapatkan laporan untuk kereta yang awak sedang
pertimbang, tapi tak sempat selesaikan pembayaran.

Saya bukan nak jual apa-apa dalam email ni. Saya cuma nak tanya satu soalan,
sebab jawapan awak sangat membantu saya perbaiki Paqar:

Apa yang buat awak berhenti?

Harga? Tak pasti apa yang akan dapat? Cara bayar menyusahkan? Atau dah jumpa
maklumat tu di tempat lain?

Satu ayat pun sudah cukup. Reply email ni terus.

Terima kasih,
Freddie

--
Kalau awak masih nakkan laporan tu, link ini masih aktif:
${billUrl}
`

interface Lead { email: string; billId: string; amountCents: number; createdAt: string }

async function collectLeads(): Promise<Lead[]> {
  const { data, error } = await sb
    .from('buyer_reports')
    .select('buyer_email, billplz_bill_id, amount_cents, status, created_at')
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
  if (error) throw error

  // Newest attempt per person: someone who tried twice gets one email, and it
  // links the bill they most recently generated.
  const seen = new Map<string, Lead>()
  for (const r of data ?? []) {
    const email = (r.buyer_email ?? '').trim().toLowerCase()
    if (!email || OURS.has(email) || email.startsWith('freddie')) continue
    if (!r.billplz_bill_id) continue
    if (!seen.has(email)) {
      seen.set(email, {
        email,
        billId:      r.billplz_bill_id as string,
        amountCents: (r.amount_cents as number) ?? 0,
        createdAt:   (r.created_at as string) ?? '',
      })
    }
  }
  return [...seen.values()]
}

/** Never link a bill that has since been paid — that would be insulting. */
async function stillUnpaid(billId: string): Promise<boolean> {
  const key = process.env.BILLPLZ_API_KEY
  if (!key) return true // cannot check; the DB already said unpaid
  const auth = Buffer.from(`${key}:`).toString('base64')
  const res = await fetch(`https://www.billplz.com/api/v3/bills/${billId}`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!res.ok) return true
  const bill = await res.json() as { paid?: boolean }
  return bill.paid !== true
}

async function send(lead: Lead): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // Resend sits behind Cloudflare, which rejects default runtime agents.
      'User-Agent': 'paqar-outreach/1.0',
    },
    body: JSON.stringify({
      from: FROM, to: [lead.email], reply_to: REPLY_TO,
      subject: SUBJECT, text: body(`https://www.billplz.com/bills/${lead.billId}`),
    }),
  })
  const json = await res.json() as { id?: string; message?: string }
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`)
  return json.id ?? 'sent'
}

async function main() {
  const live = process.argv.includes('--send')
  const leads = await collectLeads()

  if (leads.length === 0) {
    console.log('No abandoned checkouts from anyone outside the team.')
    return
  }

  console.log(`${leads.length} real ${leads.length === 1 ? 'person' : 'people'} who tried to pay and stopped:\n`)
  const sendable: Lead[] = []
  for (const l of leads) {
    const unpaid = await stillUnpaid(l.billId)
    console.log(`  ${l.email.padEnd(30)} RM${(l.amountCents / 100).toFixed(0).padStart(3)}  `
      + `tried ${l.createdAt.slice(0, 10)}  ${unpaid ? 'unpaid' : 'ALREADY PAID — skipping'}`)
    if (unpaid) sendable.push(l)
  }

  if (!live) {
    console.log(`\nDRY RUN — nothing sent. Re-run with --send to email these ${sendable.length}.`)
    console.log('\nPreview:\n')
    console.log(`Subject: ${SUBJECT}`)
    console.log(body('https://www.billplz.com/bills/<their-own-bill>'))
    return
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — nothing sent.')
    process.exitCode = 1
    return
  }

  console.log('')
  let ok = 0
  for (const l of sendable) {
    try {
      const id = await send(l)
      console.log(`  SENT   ${l.email.padEnd(30)} id=${id}`)
      ok++
    } catch (err) {
      console.error(`  FAILED ${l.email.padEnd(30)} ${err instanceof Error ? err.message : String(err)}`)
    }
    await new Promise((r) => setTimeout(r, 600)) // stay under Resend's rate limit
  }
  console.log(`\n${ok}/${sendable.length} sent. Replies go to ${REPLY_TO}.`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
