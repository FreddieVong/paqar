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

function alertRecipient(): string {
  return env.ADS_ALERT_EMAIL ?? 'hello@paqar.my'
}

async function send(subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.error('[ads-alert] RESEND_API_KEY unset — alert not delivered:', subject)
    return
  }
  const resend = new Resend(env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Paqar <noreply@paqar.my>',
    to:   alertRecipient(),
    subject,
    html,
  }).catch((err) => console.error('[ads-alert]', err))
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
}): Promise<void> {
  await send(
    params.subject,
    WRAP(`<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.6;color:#111827;white-space:pre-wrap;">${
      params.report.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
    }</pre>`)
  )
}
