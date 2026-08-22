'use client'

import { useState } from 'react'
import { analytics } from '@/lib/analytics'

/**
 * One tap, after the report. Never a gate.
 *
 * ── WHY IT CANNOT BLOCK ────────────────────────────────────────────────────
 *
 * This is placed BELOW the report a buyer has already paid for. No modal, no
 * overlay, no dismissal required — a buyer who ignores it entirely loses
 * nothing, and one who answers is doing Paqar a favour rather than paying a
 * toll. A survey that interrupts the thing someone paid for teaches them not
 * to open the next one.
 *
 * ── WHY THE COMMENT COMES SECOND ───────────────────────────────────────────
 *
 * Showing a text box up front converts a one-tap question into a writing task,
 * and response rates collapse. The tap is saved immediately and independently;
 * the comment is an optional follow-up on an answer already recorded. Someone
 * who taps and closes the tab has still told us the thing that matters.
 *
 * ── WHAT REACHES ANALYTICS ─────────────────────────────────────────────────
 *
 * The choice, and nothing else. Not the comment, not the plate, not the check
 * id — the comment is free text a buyer may put anything into, including their
 * own name or the seller's.
 */

const OPTIONS = [
  { value: 'teruskan_beli',  label: 'Ya — teruskan beli' },
  { value: 'runding_harga',  label: 'Ya — runding harga' },
  { value: 'tak_jadi_beli',  label: 'Ya — tak jadi beli' },
  { value: 'belum_pasti',    label: 'Belum pasti' },
  { value: 'tidak_membantu', label: 'Tidak membantu' },
] as const

export function DecisionImpact({ checkId, revision = 1 }: { checkId: string; revision?: number }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  async function save(impact: string, note?: string) {
    // Optimistic: the answer is recorded locally whatever the network does.
    // Losing one response matters far less than making someone wait.
    setChosen(impact)
    analytics.decisionImpact({ impact })
    await fetch('/api/decision-impact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checkId, revision, impact, comment: note ?? null }),
    }).catch(() => {})
  }

  return (
    <section
      aria-labelledby="di-q"
      className="bg-white border border-[#E5E7EB] rounded-[14px] p-5"
    >
      <p id="di-q" className="font-heading font-bold text-[14px] text-[#111827] mb-3">
        Adakah laporan Paqar mempengaruhi keputusan anda?
      </p>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(o => {
          const active = chosen === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => void save(o.value)}
              className={`min-h-[44px] px-3.5 py-2 rounded-[10px] border font-body text-[13px] transition-colors
                focus:outline-none focus:ring-[3px] focus:ring-[#3D472F]/20 ${
                active
                  ? 'bg-[#3D472F] border-[#3D472F] text-white font-semibold'
                  : 'bg-white border-[#D1D5DB] text-[#374151] hover:border-[#3D472F]'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {/* Only after an answer exists. The tap is already saved. */}
      {chosen && !sent && (
        <div className="mt-3">
          <label htmlFor="di-note" className="font-body text-[12px] text-[#6B7280]">
            Nak tambah apa-apa? (pilihan)
          </label>
          <textarea
            id="di-note"
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px] font-body mt-1"
          />
          <button
            type="button"
            onClick={() => { void save(chosen, comment.trim() || undefined); setSent(true) }}
            className="mt-2 min-h-[44px] px-4 rounded-[10px] bg-[#F0FDF4] border border-[#BBF7D0] font-heading font-bold text-[13px] text-[#15803D]"
          >
            Hantar
          </button>
        </div>
      )}

      {chosen && sent && (
        <p className="font-body text-[13px] text-[#15803D] mt-3">Terima kasih.</p>
      )}
      {chosen && !sent && (
        <p className="font-body text-[12px] text-[#9CA3AF] mt-2">Jawapan anda dah disimpan.</p>
      )}
    </section>
  )
}
