/**
 * Paqar retargeting e-mail — "a private vehicle dossier delivered to the buyer".
 *
 * Dark-native, table-based, Gmail/Outlook safe. Pure function, no env access,
 * so it can be rendered to disk for visual review.
 *
 * Design tokens (kept local — e-mail cannot read the Tailwind theme):
 *   bg #0A0D0C · surface #0E1211 · hairline #1E2523 · text #ECF0EE
 *   muted #939E9A · mint #6FDFCF · coral #F05A50 · warm caution #C8A96A
 * Radius scale: 8 / 12 / 16.  Spacing: multiples of 8.
 */

const C = {
  bg:       '#0A0D0C',
  surface:  '#0E1211',
  caution:  '#15120C',
  line:     '#1E2523',
  linePlate:'#242D2A',
  lineWarm: '#2C2619',
  text:     '#ECF0EE',
  textSoft: '#C7CFCC',
  muted:    '#939E9A',
  mutedDim: '#6E7876',
  mint:     '#6FDFCF',
  coral:    '#F05A50',
  amber:    '#C8A96A',
} as const

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

export interface RetargetEmailContent {
  plate?:     string
  reportUrl:  string
}

function benefit(label: string): string {
  return `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td valign="middle" width="14" style="padding-top:1px;">
                      <div class="s-dot" style="width:5px;height:5px;background:${C.mint};border-radius:50%;font-size:0;line-height:0;">&nbsp;</div>
                    </td>
                    <td valign="middle" class="t-hi" style="font-family:${FONT};font-size:15px;font-weight:600;color:${C.text};line-height:1.3;">${label}</td>
                  </tr></table>`
}

/**
 * Quiet 2x2 record of what the claim check covers. A single wrapping row was
 * tried first and broke 3+1 at 375px, leaving a dangling separator — the fixed
 * grid wraps identically at every width.
 */
function historyLabels(labels: [string, string, string, string]): string {
  const cell = (label: string, pb: number) => `
                        <td width="50%" valign="top" class="t-soft" style="padding-bottom:${pb}px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.005em;color:${C.textSoft};line-height:1.3;">
                          <span class="t-amber" style="color:${C.amber};padding-right:7px;">&middot;</span>${label}</td>`
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>${cell(labels[0], 12)}${cell(labels[1], 12)}</tr>
                      <tr>${cell(labels[2], 0)}${cell(labels[3], 0)}</tr>
                    </table>`
}

export function buildRetargetEmailHtml(content: RetargetEmailContent): string {
  const plate      = content.plate?.trim().toUpperCase() || ''
  const hasPlate   = plate.length > 0
  const subjectRef = hasPlate ? plate : 'kereta ini'
  const ctaLabel   = hasPlate ? `Semak ${plate} &mdash; RM12` : 'Semak laporan &mdash; RM12'
  const url        = content.reportUrl

  return `<!DOCTYPE html>
<html lang="ms" style="background:${C.bg};">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Laporan Pembeli Paqar</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  /* "This message is already dark — do not re-theme it." Apple Mail and
     several webmail clients honour this and skip their own colour transform. */
  :root { color-scheme: dark; supported-color-schemes: dark; }
  a { text-decoration:none; }
  body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }

  /* Outlook mobile rewrites colours it dislikes and tags what it touched with
     data-ogsc (text) / data-ogsb (background). These put the palette back. */
  [data-ogsc] .t-hi    { color:${C.text} !important; }
  [data-ogsc] .t-soft  { color:${C.textSoft} !important; }
  [data-ogsc] .t-mute  { color:${C.muted} !important; }
  [data-ogsc] .t-dim   { color:${C.mutedDim} !important; }
  [data-ogsc] .t-mint  { color:${C.mint} !important; }
  [data-ogsc] .t-amber { color:${C.amber} !important; }
  [data-ogsc] .t-inv   { color:#FFFFFF !important; }
  [data-ogsb] .s-page  { background:${C.bg} !important; }
  [data-ogsb] .s-card  { background:${C.surface} !important; }
  [data-ogsb] .s-warn  { background:${C.caution} !important; }
  [data-ogsb] .s-cta   { background:${C.coral} !important; }
  [data-ogsb] .s-dot   { background:${C.mint} !important; }
  @media only screen and (max-width:600px) {
    .gutter   { padding-left:24px !important; padding-right:24px !important; }
    .hero     { font-size:26px !important; line-height:1.24 !important; }
    .plate-no { font-size:31px !important; }
    .pad-lg   { padding:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Sebelum bayar deposit &mdash; semak sama ada harga ${subjectRef} berbaloi.</div>

  <table role="presentation" class="s-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" class="s-page" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="width:100%;max-width:600px;background:${C.bg};">

          <!-- ── identity ─────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:40px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="left" class="t-mint" style="font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${C.mint};line-height:1;">Paqar</td>
                <td align="right" class="t-dim" style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.16em;color:${C.mutedDim};line-height:1;">LAPORAN PEMBELI</td>
              </tr></table>
            </td>
          </tr>

          <!-- ── registration plate ───────────────────────────────── -->
          ${hasPlate ? `
          <tr>
            <td class="gutter" style="padding:32px 24px 0;">
              <table role="presentation" class="s-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.linePlate};border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td align="left" class="t-mint" style="font-family:${FONT};font-size:9px;font-weight:700;letter-spacing:0.18em;color:${C.mint};line-height:1;">NO.&nbsp;PENDAFTARAN</td>
                      <td align="right" class="t-dim" style="font-family:${FONT};font-size:9px;font-weight:700;letter-spacing:0.18em;color:${C.mutedDim};line-height:1;">MALAYSIA</td>
                    </tr></table>
                    <div class="plate-no t-hi" style="font-family:${FONT};font-size:34px;font-weight:800;letter-spacing:0.13em;color:${C.text};line-height:1.1;padding-top:12px;">${plate}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- ── hero ─────────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:32px 24px 0;">
              <div class="hero t-hi" style="font-family:${FONT};font-size:28px;font-weight:800;letter-spacing:-0.022em;color:${C.text};line-height:1.22;">Belum buat keputusan<br>tentang ${subjectRef}?</div>
            </td>
          </tr>
          <tr>
            <td class="gutter" style="padding:16px 24px 0;">
              <div class="t-mute" style="font-family:${FONT};font-size:16px;font-weight:400;color:${C.muted};line-height:1.62;">Sebelum bayar deposit, semak sama ada harganya berbaloi dan perkara penting yang mungkin tidak diberitahu oleh penjual.</div>
            </td>
          </tr>

          <!-- ── primary CTA ──────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:32px 24px 0;">
              <table role="presentation" class="s-cta" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.coral}" style="background:${C.coral};border-radius:12px;">
                <tr>
                  <td align="center" style="padding:17px 16px;">
                    <a href="${url}" class="t-inv" style="display:block;font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-0.01em;color:#FFFFFF;line-height:22px;text-decoration:none;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="gutter" align="center" style="padding:14px 24px 0;">
              <div class="t-dim" style="font-family:${FONT};font-size:12px;font-weight:400;color:${C.mutedDim};line-height:1.6;">Laporan harga dan panduan pembeli.<br>Semakan sejarah claim tersedia sebagai tambahan.</div>
            </td>
          </tr>

          <!-- ── what's inside ────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:40px 24px 0;">
              <table role="presentation" class="s-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.line};border-radius:16px;">
                <tr>
                  <td class="pad-lg" style="padding:24px;">
                    <div class="t-dim" style="font-family:${FONT};font-size:9px;font-weight:700;letter-spacing:0.18em;color:${C.mutedDim};line-height:1;padding-bottom:20px;">DALAM LAPORAN</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" valign="top" style="padding-bottom:16px;">${benefit('Verdict harga')}</td>
                        <td width="50%" valign="top" style="padding-bottom:16px;">${benefit('Julat pasaran')}</td>
                      </tr>
                      <tr>
                        <td width="50%" valign="top">${benefit('Skrip rundingan')}</td>
                        <td width="50%" valign="top">${benefit('Checklist deposit')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── caution panel ────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:16px 24px 0;">
              <table role="presentation" class="s-warn" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.caution}" style="background:${C.caution};border:1px solid ${C.lineWarm};border-left:2px solid ${C.amber};border-radius:0 16px 16px 0;">
                <tr>
                  <td class="pad-lg" style="padding:24px;">
                    <div class="t-hi" style="font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.015em;color:${C.text};line-height:1.32;">Keadaan luaran tidak<br>menceritakan semuanya.</div>
                    <div class="t-mute" style="font-family:${FONT};font-size:14px;font-weight:400;color:${C.muted};line-height:1.62;padding-top:10px;">Kereta yang kelihatan cantik atau dijual murah masih boleh mempunyai sejarah claim yang tidak diterangkan oleh penjual.</div>
                    <div style="padding-top:18px;">
                      <div style="height:1px;background:${C.lineWarm};font-size:0;line-height:0;">&nbsp;</div>
                      <div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>
                      ${historyLabels(['Own Damage', 'Banjir', 'Total Loss', 'Windscreen'])}
                    </div>
                    <div class="t-dim" style="font-family:${FONT};font-size:11.5px;font-weight:400;color:${C.mutedDim};line-height:1.65;padding-top:16px;">Tarikh dan jumlah claim dipaparkan apabila tersedia. Rekod insurans mungkin tidak merangkumi pembaikan tanpa tuntutan.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── footer ───────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:48px 24px 0;">
              <div style="height:1px;background:${C.line};font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td class="gutter" style="padding:20px 24px 48px;">
              <div class="t-dim" style="font-family:${FONT};font-size:11px;font-weight:400;color:${C.mutedDim};line-height:1.75;">
                Anda menerima emel ini kerana mendaftar minat di Paqar.<br>
                <a href="https://paqar.my" class="t-mute" style="color:${C.muted};text-decoration:none;">paqar.my</a>
                &nbsp;&middot;&nbsp;Bukan platform rasmi kerajaan
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
