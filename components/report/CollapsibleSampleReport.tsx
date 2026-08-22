'use client'
import { useId, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { SampleReportPreview } from './SampleReportPreview'

/**
 * @param showVerdictCard - pass false where the verdict card is already on the
 *   page above this expander (the homepage proof beat). Defaults true so the
 *   paywall and /contoh-laporan are unaffected.
 * @param source - which surface opened it, so the homepage proof beat can be
 *   told apart from the paywall. Enum-valued; carries no plate, price or id.
 */
export function CollapsibleSampleReport({
  showVerdictCard = true,
  source = 'paywall',
}: {
  showVerdictCard?: boolean
  source?: 'paywall' | 'homepage_proof'
} = {}) {
  const [open, setOpen] = useState(false)
  // useId, not a constant: this renders on the homepage, /contoh-laporan and
  // the paywall, and a hard-coded id would collide the moment two appear on one
  // page — and would differ between server and client render.
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        // Announced even while collapsed, which is the point: a screen reader
        // user needs to know the control owns a region before opening it.
        aria-controls={panelId}
        onClick={() => {
          // Only the opening is interesting; a collapse is not intent.
          if (!open) analytics.sampleReportClicked({ source })
          setOpen(v => !v)
        }}
        className="font-body text-[13px] text-[#6B7280] underline underline-offset-2 min-h-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D472F]/40 rounded"
      >
        {open ? 'Sembunyikan contoh laporan ▲' : 'Lihat contoh laporan ▼'}
      </button>
      {/* text-left, unconditionally. The homepage centres this component's
          wrapper to centre the toggle, and text-align inherits — which silently
          centred every paragraph of the expanded report, including the claim
          records and the odometer warning. A report is a document; its
          alignment must not depend on where the expander happens to sit. */}
      {open && (
        <div id={panelId} className="mt-2 text-left">
          <SampleReportPreview showVerdictCard={showVerdictCard} />
        </div>
      )}
    </div>
  )
}
