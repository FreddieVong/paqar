'use client'

import { REVIEW_SLA_HOURS } from '@/lib/report-release'
import { useState, useTransition } from 'react'
import { initiateJomCheckUpgrade } from '@/app/laporan-pembeli/[checkId]/_actions'
import { analytics }               from '@/lib/analytics'

interface Props {
  checkId:    string
  claimToken: string
}

// +RM88 add-on upsell shown inside a paid RM29 report (only when the buyer
// hasn't already bought the accident/claim check and JomCheck is live).
export function JomCheckUpsell({ checkId, claimToken }: Props) {
  const [error,     setError]        = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpgrade() {
    setError(null)
    analytics.paymentInitiated()
    startTransition(async () => {
      const result = await initiateJomCheckUpgrade({
        checkId,
        claimToken,
        baseUrl: window.location.origin,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  return (
    <div className="bg-white border-l-[3px] border-l-[#064E4A] border border-[#E5E7EB] rounded-[14px] p-5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#064E4A]">
          Semakan Accident/Claim Insurans
        </p>
        <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0">+RM88</span>
      </div>
      {/* NOT "meter kereta ni pernah dipusing?". Paqar holds no independent
          dated odometer reading, so it cannot answer that question — leading
          with it sells a finding the report is not allowed to make. What the
          add-on actually delivers is the recorded claim history and a person
          saying what it means for this purchase. */}
      <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-tight mb-1.5">
        Kereta ni ada rekod claim insurans?
      </p>
      <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-2">
        Semak rekod claim insurans sebenar — termasuk <span className="font-semibold">meter
        (odometer) ketika claim</span>, tahap keseriousan setiap claim, dan rekod total loss —
        sebelum anda bayar deposit.
      </p>
      <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg px-3 py-2 mb-3">
        <p className="font-body text-[12px] text-[#991B1B] leading-relaxed">
          ⚠️ Kami bandingkan meter ketika claim dengan odometer semasa — kalau tak sepadan, sahkan dengan penjual dan rekod servis.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['Own Damage', 'Banjir', 'Windscreen', 'Total Loss'].map(tag => (
          <span key={tag} className="font-body text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">
            {tag}
          </span>
        ))}
      </div>
      {error && <p className="font-body text-[13px] text-[#DC2626] mb-2">{error}</p>}
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={isPending}
        className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[14px] rounded-[12px] py-3.5 disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Memproses…' : 'Tambah ke Laporan Ini — RM88 →'}
      </button>
      {/* THE WAIT, BEFORE THE MONEY. This said "keputusan terus dalam laporan
          ini selepas bayaran" — instant. It is not: the records go back to a
          person who reads them against the decision already written, and only
          their release reaches the buyer. Discovering that after paying is the
          same betrayal the RM29 checkout was fixed to avoid. */}
      <p className="font-body text-[11px] text-[#6B7280] text-center mt-2 leading-relaxed">
        Rekod disemak oleh manusia, kemudian keputusan anda dikemaskini dalam
        laporan ini &mdash; dalam {REVIEW_SLA_HOURS} jam.
      </p>
    </div>
  )
}
