'use client'
import { useState } from 'react'
import { SampleReportPreview } from './SampleReportPreview'

export function CollapsibleSampleReport() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="font-body text-[13px] text-[#6B7280] underline underline-offset-2"
      >
        {open ? 'Sembunyikan contoh laporan ▲' : 'Lihat contoh laporan ▼'}
      </button>
      {open && (
        <div className="mt-2">
          <SampleReportPreview />
        </div>
      )}
    </div>
  )
}
