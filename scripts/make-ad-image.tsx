import React from 'react'
import { writeFileSync } from 'node:fs'
import { ImageResponse } from 'next/og'
import { SAMPLE_VERDICT, SAMPLE_DISCLAIMER } from '../components/report/SampleVerdictCard'
import { SELLER_QUESTIONS } from '../components/report/SampleReportPreview'
import { BASE_REPORT_LABEL } from '../lib/pricing'
import { TYPICAL_MINUTES } from '../lib/review-capacity'

/**
 * Renders the REVIEWED_OFFER ad creative to a PNG — 1080x1350, the 4:5 every
 * Paqar graphic has used.
 *
 *   npx tsx scripts/make-ad-image.tsx [out.png]
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The ad must show the report, because the report IS the product and no
 * competitor can show one. A screen recording cannot be filmed in one take any
 * more — lib/report-release.ts makes an unreviewed report unreachable, so
 * paste-to-result is a wait, not a moment. A generated image would be a drawing
 * of a product rather than the product.
 *
 * ── WHAT THE FIRST VERSION GOT WRONG ───────────────────────────────────────
 *
 * It rendered SampleVerdictCard and stopped: a price band on a white card, with
 * no logo, no car, and nothing a buyer recognises. That is PRODUCT PROOF, which
 * is a different job from an ad. Proof is read by someone already deciding; an
 * ad has about one second to earn the second one. It failed the 5-second test
 * this project holds every surface to, on the surface with the least time.
 *
 * What it now leads with is the thing a buyer can act on: the specific car, the
 * ringgit gap, and the questions to put to the seller. The seller questions are
 * the strongest content Paqar has — SampleReportPreview's own comment says two
 * of them are specific to THIS advert, and that specificity "is exactly the
 * comparison a buyer makes when deciding whether RM29 is worth it".
 *
 * ── EVERY FIGURE AND CLAIM IS IMPORTED ─────────────────────────────────────
 *
 * SAMPLE_VERDICT, SELLER_QUESTIONS, BASE_REPORT_LABEL and TYPICAL_MINUTES come
 * from the modules the site renders from. An ad is the one surface nobody
 * re-reads before it runs — app/api/og/route.tsx drifted to four wrong numbers
 * exactly that way.
 *
 * ── WHAT IT MAY NOT SAY ────────────────────────────────────────────────────
 *
 * No instant result: the report waits on a human, and that wait is the one
 * claim no competitor can copy, so it is stated rather than hidden. No JPJ or
 * registry badge: the provider names no Malaysian source. No variant ASSERTION
 * — variant matching is title-based, so the advert-mismatch line stays a
 * question to ask the seller, which is how the sample words it too.
 * SAMPLE_DISCLAIMER travels with the figures, as it does on the site.
 */

const OLIVE  = '#3D472F'
const INK    = '#111827'
const MUTED  = '#6B7280'
const RED    = '#DC2626'
const REDBG  = '#FEF2F2'

/** The car the whole sample is built on — named in SampleVerdictCard's header. */
const SAMPLE_CAR = 'Perodua Myvi 2019 · 1.3 X'

/**
 * The logo, fetched from the live site and cropped by layout.
 *
 * TWO THINGS HERE ARE NOT PREFERENCES.
 *
 * The URL is remote because Satori does not decode a base64 data: URI in this
 * Node context — it renders nothing at all, silently, and the first version of
 * this ad shipped with an empty strip where the logo should have been. It does
 * fetch http(s) images. So the source of truth is the deployed
 * /paqar-logo.png, which is the same file as public/paqar-logo.png.
 *
 * The crop is by layout because there is no image library installed.
 * paqar-logo.png is 1024x1024 with the wordmark in the middle third, so drawing
 * it directly gives a mostly-empty square. The wordmark occupies x 120-910,
 * y 398-616; scaling that window to `width` and offsetting inside an
 * overflow-hidden box shows the mark alone.
 */
const LOGO_URL = 'https://paqar.my/paqar-logo.png'

function Logo({ width = 300 }: { width?: number }) {
  const SRC_W = 1024, BOX_X = 120, BOX_Y = 398, BOX_W = 790, BOX_H = 218
  const scale = width / BOX_W
  return (
    <div style={{
      display: 'flex', overflow: 'hidden',
      width: `${width}px`, height: `${BOX_H * scale}px`,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_URL}
        width={SRC_W * scale}
        height={SRC_W * scale}
        style={{ marginLeft: `${-BOX_X * scale}px`, marginTop: `${-BOX_Y * scale}px` }}
        alt=""
      />
    </div>
  )
}

const Row = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
    <span style={{ fontSize: '28px', color: MUTED }}>{label}</span>
    <span style={{ fontSize: '32px', fontWeight: 700, color: strong ? RED : INK }}>{value}</span>
  </div>
)

async function main() {
  const out = process.argv[2] ?? 'paqar-reviewed-offer-1080x1350.png'

  const img = new ImageResponse(
    (
      <div style={{
        width: '1080px', height: '1350px', display: 'flex', flexDirection: 'column',
        background: '#FFFFFF', fontFamily: 'sans-serif',
      }}>

        <div style={{ display: 'flex', padding: '52px 64px 0' }}>
          <Logo width={280} />
        </div>

        {/* THE CAR. A used-car ad with no car in it is why the first version
            failed — nothing on it told a scrolling buyer what they were looking at. */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '38px 64px 0' }}>
          <span style={{ fontSize: '34px', fontWeight: 700, color: MUTED }}>{SAMPLE_CAR}</span>
          <div style={{ display: 'flex', marginTop: '18px' }}>
            <span style={{
              background: RED, color: '#FFFFFF', fontSize: '30px', fontWeight: 800,
              letterSpacing: '0.08em', padding: '8px 22px', borderRadius: '10px',
            }}>
              {SAMPLE_VERDICT.badge}
            </span>
          </div>
        </div>

        {/* The money, at the size the money deserves. */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '30px 64px 0' }}>
          <span style={{ fontSize: '118px', fontWeight: 800, color: RED, lineHeight: 1, letterSpacing: '-0.03em' }}>
            {SAMPLE_VERDICT.gap}
          </span>
          <span style={{ fontSize: '36px', fontWeight: 700, color: INK, marginTop: '6px' }}>
            {SAMPLE_VERDICT.gapLabel.toLowerCase()}
          </span>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '14px',
          margin: '34px 64px 0', padding: '30px 30px',
          background: REDBG, borderRadius: '16px',
        }}>
          <Row label="Seller minta" value={SAMPLE_VERDICT.askingPrice} />
          <Row label={SAMPLE_VERDICT.rangeLabel} value={SAMPLE_VERDICT.range} />
        </div>

        {/* The part a buyer can actually use tomorrow morning. */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '42px 64px 0' }}>
          <span style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '0.06em', color: OLIVE, marginBottom: '16px' }}>
            KAMI BERITAHU APA NAK TANYA SELLER
          </span>
          {SELLER_QUESTIONS.slice(0, 4).map((q) => (
            <div key={q} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
              <span style={{ fontSize: '30px', color: OLIVE, fontWeight: 800, lineHeight: 1.35 }}>·</span>
              <span style={{ fontSize: '29px', color: INK, lineHeight: 1.35 }}>{q}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', padding: '10px 64px 0' }}>
          <span style={{ fontSize: '20px', color: '#9CA3AF' }}>{SAMPLE_DISCLAIMER}</span>
        </div>

        <div style={{ flex: 1, display: 'flex' }} />

        <div style={{ background: OLIVE, padding: '40px 64px 46px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '46px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15 }}>
            {BASE_REPORT_LABEL} &middot; Disemak oleh manusia
          </span>
          <span style={{ fontSize: '29px', color: 'rgba(255,255,255,0.72)', marginTop: '12px' }}>
            Hantar link iklan &middot; biasanya siap dalam {TYPICAL_MINUTES} minit
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  )

  const buf = Buffer.from(await img.arrayBuffer())
  writeFileSync(out, buf)
  console.log(`wrote ${out}  (${(buf.length / 1024).toFixed(0)} KB, 1080x1350)`)
  console.log('\nimported, none typed:')
  console.log(`  car         ${SAMPLE_CAR}`)
  console.log(`  verdict     ${SAMPLE_VERDICT.badge}`)
  console.log(`  gap         ${SAMPLE_VERDICT.gap} ${SAMPLE_VERDICT.gapLabel}`)
  console.log(`  asking      ${SAMPLE_VERDICT.askingPrice}`)
  console.log(`  range       ${SAMPLE_VERDICT.range}`)
  console.log(`  price       ${BASE_REPORT_LABEL}`)
  console.log(`  review      ${TYPICAL_MINUTES} minit`)
  console.log('  questions:')
  for (const q of SELLER_QUESTIONS.slice(0, 4)) console.log(`    - ${q}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
