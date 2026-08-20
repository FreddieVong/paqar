'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Screenshot intake. One control, three ways in.
 *
 * ── WHY CLIENT-SIDE COMPRESSION ────────────────────────────────────────────
 *
 * A modern phone screenshot is 2-5MB, and five of them exceed the platform's
 * request limit. Compressing in the browser is not just a size fix — it puts
 * the work on the device that already holds the bytes, and it means a buyer on
 * a slow connection uploads 300KB instead of 4MB.
 *
 * The quality floor is deliberately high (0.82, long edge 1600px). Text is the
 * ENTIRE point of these images: compress too hard and OCR reads a price wrong,
 * which is worse than a slower upload. Anything already small is sent
 * untouched rather than re-encoded for no gain.
 *
 * Re-encoding through canvas also strips EXIF — including GPS coordinates,
 * which phone screenshots rarely carry but photographs of a screen do.
 *
 * ── PASTE ──────────────────────────────────────────────────────────────────
 *
 * Desktop buyers screenshot with a keyboard shortcut and paste; asking them to
 * save a file first is friction invented by the form. The listener is on the
 * window rather than the drop zone because a paste has no target until
 * something is focused, and requiring a click first defeats the point.
 */

const MAX_FILES = 5
const LONG_EDGE = 1600
const QUALITY   = 0.82
/** Below this, re-encoding costs quality and saves nothing. */
const SKIP_COMPRESSION_BELOW = 400 * 1024

async function compress(file: File): Promise<Blob> {
  if (file.size <= SKIP_COMPRESSION_BELOW) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale  = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', QUALITY))
    // Never return something LARGER than the original.
    return blob && blob.size < file.size ? blob : file
  } catch {
    // A codec the browser cannot decode (HEIC on some desktops) falls through
    // to the server, which rejects it with a message the buyer can act on.
    return file
  }
}

export interface ScreenshotUploadProps {
  intakeId:   string | null
  /** Ownership credential. Header only — never a URL, never logged. */
  token:      string | null
  /**
   * Creates the intake on first use and returns its id.
   *
   * Lazy on purpose: minting a row on mount would create one for every visitor
   * who merely scrolls past the form, and the cleanup sweep would then be
   * deleting mostly-empty rows nobody ever intended to create.
   */
  ensureIntake: () => Promise<{ id: string; token: string } | null>
  /** Called after each successful upload with the new server-side count. */
  onUploaded: (count: number) => void
  disabled?:  boolean
}

export function ScreenshotUpload({ intakeId, token, ensureIntake, onUploaded, disabled }: ScreenshotUploadProps) {
  const [busy,   setBusy]   = useState(false)
  const [count,  setCount]  = useState(0)
  const [error,  setError]  = useState<string | null>(null)
  const [over,   setOver]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const send = useCallback(async (files: File[]) => {
    if (disabled) return
    // Returns the credential alongside the id: React state from the parent has
    // not re-rendered yet at this point, so reading the prop would send an
    // empty token on the very first upload.
    const owner = (intakeId && token)
      ? { id: intakeId, token }
      : await ensureIntake()
    if (!owner) { setError('Tak dapat mula. Cuba muat semula halaman.'); return }
    const room = MAX_FILES - count
    if (room <= 0) { setError(`Maksimum ${MAX_FILES} screenshot.`); return }

    setBusy(true); setError(null)
    try {
      for (const file of files.slice(0, room)) {
        const body = new FormData()
        body.append('intakeId', owner.id)
        body.append('file', await compress(file), 'screenshot')

        const res = await fetch('/api/listing-screenshots', {
          method:  'POST',
          // The credential goes in a header. A query string would reach access
          // logs, browser history and Referer headers.
          headers: { 'x-paqar-intake-token': owner.token },
          body,
        })
        const json = await res.json().catch(() => ({})) as { error?: string; count?: number }
        if (!res.ok) { setError(json.error ?? 'Gambar ini tidak dapat dibaca.'); break }
        if (typeof json.count === 'number') { setCount(json.count); onUploaded(json.count) }
      }
    } catch {
      setError('Muat naik gagal. Cuba lagi.')
    } finally {
      setBusy(false)
    }
  }, [intakeId, token, ensureIntake, count, disabled, onUploaded])

  // Window-level, because a paste has no target until something is focused and
  // requiring a click first defeats the purpose.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const imgs = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
      if (imgs.length) { e.preventDefault(); void send(imgs) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [send])

  const full = count >= MAX_FILES

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault(); setOver(false)
          void send(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')))
        }}
        className={`rounded-[12px] border-[1.5px] border-dashed p-4 text-center transition-colors ${
          over ? 'border-[#064E4A] bg-[#F0FDF4]' : 'border-[#D1D5DB] bg-[#F9FAFB]'
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || full || disabled}
          className="w-full min-h-[44px] font-heading font-bold text-[14px] text-[#064E4A] disabled:opacity-50"
        >
          {busy ? 'Memuat naik…' : full ? `${count} screenshot dimuat naik` : 'Pilih atau seret screenshot ke sini'}
        </button>
        <p className="font-body text-[11px] text-[#9CA3AF] mt-1 leading-relaxed">
          Boleh tampal terus (Ctrl+V) · PNG, JPG atau WebP · maksimum {MAX_FILES}
        </p>
        {count > 0 && !full && (
          <p className="font-body text-[12px] text-[#15803D] mt-1.5">{count} dimuat naik</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        aria-label="Muat naik screenshot iklan"
        onChange={e => { void send(Array.from(e.target.files ?? [])); e.target.value = '' }}
      />

      {error && <p className="font-body text-[12px] text-[#DC2626] mt-1.5">{error}</p>}

      {/* Required disclosure, stated plainly and where it applies. */}
      <p className="font-body text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
        Screenshot diproses untuk baca maklumat iklan. Disimpan secara peribadi
        dan dipadam selepas 30 hari.
      </p>
    </div>
  )
}
