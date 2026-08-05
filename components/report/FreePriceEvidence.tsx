'use client'

import { useEffect, useState, useRef } from 'react'
import { analytics }     from '@/lib/analytics'
import { trackAdEvent }  from '@/lib/meta-events'

type Verdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

type Evidence = {
  state:         'evidence'
  verdict:       Verdict | null
  verdictStatus: 'normal' | 'provisional' | 'suppressed'
  verdictReason: 'insufficient_data' | 'mixed_variants' | null
  listingCount:  number
  minPrice:      number | null
  maxPrice:      number | null
  confidence:    'low' | 'medium' | 'high'
  variantToken:  string | null
  // medianPrice is deliberately not part of this contract — see the API route.
}
type Response =
  | Evidence
  | { state: 'pending_vehicle' }
  | { state: 'pending_market' }
  | { state: 'needs_asking_price' }

const VERDICT = {
  overpriced:    { badge: 'MAHAL',      cls: 'bg-[#DC2626] text-white', card: 'bg-[#FEF2F2] border-[#FECACA]', line: 'Harga ini di atas julat pasaran semasa.' },
  slightly_high: { badge: 'AGAK MAHAL', cls: 'bg-[#B45309] text-white', card: 'bg-[#FFFBEB] border-[#FDE68A]', line: 'Harga ini sedikit di atas julat pasaran semasa.' },
  fair_price:    { badge: 'WAJAR',      cls: 'bg-[#064E4A] text-white', card: 'bg-[#F0FDF4] border-[#BBF7D0]', line: 'Harga ini berada dalam julat pasaran semasa.' },
  good_deal:     { badge: 'BERBALOI',   cls: 'bg-[#0891B2] text-white', card: 'bg-[#F0FAFA] border-[#99D4D1]', line: 'Harga ini di bawah julat pasaran semasa — semak sebabnya.' },
} as const

const CONFIDENCE = {
  high:   { label: 'Keyakinan data: Tinggi',    cls: 'text-[#15803D]', dot: 'bg-[#22C55E]' },
  medium: { label: 'Keyakinan data: Sederhana', cls: 'text-[#B45309]', dot: 'bg-[#F59E0B]' },
  low:    { label: 'Data pasaran terhad',       cls: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]' },
} as const

const fmt = (n: number) => n.toLocaleString('en-MY')

/**
 * Free price evidence on the plate path.
 *
 * Shows where the asking price sits in the market — verdict, range, count,
 * confidence — and stops there. The negotiation anchor (median), the target
 * offer, the trade-in band and the seller script stay in the RM12 report,
 * which is what the CTA below now sells. The API never serialises a median, so
 * none of that can leak through this component.
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
      analytics.plateEvidenceViewed({ listing_count: data.listingCount, confidence: data.confidence })
      trackAdEvent('plate_price_evidence_viewed', { checkId, valuationPath: 'plate_report' })
    })
    if (data.verdict) {
      once('verdict', () => {
        analytics.plateVerdictViewed({ verdict: data.verdict!, status: data.verdictStatus, listing_count: data.listingCount })
        trackAdEvent('plate_verdict_viewed', { checkId, valuationPath: 'plate_report' })
      })
    } else {
      once('suppressed', () => {
        analytics.plateVerdictSuppressed({ reason: data.verdictReason ?? 'insufficient_data', listing_count: data.listingCount })
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

  const suppressed = data.verdictStatus === 'suppressed'
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
            {data.variantToken
              ? `Iklan untuk “${data.variantToken}” terlalu sedikit — yang ada termasuk varian lain, dan harganya jauh berbeza.`
              : 'Iklan yang ada termasuk varian lain, dan harganya jauh berbeza.'}
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
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
            {data.listingCount === 0
              ? 'Tiada iklan setanding dijumpai buat masa ini.'
              : `Hanya ${data.listingCount} iklan setanding dijumpai — terlalu sedikit untuk harga pasaran.`}
          </p>
        </>
      )}

      {/* ── 3. Market range (never the median) ── */}
      {data.minPrice != null && data.maxPrice != null && (
        <p className="font-body text-[13px] text-[#374151] mt-1">
          {suppressed ? 'Julat iklan dijumpai: ' : 'Harga pasaran: '}
          <strong>RM{fmt(data.minPrice)} – RM{fmt(data.maxPrice)}</strong>
        </p>
      )}

      {/* ── 4. Count + confidence, and the provisional caution ── */}
      {data.listingCount > 0 && (
        <>
          <p className="font-body text-[11px] text-[#9CA3AF] mt-1">
            Berdasarkan {data.listingCount} iklan setanding di pasaran
          </p>
          {data.verdictStatus === 'provisional' && (
            <p className="font-body text-[12px] font-semibold text-[#B45309] mt-2 leading-relaxed">
              Anggaran awal — hanya {data.listingCount} iklan setanding ditemui.
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
            <span className={`font-body text-[11px] font-semibold ${conf.cls}`}>{conf.label}</span>
          </div>
        </>
      )}
    </div>
  )
}
