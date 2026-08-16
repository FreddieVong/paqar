'use client'

import { useEffect, useState, useRef } from 'react'
import { analytics }     from '@/lib/analytics'
import { trackAdEvent }  from '@/lib/meta-events'
import { VERDICT_LINE } from '@/lib/verdict-copy'

type Verdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

type Evidence = {
  state:         'evidence'
  verdict:       Verdict | null
  verdictStatus: 'normal' | 'provisional' | 'suppressed'
  verdictReason: 'insufficient_data' | 'mixed_variants' | null
  confidence:    'low' | 'medium' | 'high'
  variantToken:  string | null
  // No median, range or comparable count — see the API route. Free answers
  // WHETHER the price is right; RM12 answers what to do about it.
}
type Response =
  | Evidence
  | { state: 'pending_vehicle' }
  | { state: 'pending_market' }
  | { state: 'needs_asking_price' }

// Styling stays here; the SENTENCE comes from lib/verdict-copy so the model tab
// and the plate tab can never describe the same verdict differently.
const VERDICT = {
  overpriced:    { badge: 'MAHAL',      cls: 'bg-[#DC2626] text-white', card: 'bg-[#FEF2F2] border-[#FECACA]', line: VERDICT_LINE.overpriced },
  slightly_high: { badge: 'AGAK MAHAL', cls: 'bg-[#B45309] text-white', card: 'bg-[#FFFBEB] border-[#FDE68A]', line: VERDICT_LINE.slightly_high },
  fair_price:    { badge: 'WAJAR',      cls: 'bg-[#064E4A] text-white', card: 'bg-[#F0FDF4] border-[#BBF7D0]', line: VERDICT_LINE.fair_price },
  good_deal:     { badge: 'BERBALOI',   cls: 'bg-[#0891B2] text-white', card: 'bg-[#F0FAFA] border-[#99D4D1]', line: VERDICT_LINE.good_deal },
} as const

// `low` also carries the provisional meaning: a 3–4 comparable cohort is always
// low confidence, and 0–2 never gets a verdict, so a verdict shown alongside
// low confidence can only be provisional.
const CONFIDENCE = {
  high:   { label: 'Keyakinan data: Tinggi',    cls: 'text-[#15803D]', dot: 'bg-[#22C55E]', sub: null },
  medium: { label: 'Keyakinan data: Sederhana', cls: 'text-[#B45309]', dot: 'bg-[#F59E0B]', sub: null },
  low:    { label: 'Data pasaran terhad',       cls: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]',
            sub: 'Anggaran awal sahaja — data pasaran untuk kereta ini masih terhad.' },
} as const

/**
 * Free price evidence on the plate path.
 *
 * Answers WHETHER the price is right — verdict, one qualitative sentence,
 * confidence — and stops there. Every figure (median, range, gap, offer,
 * trade-in) belongs to the RM12 report, which is what the CTA below sells.
 *
 * The comparable count goes too. It is the one number that describes Paqar's
 * sample rather than the buyer's car, and it invites auditing the method
 * instead of acting on the conclusion. The API never serialises any of it, so
 * none of it can leak through this component.
 */
export function FreePriceEvidence({
  checkId, claimToken, initialAskingPrice,
}: {
  checkId: string
  claimToken: string
  initialAskingPrice?: number
}) {
  const [asking, setAsking]   = useState<number | null>(initialAskingPrice ?? null)
  const [input, setInput]     = useState('')
  const [data, setData]       = useState<Response | null>(null)
  const polls                 = useRef(0)
  const fired                 = useRef<Set<string>>(new Set())

  // One-shot events: this component re-renders on every poll, and a funnel
  // stage counted twice is worse than one not counted at all.
  function once(key: string, fn: () => void) {
    if (fired.current.has(key)) return
    fired.current.add(key)
    fn()
  }

  useEffect(() => {
    if (asking == null) return
    let stop = false
    async function load() {
      polls.current += 1
      try {
        const res = await fetch(
          `/api/checks/${checkId}/price-evidence?claim_token=${encodeURIComponent(claimToken)}&asking_price=${asking}`,
        )
        const json = await res.json() as Response
        if (stop) return
        setData(json)
        // Vehicle/market lookups are async; keep polling until evidence lands.
        if (json.state !== 'evidence' && polls.current < 12) setTimeout(load, 2500)
      } catch {
        if (!stop && polls.current < 12) setTimeout(load, 2500)
      }
    }
    load()
    return () => { stop = true }
  }, [asking, checkId, claimToken])

  useEffect(() => {
    if (!data || data.state !== 'evidence') return
    once('evidence', () => {
      analytics.plateEvidenceViewed({ confidence: data.confidence })
      trackAdEvent('plate_price_evidence_viewed', { checkId, valuationPath: 'plate_report' })
    })
    if (data.verdict) {
      once('verdict', () => {
        analytics.plateVerdictViewed({ verdict: data.verdict!, status: data.verdictStatus, confidence: data.confidence })
        trackAdEvent('plate_verdict_viewed', { checkId, valuationPath: 'plate_report' })
      })
    } else {
      once('suppressed', () => {
        analytics.plateVerdictSuppressed({ reason: data.verdictReason ?? 'insufficient_data', confidence: data.confidence })
        trackAdEvent('plate_verdict_suppressed', { checkId, valuationPath: 'plate_report' })
      })
    }
  }, [data, checkId])

  // ── 1. Ask for the price when it wasn't supplied ────────────────────────
  if (asking == null) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[15px] text-[#111827] mb-1">
          Berapa harga yang penjual minta?
        </p>
        <p className="font-body text-[13px] text-[#6B7280] mb-3 leading-relaxed">
          Masukkan harga dan kami tunjuk kedudukannya berbanding pasaran — percuma.
        </p>
        <form
          onSubmit={e => { e.preventDefault(); const n = parseInt(input, 10); if (n > 0) setAsking(n) }}
          className="flex gap-2"
        >
          <input
            type="number" inputMode="numeric" value={input} onChange={e => setInput(e.target.value)}
            placeholder="contoh: 45000"
            className="flex-1 min-w-0 bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                       font-heading font-semibold text-[16px] text-[#111827] placeholder:text-[#D1D5DB]
                       focus:outline-none focus:border-[#064E4A]"
          />
          <button type="submit" className="bg-[#064E4A] text-white font-heading font-bold text-[14px] rounded-xl px-4 flex-shrink-0">
            Semak
          </button>
        </form>
      </div>
    )
  }

  if (!data || data.state === 'pending_vehicle' || data.state === 'pending_market') {
    return (
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] p-5 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-[#D1D5DB] border-t-[#064E4A] animate-spin flex-shrink-0" />
        <p className="font-body text-[13px] text-[#374151]">Sedang semak harga pasaran…</p>
      </div>
    )
  }
  if (data.state !== 'evidence') return null

  const cfg        = data.verdict ? VERDICT[data.verdict] : null
  const conf       = CONFIDENCE[data.confidence]

  return (
    <div className={`border rounded-[14px] p-5 ${cfg ? cfg.card : 'bg-[#FFFBEB] border-[#FDE68A]'}`}>
      {/* ── 2. Verdict, or an honest suppression state ── */}
      {cfg ? (
        <>
          <span className={`inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-2 ${cfg.cls}`}>
            {cfg.badge}
          </span>
          <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">{cfg.line}</p>
        </>
      ) : data.verdictReason === 'mixed_variants' ? (
        <>
          <span className="inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-2 bg-[#FEF3C7] text-[#B45309]">
            VARIAN KHAS
          </span>
          <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
            Varian ini bercampur dalam iklan pasaran, jadi kami tidak beri keputusan harga.
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-1 leading-relaxed">
            Iklan untuk varian ini terlalu sedikit — yang ada termasuk varian lain,
            dan harganya jauh berbeza.
          </p>
        </>
      ) : (
        <>
          <span className="inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-2 bg-[#F3F4F6] text-[#6B7280]">
            DATA TIDAK CUKUP
          </span>
          <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
            Belum cukup iklan setanding untuk beri keputusan harga.
          </p>
          {/* The headline says WHAT happened; this says what it means and what
              to do. It used to repeat the sentence above word for word, which
              read as a rendering fault on the one journey the ads pay for.
              No count, no range, no median — this is a free surface. The
              refresh advice is true because the route now re-scrapes a thin
              row in the background, exactly as the model checker does. */}
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
            Iklan untuk model, tahun dan varian ini masih terlalu sedikit di
            pasaran. Kami sedang cuba dapatkan lagi — muat semula halaman ini
            sebentar lagi.
          </p>
        </>
      )}

      {/* ── 3. How it was judged — method, not figures ── */}
      {cfg && (
        <p className="font-body text-[12px] text-[#6B7280] mb-2">
          Dinilai berdasarkan tahun, model dan varian kenderaan.
        </p>
      )}

      {/* ── 4. Confidence, which also carries the provisional signal ── */}
      <div className="mt-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
          <span className={`font-body text-[11px] font-semibold ${conf.cls}`}>{conf.label}</span>
        </div>
        {conf.sub && (
          <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">{conf.sub}</p>
        )}
      </div>
    </div>
  )
}
