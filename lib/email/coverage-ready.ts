import { Resend } from 'resend'
import { env } from '@/lib/env'
import { BASE_REPORT_LABEL } from '@/lib/pricing'

/**
 * "Paqar can check this car now" — sent ONLY when it actually can.
 *
 * ── WHY THIS IS A DIFFERENT EMAIL ──────────────────────────────────────────
 *
 * These people were turned away. They typed a car, Paqar said it had not found
 * enough comparable adverts to produce a decision, and they left an address on
 * the strength of "we will tell you when we can". Sending them the ordinary
 * retarget email — "masih berminat?" — would answer a question they never
 * asked and ignore the one they did.
 *
 * The cron re-runs the SAME coverage check before this is sent, so the subject
 * line cannot be wrong. A second "we still can't" email is never sent: silence
 * is the honest state while the answer has not changed.
 */
export async function sendCoverageReadyEmail(params: {
  toEmail: string
  brand:   string
  model:   string
  year:    string
}): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend   = new Resend(env.RESEND_API_KEY)
  const carLabel = `${params.brand} ${params.model} ${params.year}`
  const url      = 'https://paqar.my/'

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#3D472F;font-size:18px;font-weight:900;margin:0 0 4px;">Paqar</h2>
      <p style="color:#6B7280;font-size:12px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.08em;">Semak Sebelum Beli</p>

      <p style="color:#111827;font-size:16px;font-weight:700;margin:0 0 12px;">
        Kami dah boleh semak ${carLabel}.
      </p>
      <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Dulu kami tak jumpa cukup iklan setanding untuk kereta ini, jadi kami tak jual
        keputusan yang kami tak dapat sokong. Sekarang dah ada.
      </p>
      <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Hantar link iklan atau screenshot, dan kami beritahu apa patut anda buat —
        patut teruskan, runding, atau lupakan. ${BASE_REPORT_LABEL}, disemak oleh manusia.
      </p>

      <a href="${url}" style="display:inline-block;background:#3D472F;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:12px;">
        Semak kereta ini &rarr;
      </a>

      <p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.6;">
        Anda terima e-mel ini kerana anda minta kami beritahu bila kami boleh semak
        kereta ini. Kami tak akan hantar lagi tentang model ini.
      </p>
    </div>
  `

  await resend.emails.send({
    from:    'Paqar <hello@paqar.my>',
    to:      params.toEmail,
    subject: `Kami dah boleh semak ${carLabel}`,
    html,
  })
}
