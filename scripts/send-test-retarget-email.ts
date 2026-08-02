/**
 * Sends the retarget e-mail to one address so the design can be checked in a
 * real inbox (dark mode on a phone is the only test that counts).
 *
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com WXY1234
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com --no-plate
 *   npx tsx scripts/send-test-retarget-email.ts you@example.com --probe
 *
 * --probe sends the dark-mode colour diagnostic instead of the real e-mail.
 *
 * Sends real mail through Resend. It touches no database rows and does not
 * stamp lead_email_sent_at, so it cannot interfere with the retarget cron.
 */
import { readFileSync } from 'fs'
import { Resend }       from 'resend'
import { buildRetargetEmailHtml } from '../lib/email/retarget-template'
import { buildColourProbeHtml }   from '../lib/email/colour-probe'

try {
  const lines = readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m?.[1] && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? ''
  }
} catch { /* env already set */ }

const [toEmail, modeArg] = process.argv.slice(2)

if (!toEmail || !toEmail.includes('@')) {
  console.error('Usage: npx tsx scripts/send-test-retarget-email.ts <email> [plate|--no-plate|--probe]')
  process.exit(1)
}

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.error('RESEND_API_KEY is not set — add it to .env.local')
  process.exit(1)
}

const isProbe   = modeArg === '--probe'
const plate     = modeArg === '--no-plate' ? undefined : (isProbe ? 'JUF222' : (modeArg || 'JUF222'))
const recipient = toEmail

async function main() {
  const html = isProbe
    ? buildColourProbeHtml()
    : buildRetargetEmailHtml({
        plate,
        // Points at the live site so the CTA is tappable from the phone.
        reportUrl: 'https://paqar.my',
      })

  // Repeated test sends share a subject and a near-identical body, so Gmail
  // threads them and hides the repeats behind "show trimmed content" — which
  // makes the header, the thing usually under test, impossible to look at. A
  // per-send stamp keeps every test in its own thread. Test-only; the real
  // subject the cron sends is built in lib/email/retarget.ts.
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false })
  const baseSubject = isProbe
    ? 'Paqar colour probe — screenshot this'
    : (plate ? `${plate} — berbaloi atau tidak?` : 'Laporan Paqar — masih tersedia')

  const { data, error } = await new Resend(apiKey).emails.send({
    from:    'Paqar <noreply@paqar.my>',
    to:      recipient,
    subject: `${baseSubject} [test ${stamp}]`,
    html,
  })

  if (error) {
    console.error('Send failed:', error)
    process.exit(1)
  }

  const what = isProbe ? 'colour probe' : (plate ?? 'no-plate variant')
  console.log(`Sent to ${recipient} (${what}) — id ${data?.id}`)
}

main()
