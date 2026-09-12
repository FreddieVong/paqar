'use client'
import { useEffect, useState } from 'react'
import type { ResolvedReport } from '@/lib/server/remembered-reports'

/**
 * "Laporan PPD1234 dah siap — Buka →", for the phone that paid.
 *
 * The buyer who could not find their e-mail came back to the homepage three
 * times. This is the line that would have handed it to them. Renders nothing
 * until the route answers and only when there is something to show, so the
 * homepage's one job — the check form — is untouched for everyone else.
 *
 * Shows the most recent paid report first; an unpaid free result is shown
 * only when there is no paid one, as the way back to what they were looking
 * at. One line, one tap.
 */
export function RememberedReportBanner() {
  const [report, setReport] = useState<ResolvedReport | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/laporan-saya', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((body: { reports?: ResolvedReport[] } | null) => {
        if (cancelled || !body?.reports?.length) return
        const paid = body.reports.find(r => r.state !== 'free_result')
        setReport(paid ?? body.reports[0]!)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!report) return null

  const copy =
    report.state === 'released'      ? { text: `Laporan ${report.label} dah siap.`,           cta: 'Buka laporan →',   cls: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]' }
    : report.state === 'under_review' ? { text: `Laporan ${report.label} sedang disemak.`,     cta: 'Lihat status →',   cls: 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]' }
    : report.state === 'undeliverable' ? { text: `Laporan ${report.label} tidak dapat disiapkan.`, cta: 'Lihat butiran →', cls: 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]' }
    : { text: `Semakan ${report.label} anda masih ada.`, cta: 'Sambung →', cls: 'bg-[#F3F4F6] border-[#E5E7EB] text-[#374151]' }

  return (
    <a href={report.url}
       className={`block border-b px-5 py-3 ${copy.cls}`}>
      <span className="font-body text-[14px]">{copy.text}</span>{' '}
      <span className="font-heading font-bold text-[14px]">{copy.cta}</span>
    </a>
  )
}
