/**
 * Sends the retarget e-mail to one address so the design can be checked in a
 * real inbox (Gmail dark mode on a phone is the only test that counts).
 *
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com WXY1234
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com --no-plate
 *
 * Sends real mail through Resend. It touches no database rows and does not
 * stamp lead_email_sent_at, so it cannot interfere with the retarget cron.
 */
import { readFileSync } from 'fs'
import { Resend }       from 'resend'
import { buildRetargetEmailHtml } from '../lib/email/retarget-template'

try {
  const lines = readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
  }
} catch { /* env already set */ }

const [toEmail, plateArg] = process.argv.slice(2)

if (!toEmail || !toEmail.includes('@')) {
  console.error('Usage: npx tsx scripts/send-test-retarget-email.ts <email> [plate|--no-plate]')
  process.exit(1)
}

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.error('RESEND_API_KEY is not set — add it to .env.local')
  process.exit(1)
}

const plate     = plateArg === '--no-plate' ? undefined : (plateArg || 'JUF222')
const recipient = toEmail

async function main() {
  const html = buildRetargetEmailHtml({
    plate,
    // Points at the live site so the CTA is tappable from the phone.
    reportUrl: 'https://paqar.my',
  })

  const { data, error } = await new Resend(apiKey).emails.send({
    from:    'Paqar <noreply@paqar.my>',
    to:      recipient,
    subject: plate ? `${plate} — berbaloi atau tidak?` : 'Laporan Paqar — masih tersedia',
    html,
  })

  if (error) {
    console.error('Send failed:', error)
    process.exit(1)
  }

  console.log(`Sent to ${recipient} (${plate ?? 'no-plate variant'}) — id ${data?.id}`)
}

main()
