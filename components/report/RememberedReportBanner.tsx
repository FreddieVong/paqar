'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ResolvedReport } from '@/lib/server/remembered-reports'
import { analytics } from '@/lib/analytics'

/**
 * "Laporan PPD1234 dah siap — Buka →", for the phone that paid.
 *
 * The buyer who could not find their e-mail came back to the homepage three
 * times. This is the line that would have handed it to them. Renders nothing
 * until the route answers and only when there is something to show, so the
 * homepage's one job — the check form — is untouched for everyone else.
 *
 * Paid reports only — released, under review, or undeliverable. A free
 * result stays on "Laporan Saya"; it does not earn a bar on every page.
 * One line, one tap.
 */
const CACHE_KEY = 'paqar_laporan_banner'
const CACHE_MS  = 10 * 60 * 1000

function readCache(): ResolvedReport[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { at, reports } = JSON.parse(raw) as { at: number; reports: ResolvedReport[] }
    return Date.now() - at < CACHE_MS ? reports : null
  } catch { return null }
}
function writeCache(reports: ResolvedReport[]): void {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), reports })) } catch { /* private mode */ }
}

export function RememberedReportBanner() {
  const [report, setReport] = useState<ResolvedReport | null>(null)
  const pathname = usePathname()
  // The report page is where the banner would point; "Laporan Saya" already
  // lists everything. Neither needs the line.
  const suppressed = pathname?.startsWith('/laporan-pembeli') || pathname === '/laporan-saya'

  useEffect(() => {
    if (suppressed) return
    let cancelled = false
    const show = (reports: ResolvedReport[]) => {
      if (cancelled) return
      // Buyers only. A free result is still listed on "Laporan Saya", but a
      // bar on every page for sixty days is noise for someone who checked
      // one car and moved on.
      const chosen = reports.find(r => r.state !== 'free_result')
      if (!chosen) return
      setReport(chosen)
      analytics.rememberedReportShown({ surface: 'nav', state: chosen.state })
    }
    // The Nav is on every page and every visitor has a session cookie, so
    // without this the route — and its database lookup — would run on every
    // page view. One answer per tab, for ten minutes, is plenty: a report is
    // released once.
    const cached = readCache()
    if (cached) { show(cached); return }
    fetch('/api/laporan-saya', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((body: { reports?: ResolvedReport[] } | null) => {
        const reports = body?.reports ?? []
        writeCache(reports)
        show(reports)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [suppressed])

  if (!report || suppressed) return null

  const copy =
    report.state === 'released'      ? { text: `Laporan ${report.label} dah siap.`,           cta: 'Buka laporan →',   cls: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]' }
    : report.state === 'under_review' ? { text: `Laporan ${report.label} sedang disemak.`,     cta: 'Lihat status →',   cls: 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]' }
    : report.state === 'undeliverable' ? { text: `Laporan ${report.label} tidak dapat disiapkan.`, cta: 'Lihat butiran →', cls: 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]' }
    : null
  if (!copy) return null

  return (
    <a href={report.url}
       onClick={() => analytics.rememberedReportOpened({ surface: 'nav', state: report.state })}
       className={`block border-b px-5 py-3 ${copy.cls}`}>
      <span className="font-body text-[14px]">{copy.text}</span>{' '}
      <span className="font-heading font-bold text-[14px]">{copy.cta}</span>
    </a>
  )
}
