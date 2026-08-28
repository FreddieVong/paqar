/**
 * Paqar retargeting e-mail — the buyer report, in the brand's own voice.
 *
 * Light-native and on-brand, matching paqar.my rather than inventing a palette.
 * Table-based, Gmail/Outlook safe. Pure function, no env access, so it can be
 * rendered to disk for visual review.
 *
 * Why light and not dark: the brand is light (DESIGN.md §3.1), the logo is a
 * JPEG with a hard white background so it can only sit on white, and the
 * primary #3D472F is a dark teal meant to sit ON light. A dark treatment forced
 * an off-brand mint/coral palette. Clients that impose their own dark mode will
 * darken this, which is the ordinary thing readers already expect from mail.
 *
 * Design tokens mirror tailwind.config.ts `brand.*` — e-mail cannot read the
 * Tailwind theme, so they are restated here and must be kept in step:
 *   primary #3D472F · deep #3D472F · accent #FACC15 · page #F8FAF7
 *   surface #FFFFFF · text #111827 · muted #6B7280 · border #E5E7EB
 * Radius scale: 10 / 14 / 16.  Spacing: multiples of 4.
 */

const C = {
  page:     '#F8FAF7',
  surface:  '#FFFFFF',
  deep:     '#3D472F',
  primary:  '#3D472F',
  accent:   '#FACC15',
  text:     '#111827',
  body:     '#374151',
  muted:    '#6B7280',
  dim:      '#9CA3AF',
  border:   '#E5E7EB',
  hair:     '#F3F4F6',
  warnBg:   '#FFFBEB',
  warnLine: '#FDE68A',
  warnText: '#B45309',
  warnBody: '#78350F',
  warnPill: '#92400E',
} as const

// Plus Jakarta Sans / DM Sans are webfonts; Gmail strips @font-face, so the
// system stack is what actually renders for most readers. Naming the brand
// faces first still picks them up in Apple Mail, where they do load.
const HEAD = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const BODY = "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

/**
 * public/paqar-logo.png is a 1024x1024 JPEG whose wordmark occupies a 813x210
 * band — 79% of the file is white padding. paqar-logo-email.png is that band
 * trimmed to 383x120 and served at 160px, a 2.4x retina factor.
 *
 * Its background is deliberately OPAQUE white, not transparent. A probe send
 * showed this reader's client applies a full lightness inversion (L -> 100-L,
 * hue kept) to the whole message, and transforms of that kind skip images. A
 * transparent logo would keep its dark teal and vanish against the inverted
 * near-black background; an opaque plate carries its own white with it and
 * stays legible whichever way the message is rendered.
 */
const LOGO_URL = 'https://paqar.my/paqar-logo-email.png'
const LOGO_W   = 160
const LOGO_H   = 50

export interface RetargetEmailInsight {
  askingRm: number
  medianRm: number
  count:    number
  verdict:  'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'
}

export interface RetargetEmailContent {
  /**
   * One-click opt-out. Optional so existing callers and tests keep compiling,
   * but every live send supplies it — an e-mail that cannot be stopped is the
   * problem this was added to fix.
   */
  unsubscribeUrl?: string
  plate?:     string
  reportUrl:  string
  /** Omitted whenever the price picture cannot be stated safely — see
   *  lib/email/retarget-insight.ts. The e-mail then falls back to its generic
   *  opener rather than inventing a number. */
  insight?:   RetargetEmailInsight | null
}

const rm = (n: number) => `RM${Math.round(n).toLocaleString('en-MY')}`

/**
 * Verdict-led opener. The lead already told us the asking price, so the useful
 * sentence is what that price means, not "belum buat keputusan?".
 *
 * Wording tracks the report's own labels (BERBALOI / WAJAR / AGAK MAHAL /
 * MAHAL) without asserting more than the cohort supports: the gap is described
 * as a comparison against the market middle, never as a promise of savings.
 */
function heroFor(verdict: RetargetEmailInsight['verdict'], plate: string): { line: string; note: string } {
  switch (verdict) {
    case 'overpriced':
      return {
        line: `Harga ${plate} lebih tinggi<br>dari pasaran.`,
        note: 'Ada ruang untuk runding. Laporan tunjukkan berapa dan ayat untuk guna.',
      }
    case 'slightly_high':
      return {
        line: `Harga ${plate} sedikit<br>di atas pasaran.`,
        note: 'Ada ruang untuk tawar. Laporan tunjukkan berapa dan ayat untuk guna.',
      }
    case 'good_deal':
      return {
        line: `Harga ${plate} di bawah<br>pasaran semasa.`,
        note: 'Nampak menarik — tapi semak kenapa sebelum bayar deposit.',
      }
    case 'fair_price':
    default:
      return {
        line: `Harga ${plate} setakat ini<br>nampak wajar.`,
        note: 'Sebelum bayar deposit, semak kondisi dan dokumen kenderaan.',
      }
  }
}

/** Teal check disc + label, the same pairing the homepage value stack uses. */
function benefit(label: string): string {
  return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                      <td valign="top" width="24" style="padding:0 0 10px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td class="s-disc" width="16" height="16" align="center" valign="middle" bgcolor="${C.deep}" style="width:16px;height:16px;background:${C.deep};border-radius:8px;font-family:${HEAD};font-size:10px;font-weight:700;color:#FFFFFF;line-height:16px;">&#10003;</td>
                        </tr></table>
                      </td>
                      <td valign="top" class="t-body" style="padding:0 0 10px;font-family:${BODY};font-size:14px;font-weight:500;color:${C.body};line-height:1.45;">${label}</td>
                    </tr></table>`
}

/** White pill on the amber panel — mirrors BuyerReportPitch's add-on badges. */
function pill(label: string): string {
  return `<td style="padding:0 6px 6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td class="s-pill" bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.warnLine};border-radius:999px;padding:4px 10px;font-family:${HEAD};font-size:11px;font-weight:700;color:${C.warnPill};line-height:1.2;white-space:nowrap;">${label}</td>
                        </tr></table></td>`
}

export function buildRetargetEmailHtml(content: RetargetEmailContent): string {
  const plate      = content.plate?.trim().toUpperCase() || ''
  const hasPlate   = plate.length > 0
  const subjectRef = hasPlate ? plate : 'kereta ini'
  // "dari RM29", not "RM29": RM29 is the floor and the claim check adds RM88.
  // The flat-price exception belongs to the checkout button that charges exactly
  // RM29 — this one only opens a page.
  const ctaLabel   = hasPlate ? `Semak ${plate} &mdash; dari RM29` : 'Semak laporan &mdash; dari RM29'
  const url        = content.reportUrl
  // Only personalise when there is a plate to name; the no-plate fallback has
  // nothing to anchor a price claim to.
  const insight    = hasPlate ? (content.insight ?? null) : null
  const hero       = insight ? heroFor(insight.verdict, plate) : null

  return `<!DOCTYPE html>
<html lang="ms" style="background:${C.page};">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Laporan Pembeli Paqar</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  a { text-decoration:none; }
  body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }

  /* Outlook mobile rewrites colours it dislikes and tags what it touched with
     data-ogsc (text) / data-ogsb (background). These put the palette back so a
     forced dark theme cannot land white text on a white pill, or drop the teal. */
  [data-ogsc] .t-hi    { color:${C.text} !important; }
  [data-ogsc] .t-body  { color:${C.body} !important; }
  [data-ogsc] .t-mute  { color:${C.muted} !important; }
  [data-ogsc] .t-dim   { color:${C.dim} !important; }
  [data-ogsc] .t-teal  { color:${C.primary} !important; }
  [data-ogsc] .t-inv   { color:#FFFFFF !important; }
  [data-ogsc] .t-warn  { color:${C.warnText} !important; }
  [data-ogsc] .t-warnb { color:${C.warnBody} !important; }
  [data-ogsc] .t-pill  { color:${C.warnPill} !important; }
  [data-ogsb] .s-page  { background:${C.page} !important; }
  [data-ogsb] .s-card  { background:${C.surface} !important; }
  [data-ogsb] .s-deep  { background:${C.deep} !important; }
  [data-ogsb] .s-cta   { background:${C.primary} !important; }
  [data-ogsb] .s-warn  { background:${C.warnBg} !important; }
  [data-ogsb] .s-pill  { background:${C.surface} !important; }
  [data-ogsb] .s-disc  { background:${C.deep} !important; }
  [data-ogsb] .s-dot   { background:${C.accent} !important; }

  @media only screen and (max-width:600px) {
    .page-pad { padding:16px 10px !important; }
    .gutter   { padding-left:20px !important; padding-right:20px !important; }
    .hero     { font-size:24px !important; line-height:1.2 !important; }
    .plate-no { font-size:30px !important; }
    .pad-lg   { padding:18px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Sebelum bayar deposit &mdash; semak sama ada harga ${subjectRef} berbaloi.</div>

  <table role="presentation" class="s-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
    <tr>
      <td align="center" class="page-pad" style="padding:28px 16px;">
        <table role="presentation" class="s-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="width:100%;max-width:600px;background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">

          <!-- ── identity ─────────────────────────────────────────────
               alt text is styled so the clients that block images by default
               still render the brand name in the brand colour. -->
          <tr>
            <td class="gutter" style="padding:24px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="left" valign="middle" style="line-height:0;font-size:0;">
                  <img src="${LOGO_URL}" width="${LOGO_W}" height="${LOGO_H}" alt="Paqar"
                       style="display:block;width:${LOGO_W}px;height:${LOGO_H}px;border:0;font-family:${HEAD};font-size:19px;font-weight:800;color:${C.primary};" />
                </td>
                <td align="right" valign="middle" class="t-dim" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.14em;color:${C.dim};line-height:1;">LAPORAN PEMBELI</td>
              </tr></table>
            </td>
          </tr>

          <!-- ── registration plate ───────────────────────────────────
               The one deep-teal block, mirroring the homepage RM29 card so the
               e-mail is recognisably the same product. -->
          ${hasPlate ? `
          <tr>
            <td class="gutter" style="padding:20px 24px 0;">
              <table role="presentation" class="s-deep" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.deep}" style="background:${C.deep};border-radius:14px;">
                <tr>
                  <td class="pad-lg" style="padding:18px 20px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td align="left" valign="middle">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td valign="middle" width="12" style="padding-right:7px;">
                            <div class="s-dot" style="width:6px;height:6px;background:${C.accent};border-radius:3px;font-size:0;line-height:0;">&nbsp;</div>
                          </td>
                          <td valign="middle" class="t-inv" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.14em;color:#FFFFFF;opacity:0.55;line-height:1;">NO.&nbsp;PENDAFTARAN</td>
                        </tr></table>
                      </td>
                      <td align="right" valign="middle" class="t-inv" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.14em;color:#FFFFFF;opacity:0.4;line-height:1;">MALAYSIA</td>
                    </tr></table>
                    <div class="plate-no t-inv" style="font-family:${HEAD};font-size:33px;font-weight:800;letter-spacing:0.12em;color:#FFFFFF;line-height:1.15;padding-top:10px;">${plate}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- ── hero ─────────────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:26px 24px 0;">
              <div class="hero t-hi" style="font-family:${HEAD};font-size:26px;font-weight:800;letter-spacing:-0.02em;color:${C.text};line-height:1.18;">${
                hero ? hero.line : `Belum buat keputusan<br>tentang ${subjectRef}?`
              }</div>
            </td>
          </tr>
          <tr>
            <td class="gutter" style="padding:12px 24px 0;">
              <div class="t-mute" style="font-family:${BODY};font-size:15px;font-weight:400;color:${C.muted};line-height:1.6;">${
                hero ? hero.note : 'Sebelum bayar deposit, semak sama ada harganya berbaloi dan perkara penting yang mungkin tidak diberitahu oleh seller.'
              }</div>
            </td>
          </tr>

          <!-- ── the two numbers that matter ──────────────────────────────
               Seller's price against the market middle, side by side. Both
               derive from the one cohort in lib/email/retarget-insight.ts, and
               the listing count is stated so the comparison can be judged
               rather than taken on faith. -->
          ${insight ? `
          <tr>
            <td class="gutter" style="padding:20px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:14px;">
                <tr>
                  <td class="pad-lg" width="50%" valign="top" style="padding:18px 20px;">
                    <div class="t-dim" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.12em;color:${C.dim};line-height:1.3;height:24px;">SELLER MINTA</div>
                    <div class="t-hi" style="font-family:${HEAD};font-size:21px;font-weight:800;letter-spacing:-0.02em;color:${C.text};line-height:1.1;">${rm(insight.askingRm)}</div>
                  </td>
                  <td class="pad-lg" width="50%" valign="top" style="padding:18px 20px 18px 0;">
                    <div class="t-dim" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.12em;color:${C.dim};line-height:1.3;height:24px;">HARGA TENGAH<br>PASARAN</div>
                    <div class="t-teal" style="font-family:${HEAD};font-size:21px;font-weight:800;letter-spacing:-0.02em;color:${C.primary};line-height:1.1;">${rm(insight.medianRm)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" class="gutter" style="padding:0 20px 16px;">
                    <div style="height:1px;background:${C.hair};font-size:0;line-height:0;">&nbsp;</div>
                    <div class="t-dim" style="font-family:${BODY};font-size:11.5px;font-weight:400;color:${C.dim};line-height:1.55;padding-top:11px;">Berdasarkan ${insight.count} iklan model dan tahun yang sama yang kami jumpa.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- ── primary CTA ──────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:22px 24px 0;">
              <table role="presentation" class="s-cta" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.primary}" style="background:${C.primary};border-radius:12px;">
                <tr>
                  <td align="center" style="padding:16px;">
                    <a href="${url}" class="t-inv" style="display:block;font-family:${HEAD};font-size:16px;font-weight:800;letter-spacing:-0.01em;color:#FFFFFF;line-height:21px;text-decoration:none;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="gutter" align="center" style="padding:11px 24px 0;">
              <div class="t-dim" style="font-family:${BODY};font-size:12px;font-weight:400;color:${C.dim};line-height:1.55;">Laporan harga dan panduan pembeli.<br>Semakan sejarah claim tersedia sebagai tambahan.</div>
            </td>
          </tr>

          <!-- ── what's inside ────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:26px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:14px;">
                <tr>
                  <td class="pad-lg" style="padding:20px;">
                    <div class="t-dim" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.14em;color:${C.dim};line-height:1;padding-bottom:14px;">DALAM LAPORAN</div>
                    ${benefit('Verdict harga &mdash; berbaloi, wajar atau mahal')}
                    ${benefit('Julat dan harga tengah iklan setanding')}
                    ${benefit('Skrip rundingan siap pakai')}
                    ${benefit('Checklist sebelum bayar deposit')}
                    <!-- Text link, not an embedded screenshot: images are blocked
                         by default in Gmail/Outlook/Yahoo, so a sample image would
                         render as an empty box for much of the list. -->
                    <div style="padding-top:6px;">
                      <div style="height:1px;background:${C.hair};font-size:0;line-height:0;">&nbsp;</div>
                      <div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>
                      <a href="https://paqar.my/contoh-laporan" class="t-teal" style="font-family:${HEAD};font-size:14px;font-weight:700;color:${C.primary};line-height:1.4;text-decoration:none;">Lihat contoh laporan penuh &rarr;</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── paid add-on ──────────────────────────────────────────────
               Same amber treatment and the same four words as the on-site
               add-on block, so a visitor who saw the ad recognises them here. -->
          <tr>
            <td class="gutter" style="padding:12px 24px 0;">
              <table role="presentation" class="s-warn" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.warnBg}" style="background:${C.warnBg};border:1px solid ${C.warnLine};border-radius:14px;">
                <tr>
                  <td class="pad-lg" style="padding:18px 20px;">
                    <div class="t-warn" style="font-family:${HEAD};font-size:9px;font-weight:700;letter-spacing:0.12em;color:${C.warnText};line-height:1;padding-bottom:11px;">TAMBAHAN &mdash; SEMAKAN ACCIDENT/CLAIM</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      ${pill('Rekod kemalangan')}${pill('Tuntutan insurans')}
                    </tr><tr>
                      ${pill('Risiko banjir')}${pill('Total loss')}
                    </tr></table>
                    <div class="t-warnb" style="font-family:${BODY};font-size:12px;font-weight:400;color:${C.warnBody};line-height:1.55;padding-top:10px;"><strong>Tidak termasuk</strong> dalam Laporan Pembeli RM29 &mdash; boleh ditambah selepas anda buka laporan.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── footer ───────────────────────────────────────────────── -->
          <tr>
            <td class="gutter" style="padding:26px 24px 0;">
              <div style="height:1px;background:${C.hair};font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td class="gutter" style="padding:16px 24px 26px;">
              <div class="t-dim" style="font-family:${BODY};font-size:11px;font-weight:400;color:${C.dim};line-height:1.7;">
                Anda menerima emel ini kerana anda memasukkan alamat emel semasa menyemak sebuah kereta di Paqar.<br>
                ${content.unsubscribeUrl
                  ? `<a href="${content.unsubscribeUrl}" class="t-mute" style="color:${C.muted};text-decoration:underline;">Berhenti terima emel</a>&nbsp;&middot;&nbsp;`
                  : ''}<a href="https://paqar.my" class="t-mute" style="color:${C.muted};text-decoration:none;">paqar.my</a>
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
