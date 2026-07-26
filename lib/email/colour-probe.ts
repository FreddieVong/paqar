/**
 * Dark-mode colour probe — a diagnostic e-mail, never sent to customers.
 *
 * Yahoo Mail (and other clients) rewrite text colours in dark mode. A real
 * inbox test showed #ECF0EE recoloured to mint and #FFFFFF to near-black,
 * while #C7CFCC and #939E9A came through untouched — which suggests a
 * lightness threshold somewhere between #C7CFCC and #ECF0EE.
 *
 * Rather than binary-searching that threshold one send at a time, this renders
 * every candidate at once. Each row prints its own hex in a colour already
 * known to survive, so the row is still identifiable after the client has
 * rewritten the sample next to it.
 *
 * Read the resulting screenshot as: the last row whose sample still looks
 * off-white is the highest colour safe to use for primary text.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

const BG    = '#0A0D0C'
/** Known to survive the transform — used for labels so rows stay identifiable. */
const LABEL = '#939E9A'

/** Lightest to darkest. #ECF0EE is the current primary text colour. */
const CANDIDATES = [
  '#FFFFFF',
  '#F5F8F6',
  '#ECF0EE',
  '#E4E9E7',
  '#DCE3E0',
  '#D4DBD8',
  '#CDD5D2',
  '#C7CFCC',
  '#BFC8C5',
]

function row(hex: string): string {
  return `
        <tr>
          <td style="padding:0 0 14px;">
            <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${LABEL};line-height:1;padding-bottom:5px;">${hex}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-family:${FONT};font-size:24px;font-weight:800;color:${hex};line-height:1.2;">JUF222</td>
              <td align="right" style="font-family:${FONT};font-size:13px;font-weight:600;color:${hex};line-height:1.2;">Verdict harga</td>
            </tr></table>
          </td>
        </tr>`
}

export function buildColourProbeHtml(): string {
  return `<!DOCTYPE html>
<html lang="ms" style="background:${BG};">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Paqar colour probe</title>
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  a { text-decoration:none; }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG};">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="width:100%;max-width:600px;background:${BG};">
          <tr>
            <td style="padding:32px 24px 24px;">
              <div style="font-family:${FONT};font-size:15px;font-weight:800;color:${LABEL};line-height:1.4;">Paqar colour probe</div>
              <div style="font-family:${FONT};font-size:12px;font-weight:400;color:${LABEL};line-height:1.6;padding-top:6px;">Screenshot this whole e-mail. Any row whose sample is no longer off-white was rewritten by the mail client.</div>
            </td>
          </tr>

          <!-- text colour ladder -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${CANDIDATES.map(row).join('')}
              </table>
            </td>
          </tr>

          <!-- button label test: which survives on coral, white or near-black -->
          <tr>
            <td style="padding:16px 24px 0;">
              <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${LABEL};line-height:1;padding-bottom:8px;">BUTTON &mdash; WHITE LABEL</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F05A50" style="background:#F05A50;border-radius:12px;">
                <tr><td align="center" style="padding:17px 16px;">
                  <span style="font-family:${FONT};font-size:17px;font-weight:800;color:#FFFFFF;line-height:22px;">Semak JUF222 &mdash; RM12</span>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${LABEL};line-height:1;padding-bottom:8px;">BUTTON &mdash; NEAR-BLACK LABEL</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F05A50" style="background:#F05A50;border-radius:12px;">
                <tr><td align="center" style="padding:17px 16px;">
                  <span style="font-family:${FONT};font-size:17px;font-weight:800;color:#1A0F0E;line-height:22px;">Semak JUF222 &mdash; RM12</span>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- does the mint survive, or is it the colour everything is being pulled toward -->
          <tr>
            <td style="padding:24px 24px 40px;">
              <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${LABEL};line-height:1;padding-bottom:5px;">MINT #6FDFCF &amp; AMBER #C8A96A</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="font-family:${FONT};font-size:17px;font-weight:800;color:#6FDFCF;line-height:1.3;">Paqar</td>
                <td align="right" style="font-family:${FONT};font-size:13px;font-weight:600;color:#C8A96A;line-height:1.3;">Own Damage</td>
              </tr></table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
