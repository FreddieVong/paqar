'use client'

import { useState } from 'react'

/**
 * Screenshots beside the extracted values, for the reviewer.
 *
 * ── LOADED ON DEMAND ───────────────────────────────────────────────────────
 *
 * Signed URLs are minted when the reviewer asks, not when the queue renders.
 * Rendering fifty queue cards would otherwise mint fifty credentials, most of
 * which nobody looks at, all of which then sit in the page's memory and in any
 * error report the browser sends.
 *
 * ── REFERRER LEAKAGE ───────────────────────────────────────────────────────
 *
 * referrerPolicy="no-referrer" on the image and rel="noreferrer" on the link.
 * Without them the signed URL — a bearer credential — travels in the Referer
 * header to whatever the storage host logs or redirects to.
 */
export function ReviewerScreenshots({ checkId }: { checkId: string }) {
  const [shots, setShots] = useState<{ id: string; url: string | null; width: number; height: number }[] | null>(null)
  const [busy, setBusy]   = useState(false)

  async function load() {
    setBusy(true)
    try {
      const res = await fetch(`/admin/review/screenshots?checkId=${encodeURIComponent(checkId)}`)
      if (res.ok) {
        const j = await res.json() as { screenshots: NonNullable<typeof shots> }
        setShots(j.screenshots ?? [])
      }
    } finally { setBusy(false) }
  }

  if (shots === null) {
    return (
      <button
        type="button"
        onClick={() => void load()}
        disabled={busy}
        className="font-heading font-bold text-[12px] text-[#064E4A] underline underline-offset-2 min-h-[44px]"
      >
        {busy ? 'Memuatkan…' : 'Lihat screenshot pembeli →'}
      </button>
    )
  }

  if (shots.length === 0) {
    return <p className="font-body text-[12px] text-[#9CA3AF]">Tiada screenshot.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {shots.map(s => s.url && (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          // noreferrer, not merely noopener: the URL is a credential and must
          // not travel in a Referer header.
          rel="noreferrer"
          className="block border border-[#E5E7EB] rounded-[8px] overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.url}
            alt="Screenshot iklan daripada pembeli"
            referrerPolicy="no-referrer"
            loading="lazy"
            className="w-full h-auto"
          />
        </a>
      ))}
      <p className="col-span-2 font-body text-[11px] text-[#9CA3AF]">
        Pautan tamat dalam 2 minit. Muat semula untuk lihat lagi.
      </p>
    </div>
  )
}
