'use client'

import { useEffect, useRef, useState } from 'react'
import type { PresentedFreeResult } from '@/lib/free-result'

/**
 * The free answer, in full: can Paqar build this buyer's report?
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────────
 *
 * FreePriceEvidence, which showed the verdict — MAHAL / WAJAR / BERBALOI —
 * before payment, while the paid report sold the figures underneath it. Giving
 * away the answer and charging for the footnotes is the boundary error that
 * killed the RM12 product.
 *
 * ── IT IS NOT A TEASER, AND MUST NOT BECOME ONE ────────────────────────────
 *
 * No blurred figures, no "harga median: RM••,•••", no locked rows. A masked
 * number still tells the buyer a number exists and invites them to guess at it,
 * and every such device says the numbers are the product. They are not — the
 * decision is, and a human signs it. This says what Paqar can do and stops.
 *
 * ── WHY IT ECHOES THE CAR BACK ─────────────────────────────────────────────
 *
 * Silently analysing the wrong model is the failure this experiment most needs
 * to avoid, and naming the match is the cheapest guard against it: the buyer
 * corrects us for free, before paying, rather than after reading a report about
 * someone else's car.
 */

type CoverageResponse =
  | { state: 'pending' }
  | { state: 'needs_asking_price'; modelLabel: string }
  | { state: 'covered';            modelLabel: string }
  | { state: 'insufficient_data';  modelLabel: string }
  | { state: 'unavailable' }

const POLL_MS   = 2_500
const MAX_POLLS = 12

export function CoverageSignal({
  checkId, claimToken, initialAskingPrice, onPresented,
}: {
  checkId:             string
  claimToken:          string
  initialAskingPrice?: number
  onPresented?:        (result: PresentedFreeResult) => void
}) {
  const [data, setData] = useState<CoverageResponse | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [input, setInput]   = useState('')
  const polls = useRef(0)
  const fired = useRef<Set<string>>(new Set())

  // NaN, not just undefined. The intake form sets asking_price to
  // String(value ?? ''), so an empty string reaches the page and parseInt makes
  // it NaN — which is not null, would have passed `asking_price=NaN` to the
  // route, and would have left the buyer polling a request that could never
  // succeed. Normalising here is what makes the recovery form below reachable.
  const supplied = initialAskingPrice != null && Number.isFinite(initialAskingPrice)
    && initialAskingPrice > 0 ? initialAskingPrice : null
  const [entered, setEntered] = useState<number | null>(null)
  const asking = entered ?? supplied

  useEffect(() => {
    if (asking == null) return
    let stop = false
    // The retry timer MUST be cancellable, and `stop` checked BEFORE the
    // request as well as after. An untracked timer kept firing real fetches
    // from an abandoned page — twelve of them over thirty seconds — and in the
    // suite a leaked poll landed inside the next test's fetch mock.
    let timer: ReturnType<typeof setTimeout> | null = null

    async function load() {
      if (stop) return
      polls.current += 1
      try {
        const res = await fetch(
          `/api/checks/${checkId}/coverage?claim_token=${encodeURIComponent(claimToken)}&asking_price=${asking}`,
        )
        const json = await res.json() as CoverageResponse
        if (stop) return
        setData(json)
        // Only 'needs_asking_price' is transient here, and only while a price
        // is genuinely still missing. Everything else is terminal on arrival —
        // coverage reads a cache, so there is nothing to wait for.
        if (json.state === 'needs_asking_price') {
          if (polls.current < MAX_POLLS) timer = setTimeout(load, POLL_MS)
          else setExhausted(true)
        }
      } catch {
        if (stop) return
        if (polls.current < MAX_POLLS) timer = setTimeout(load, POLL_MS)
        else setData({ state: 'unavailable' })
      }
    }

    load()
    return () => { stop = true; if (timer) clearTimeout(timer) }
  }, [checkId, claimToken, asking])

  // Report terminal states upward, once each. The gate above decides what may
  // mount; this component only says what it showed.
  useEffect(() => {
    if (!onPresented) return
    // Polling gave up. Saying so is the honest terminal state — it claims
    // nothing about the car, and it lets the gate render its unavailable
    // notice instead of leaving a paid offer under an empty space.
    if (exhausted && !fired.current.has('unavailable')) {
      fired.current.add('unavailable')
      onPresented({ state: 'unavailable' })
      return
    }
    if (!data) return
    const terminal =
      data.state === 'covered'           ? 'covered'
      : data.state === 'insufficient_data' ? 'insufficient_data'
      : data.state === 'unavailable'       ? 'unavailable'
      : null
    if (!terminal || fired.current.has(terminal)) return
    fired.current.add(terminal)
    onPresented({ state: terminal })
  }, [data, exhausted, onPresented])

  // ── Ask for the price when it was not supplied ─────────────────────────
  //
  // Returning null here would be the expensive mistake: the gate withholds the
  // paywall until a terminal state arrives, so a buyer who reached this page
  // without a price would see an empty space and NO WAY TO PAY. The recovery
  // is the field itself — they never restart the check.
  if (asking == null) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[15px] text-[#111827] mb-1">
          Berapa harga yang penjual minta?
        </p>
        <p className="font-body text-[13px] text-[#6B7280] mb-3 leading-relaxed">
          Masukkan harga dan kami semak sama ada Paqar boleh buat laporan untuk
          kereta ini.
        </p>
        <form
          onSubmit={e => { e.preventDefault(); const n = parseInt(input, 10); if (n > 0) setEntered(n) }}
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

  if (!exhausted && (!data || data.state === 'needs_asking_price' || data.state === 'pending')) {
    return (
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] p-5 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-[#D1D5DB] border-t-[#064E4A] animate-spin flex-shrink-0" />
        <p className="font-body text-[13px] text-[#374151]">Sedang semak iklan setanding…</p>
      </div>
    )
  }

  // Exhausted with nothing, or a state carrying no label. The gate renders
  // the unavailable notice above the withheld offer; this adds nothing.
  if (!data || data.state !== 'covered') return null

  return (
    <div className="bg-white border border-[#BBF7D0] rounded-[14px] p-5">
      <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5 mb-3">
        <span className="w-2 h-2 bg-[#16A34A] rounded-full" />
        <span className="font-heading font-bold text-[12px] text-[#15803D]">
          Paqar boleh semak kereta ini
        </span>
      </div>
      <p className="font-heading font-bold text-[15px] text-[#111827] mb-1.5">
        {data.modelLabel}
      </p>
      <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
        Kami jumpa cukup iklan setanding untuk kereta ini, jadi kami boleh
        bandingkan harga yang penjual minta dan beritahu anda apa patut buat.
      </p>
      {/* The correction invitation. Cheaper to hear "salah model" now than
          to refund a report about the wrong car later. */}
      <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed mt-2.5">
        Bukan kereta ini? Betulkan butiran sebelum bayar.
      </p>
    </div>
  )
}
