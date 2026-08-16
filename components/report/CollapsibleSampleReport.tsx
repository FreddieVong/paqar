'use client'
import { useState } from 'react'
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
  return (
    <div>
      <button
        onClick={() => {
          // Only the opening is interesting; a collapse is not intent.
          if (!open) analytics.sampleReportClicked({ source })
          setOpen(v => !v)
        }}
        className="font-body text-[13px] text-[#6B7280] underline underline-offset-2 min-h-[44px] inline-flex items-center justify-center"
      >
        {open ? 'Sembunyikan contoh laporan ▲' : 'Lihat contoh laporan ▼'}
      </button>
      {open && (
        <div className="mt-2">
          <SampleReportPreview showVerdictCard={showVerdictCard} />
        </div>
      )}
    </div>
  )
}
