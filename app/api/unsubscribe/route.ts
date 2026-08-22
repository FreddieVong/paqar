import { NextRequest, NextResponse } from 'next/server'
import { emailFromToken, suppress } from '@/lib/email/suppression'

/**
 * One click, no login, no confirmation step.
 *
 * A recipient who wants out should be out. Asking them to sign in, or to
 * confirm on a second screen, is how an opt-out becomes a maze — and the whole
 * reason this exists is that Paqar had no way to say no at all.
 *
 * GET rather than POST because that is what an e-mail client can follow. The
 * token is the authorisation: it is AES-encrypted, so it cannot be guessed or
 * edited into someone else's address, and it never reveals who it belongs to.
 *
 * Always renders the same page. Whether the token was valid, already
 * suppressed, or garbage, the reply is "you will not be e-mailed" — telling a
 * stranger which addresses are real is not something a public endpoint should
 * do.
 */
export const dynamic = 'force-dynamic'

function page(body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="ms"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Berhenti langganan | Paqar</title></head>
<body style="margin:0;background:#F9FAFB;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
<div style="max-width:32rem;margin:0 auto;padding:64px 24px;">
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:28px;">
    ${body}
  </div>
  <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
    <a href="https://paqar.my" style="color:#3D472F;text-decoration:none;">paqar.my</a>
    &middot; Bukan platform rasmi kerajaan
  </p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

const DONE = `
  <h1 style="margin:0 0 10px;font-size:19px;color:#111827;">Selesai.</h1>
  <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
    Kami tidak akan hantar emel kepada anda lagi.
  </p>
  <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
    Anda masih boleh guna Paqar seperti biasa. Kalau anda beli laporan,
    resit dan laporan tetap dihantar &mdash; itu bukan emel pemasaran.
  </p>`

const TROUBLE = `
  <h1 style="margin:0 0 10px;font-size:19px;color:#111827;">Selesai.</h1>
  <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
    Kami tidak akan hantar emel kepada anda lagi.
  </p>
  <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
    Kalau anda masih terima emel selepas ini, balas emel itu dengan
    &quot;STOP&quot; dan kami keluarkan alamat anda terus.
  </p>`

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  if (!token) return page(TROUBLE)

  const email = emailFromToken(token)
  if (!email) return page(TROUBLE)

  // The reply-with-STOP fallback is named only when the write failed, so a
  // person whose opt-out did not land is told how to make it land.
  return page(await suppress(email) ? DONE : TROUBLE)
}
