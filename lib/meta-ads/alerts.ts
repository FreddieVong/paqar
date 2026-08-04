import 'server-only'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import { redactMeta } from '@/lib/meta-ads/client'

/**
 * Immediate alerts for the ads operator.
 *
 * Critical failures are NEVER left to the daily report. If the operator tried
 * to stop spending and could not, the owner needs to know now — the campaign
 * may still be delivering.
 */

/**
 * Where alerts go. Returns null rather than a fallback address ON PURPOSE.
 *
 * This used to default to 'hello@paqar.my'. That address has no MX record —
 * paqar.my cannot receive mail at all — so seven consecutive daily reports
 * were "sent" into nothing while the operator recorded each as email_sent. A
 * hardcoded fallback did not add resilience; it manufactured the appearance of
 * delivery and hid the misconfiguration for a week.
 *
 * Refusing to send, loudly, is strictly better than mailing a void.
 */
function alertRecipient(): string | null {
  return env.ADS_ALERT_EMAIL ?? null
}

export type AlertDelivery =
  | { ok: true;  recipient: string; id: string | null }
  | { ok: false; recipient: string | null; reason: string }

/**
 * Returns the outcome instead of swallowing it. Callers record the result, so
 * a silent misroute shows up in the audit trail the next day rather than
 * whenever someone happens to notice the inbox is empty.
 */
async function send(subject: string, html: string): Promise<AlertDelivery> {
  const to = alertRecipient()
  if (!to) {
    const reason = 'ADS_ALERT_EMAIL is not set — no recipient configured'
    console.error('[ads-alert]', reason, '|', subject)
    return { ok: false, recipient: null, reason }
  }
  if (!env.RESEND_API_KEY) {
    const reason = 'RESEND_API_KEY unset'
    console.error('[ads-alert]', reason, '|', subject)
    return { ok: false, recipient: to, reason }
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    const res = await resend.emails.send({
      from: 'Paqar <noreply@paqar.my>', to, subject, html,
    })
    if (res.error) {
      console.error('[ads-alert] resend rejected', res.error)
      return { ok: false, recipient: to, reason: String(res.error.message ?? res.error) }
    }
    return { ok: true, recipient: to, id: res.data?.id ?? null }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[ads-alert]', reason)
    return { ok: false, recipient: to, reason }
  }
}

const WRAP = (body: string) =>
  `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">${body}</div>`

/** The campaign was stopped as intended. */
export async function alertPauseSucceeded(params: {
  rule:       string
  detail:     string
  spendMyr:   number | null
}): Promise<void> {
  await send(
    `🟡 Paqar Ads: campaign paused (${params.rule})`,
    WRAP(`
      <h2 style="color:#B45309;font-size:18px;margin:0 0 12px;">Campaign paused automatically</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;"><strong>Rule:</strong> ${params.rule}</p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">${params.detail}</p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        <strong>Total spend:</strong> ${params.spendMyr == null ? 'unverified' : `RM${params.spendMyr.toFixed(2)}`}
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        Meta confirmed the pause. No further action is required, but review
        <a href="https://paqar.my/admin/ads">/admin/ads</a> before restarting anything.
      </p>
    `)
  )
}

/**
 * The operator tried to stop spending and Meta refused. This is the worst case:
 * delivery may still be live and only a human can stop it.
 */
export async function alertPauseFailed(params: {
  rule:       string
  detail:     string
  error:      string
  campaignId: string | null
}): Promise<void> {
  await send(
    '🔴 URGENT Paqar Ads: automatic pause FAILED — delivery may still be active',
    WRAP(`
      <h2 style="color:#DC2626;font-size:18px;margin:0 0 12px;">Automatic pause failed</h2>
      <p style="color:#111827;font-size:15px;line-height:1.7;font-weight:600;">
        Meta delivery may still be active. Pause the campaign manually in Ads Manager now.
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;"><strong>Rule that fired:</strong> ${params.rule}</p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">${params.detail}</p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        <strong>Campaign:</strong> ${params.campaignId ?? 'unknown'}
      </p>
      <p style="color:#6B7280;font-size:13px;line-height:1.6;background:#F9FAFB;padding:12px;border-radius:8px;">
        ${redactMeta(params.error).slice(0, 800)}
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;">
        The operator kill switch has been set, so it will not retry. Meta's RM210
        campaign spending limit remains the primary protection.
      </p>
    `)
  )
}

/** Delivered once per MYT day alongside the report. Not a critical channel. */
export async function sendDailyReportEmail(params: {
  subject: string
  report:  string
}): Promise<AlertDelivery> {
  return send(
    params.subject,
    WRAP(`<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.6;color:#111827;white-space:pre-wrap;">${
      params.report.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
    }</pre>`)
  )
}
