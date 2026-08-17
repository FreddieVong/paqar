import { Resend } from 'resend'
import { env }    from '@/lib/env'
import { buildRetargetEmailHtml } from './retarget-template'
import type { RetargetEmailInsight } from './retarget-template'
import { SUPPORT_REPLY_TO } from '@/lib/site'

interface RetargetParams {
  toEmail:  string
  plate?:   string
  checkId:  string
  // Null once the lead has signed in: claimCheck() nulls the token and hands
  // ownership to user_id. Typed nullable so the URL builder has to handle it —
  // a `as string` cast here previously shipped links reading `claim_token=null`,
  // which the report page rejects, 404ing the recipients who cared most.
  claimToken: string | null
  /** Null whenever the price picture cannot be stated safely. */
  insight?:   RetargetEmailInsight | null
}

/**
 * Subject lines lead with what the lead's own asking price means, because that
 * is the question they opened the free check to answer. Kept short — anything
 * past roughly 40 characters is truncated on a phone. Falls back to the generic
 * question when there is no safe verdict to state.
 */
function subjectFor(plate: string | undefined, insight: RetargetEmailInsight | null | undefined): string {
  if (!plate) return 'Laporan Paqar — masih tersedia'
  switch (insight?.verdict) {
    case 'overpriced':    return `${plate} — lebih tinggi dari iklan setanding`
    case 'slightly_high': return `${plate} — ada ruang untuk tawar`
    case 'good_deal':     return `${plate} — lebih rendah dari iklan setanding`
    case 'fair_price':    return `${plate} — harga nampak wajar`
    default:              return `${plate} — berbaloi atau tidak?`
  }
}

export function buildRetargetReportUrl(checkId: string, claimToken: string | null): string {
  const base = `https://paqar.my/laporan-pembeli/${checkId}`
  // No token means the check is owned by an account, so the page resolves access
  // by session instead. Omitting the param lets a signed-out visitor land on
  // sign-in rather than a dead end.
  return claimToken ? `${base}?claim_token=${claimToken}` : base
}

export async function sendRetargetEmail(params: RetargetParams): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const resend     = new Resend(env.RESEND_API_KEY)
  const reportUrl  = buildRetargetReportUrl(params.checkId, params.claimToken)
  const subject    = subjectFor(params.plate, params.insight)

  const html = buildRetargetEmailHtml({
    plate:   params.plate,
    reportUrl,
    insight: params.insight ?? null,
  })

  await resend.emails.send({
    from:    'Paqar <noreply@paqar.my>',
    replyTo: SUPPORT_REPLY_TO,
    to:      params.toEmail,
    subject,
    html,
  })
}
