import React from 'react'
import { writeFileSync } from 'node:fs'
import { ImageResponse } from 'next/og'
import { SAMPLE_VERDICT, SAMPLE_DISCLAIMER } from '../components/report/SampleVerdictCard'
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
 * The ad needs to show the verdict card, because that card IS the product and
 * no competitor can show one. The two alternatives were both bad: a screen
 * recording (the report now waits on a human review, so it cannot be filmed in
 * one take) and a generated image (which would be a drawing of a product rather
 * than the product).
 *
 * ── EVERY FIGURE IS IMPORTED ───────────────────────────────────────────────
 *
 * SAMPLE_VERDICT, BASE_REPORT_LABEL and TYPICAL_MINUTES come from the modules
 * the site itself renders from. An ad is the one surface nobody re-reads before
 * it runs, and a price or a claim typed here could drift from the checkout
 * silently and in public. app/api/og/route.tsx already shows what that costs —
 * it has RM43,000 / RM51,400 / "23 iklan" hardcoded, none of which match
 * SAMPLE_VERDICT any more.
 *
 * ── WHAT IT MAY NOT SAY ────────────────────────────────────────────────────
 *
 * No instant result: the report waits on a human, so the wait is stated rather
 * than hidden — it is also the only thing here a competitor cannot copy. The
 * sample disclaimer travels with the figures, exactly as it does on the site.
 */

const OLIVE = '#3D472F'
const INK   = '#111827'
const MUTED = '#6B7280'
const RED   = '#DC2626'
const REDBG = '#FEF2F2'
const RULE  = '#FECACA'
const YELLOW = '#FACC15'

const row = (label: string, value: string, strong = false) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
    <span style={{ fontSize: '30px', color: MUTED }}>{label}</span>
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

        {/* Brand strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '56px 64px 0' }}>
          <div style={{ background: YELLOW, width: '24px', height: '24px', borderRadius: '6px' }} />
          <span style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '0.16em', color: MUTED }}>PAQAR</span>
        </div>

        {/* The hook — the buyer's question, not Paqar's process */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '36px 64px 0' }}>
          <span style={{ fontSize: '66px', fontWeight: 800, lineHeight: 1.06, color: INK, letterSpacing: '-0.02em' }}>
            Berbaloi ke
          </span>
          <span style={{ fontSize: '66px', fontWeight: 800, lineHeight: 1.06, color: OLIVE, letterSpacing: '-0.02em' }}>
            harga tu?
          </span>
        </div>

        {/* THE PRODUCT. Not a description of it. */}
        <div style={{
          margin: '44px 64px 0', background: REDBG, borderRadius: '20px',
          padding: '40px 44px', display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.10em', color: OLIVE, marginBottom: '14px' }}>
            KEPUTUSAN PAQAR
          </span>
          <span style={{ fontSize: '76px', fontWeight: 800, color: RED, lineHeight: 1 }}>
            {SAMPLE_VERDICT.badge}
          </span>
          <span style={{ fontSize: '36px', fontWeight: 700, color: INK, marginTop: '10px', marginBottom: '30px' }}>
            {SAMPLE_VERDICT.action}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {row('Seller minta', SAMPLE_VERDICT.askingPrice)}
            {row(SAMPLE_VERDICT.rangeLabel, SAMPLE_VERDICT.range)}
            {row(SAMPLE_VERDICT.gapLabel, SAMPLE_VERDICT.gap, true)}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', marginTop: '26px',
            paddingTop: '24px', borderTop: `2px solid ${RULE}`,
          }}>
            <span style={{ fontSize: '24px', color: MUTED, marginBottom: '8px' }}>Cadangan</span>
            <span style={{ fontSize: '32px', fontWeight: 700, color: INK, lineHeight: 1.3 }}>
              {SAMPLE_VERDICT.suggestion}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', padding: '16px 64px 0' }}>
          <span style={{ fontSize: '20px', color: MUTED }}>{SAMPLE_DISCLAIMER}</span>
        </div>

        <div style={{ flex: 1, display: 'flex' }} />

        {/* The offer, and the wait stated honestly */}
        <div style={{
          background: OLIVE, padding: '44px 64px 52px',
          display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ fontSize: '44px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15 }}>
            {BASE_REPORT_LABEL} &middot; Disemak oleh manusia
          </span>
          <span style={{ fontSize: '30px', color: 'rgba(255,255,255,0.72)', marginTop: '14px' }}>
            Hantar link iklan &middot; biasanya siap dalam {TYPICAL_MINUTES} minit
          </span>
          <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.4)', marginTop: '26px', letterSpacing: '0.05em' }}>
            paqar.my
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  )

  const buf = Buffer.from(await img.arrayBuffer())
  writeFileSync(out, buf)
  console.log(`wrote ${out}  (${(buf.length / 1024).toFixed(0)} KB, 1080x1350)`)
  console.log('\nfigures used — all imported, none typed:')
  console.log(`  verdict     ${SAMPLE_VERDICT.badge} / ${SAMPLE_VERDICT.action}`)
  console.log(`  asking      ${SAMPLE_VERDICT.askingPrice}`)
  console.log(`  range       ${SAMPLE_VERDICT.range}`)
  console.log(`  gap         ${SAMPLE_VERDICT.gap}`)
  console.log(`  price       ${BASE_REPORT_LABEL}`)
  console.log(`  review time ${TYPICAL_MINUTES} minit`)
}

main().catch((e) => { console.error(e); process.exit(1) })
