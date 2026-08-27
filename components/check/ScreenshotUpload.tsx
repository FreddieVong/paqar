'use client'

import { whatsappUrl } from '@/lib/site'
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

/**
 * The largest body this upload may send.
 *
 * lib/image-validation caps at 8MB, which the SERVER can honour — but the
 * platform's serverless request-body limit is 4.5MB and it is enforced before
 * any of our code runs. A screenshot in that gap was accepted by the client,
 * killed mid-flight, and surfaced as `fetch` rejecting: the generic "Muat naik
 * gagal. Cuba lagi." with no size mentioned and nothing the buyer could act on.
 *
 * Held below the platform ceiling so a rejection is OURS to explain. Almost
 * nothing reaches it — compress() puts a phone screenshot well under 1MB — but
 * compression falls back to the original file whenever the browser cannot
 * decode the image, and that is exactly when the file is largest.
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/**
 * A hung upload must fail, not spin.
 *
 * Without this the fetch has no deadline: a connection that stalls leaves the
 * button busy forever, which reads as a frozen page rather than as an error
 * with a way out. Generous, because a 4MB screenshot on Malaysian mobile data
 * is a slow upload, not a broken one.
 */
const UPLOAD_TIMEOUT_MS = 45_000

/**
 * Why the upload did not happen, in words that decide what the buyer does next.
 *
 * Everything used to land on "Muat naik terputus. Cuba lagi" — the outer catch,
 * fired for any throw at all. That message is advice ("try again") attached to
 * a diagnosis nobody made, and for the most likely cause it is the WRONG
 * advice: if an extension is blocking the request, trying again does the same
 * thing forever.
 */
function describeFailure(err: unknown): { reason: string; message: string } {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      reason:  'offline',
      message: 'Tiada sambungan internet. Cuba lagi bila ada talian.',
    }
  }
  const e = err as { name?: string; message?: string }
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
    return {
      reason:  'timeout',
      message: 'Muat naik mengambil masa terlalu lama. Kalau talian anda perlahan, cuba screenshot yang lebih kecil — atau hantar melalui WhatsApp.',
    }
  }
  // A same-origin POST that throws TypeError did not reach the network. In
  // practice that is an extension or a network filter blocking it — an ad
  // blocker, a privacy tool, a corporate proxy. The buyer cannot fix that by
  // retrying, so they are told what it actually is and given a route that
  // does not depend on the blocked request succeeding.
  if (e?.name === 'TypeError') {
    return {
      reason:  `blocked:${(e.message ?? '').slice(0, 60)}`,
      message: 'Sesuatu pada pelayar anda menghalang muat naik — selalunya extension penyekat iklan atau privasi. Cuba matikan extension untuk laman ini, guna tetingkap Peribadi, atau hantar screenshot melalui WhatsApp.',
    }
  }
  return {
    reason:  `unknown:${(e?.name ?? 'Error')}:${(e?.message ?? '').slice(0, 60)}`,
    message: 'Muat naik terputus. Cuba lagi, atau hantar screenshot melalui WhatsApp.',
  }
}

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
    let uploaded = 0
    let latest   = count
    // Held outside the loop so the catch below can describe WHICH file failed
    // and how far it got, without the loop variable being out of scope.
    let attempt: { id: string; size: number; mime: string; startedAt: number } | null = null
    try {
      for (const file of files.slice(0, room)) {
        const payload = await compress(file)

        // CHECKED AFTER COMPRESSION, and named. compress() returns the ORIGINAL
        // whenever the browser cannot decode the image, so this is the case
        // that used to sail past the client and die at the platform.
        if (payload.size > MAX_UPLOAD_BYTES) {
          setError(
            `Gambar ini terlalu besar (${(payload.size / 1024 / 1024).toFixed(1)}MB). ` +
            `Maksimum 4MB — cuba screenshot semula, atau hantar melalui WhatsApp.`,
          )
          break
        }

        const body = new FormData()
        body.append('intakeId', owner.id)
        body.append('file', payload, 'screenshot')

        // One id per FILE, minted before the request and carried on it, so a
        // client-side report and a server-side success can be matched up. A
        // failure with no matching server line means the request never
        // arrived, which is the single most useful thing to know here.
        const attemptId = crypto.randomUUID()
        attempt = { id: attemptId, size: payload.size, mime: payload.type || file.type, startedAt: Date.now() }

        const res = await fetch('/api/listing-screenshots', {
          method:  'POST',
          // The credential goes in a header. A query string would reach access
          // logs, browser history and Referer headers.
          headers: {
            'x-paqar-intake-token':   owner.token,
            'x-paqar-upload-attempt': attemptId,
          },
          body,
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        })
        const json = await res.json().catch(() => ({})) as { error?: string; count?: number }
        if (!res.ok) {
          // The server's own words when it has any; otherwise name the status,
          // because "tidak dapat dibaca" blamed the buyer's picture for a 429
          // or a 500 that had nothing to do with it.
          setError(json.error ?? (res.status >= 500
            ? 'Sistem kami ada masalah sekejap. Cuba lagi, atau hantar melalui WhatsApp.'
            : 'Gambar ini tidak dapat dibaca. Cuba PNG atau JPG.'))
          break
        }
        if (typeof json.count === 'number') { setCount(json.count); latest = json.count }
        uploaded++
      }

      // ONE notification for the whole selection, not one per file.
      //
      // onUploaded triggers OCR. Calling it inside the loop meant a buyer who
      // selected three screenshots paid for three metered Anthropic calls
      // where one is needed, and three overlapping extractions raced to write
      // the same summary. Batching is also the point of the feature: the price
      // may be on one screen and the mileage on another, and a model that sees
      // them together can reconcile them.
      if (uploaded > 0) onUploaded(latest)
    } catch (err) {
      // Reached when the request never completes: blocked before it left the
      // browser, no signal, a dropped 4G connection, or a body the platform
      // closed on. Those need DIFFERENT advice, so they are told apart.
      const { reason, message } = describeFailure(err)
      const ref = attempt?.id.slice(0, 8)
      setError(ref ? `${message} (Ruj: ${ref})` : message)

      // Best-effort, never awaited, and it must not be able to throw its own
      // error into this catch. keepalive so it survives the buyer closing the
      // tab in frustration, which is exactly when we most want the record.
      if (attempt) {
        const owner2 = (intakeId && token) ? { id: intakeId, token } : null
        void fetch('/api/listing-screenshots/diagnostic', {
          method:    'POST',
          keepalive: true,
          headers:   {
            'content-type':         'application/json',
            'x-paqar-intake-token': owner2?.token ?? token ?? '',
            'x-paqar-intake-id':    owner2?.id ?? intakeId ?? '',
          },
          body: JSON.stringify({
            attemptId: attempt.id,
            stage:     'request',
            reason,
            sizeBytes: attempt.size,
            mime:      attempt.mime,
            elapsedMs: Date.now() - attempt.startedAt,
            online:    typeof navigator !== 'undefined' ? navigator.onLine : undefined,
          }),
        }).catch(() => {})
      }
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
  // Built once, not per render, and only if a support number is configured.
  const uploadHelpHref = whatsappUrl(
    'Hai Paqar, saya tak dapat muat naik screenshot iklan. Boleh saya hantar di sini?',
  )

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
          over ? 'border-[#3D472F] bg-[#F0FDF4]' : 'border-[#D1D5DB] bg-[#F9FAFB]'
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || full || disabled}
          className="w-full min-h-[44px] font-heading font-bold text-[14px] text-[#3D472F] disabled:opacity-50"
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

      {/* AN ERROR WITH NO WAY OUT IS STILL A DEAD END.
          Every failure here used to end at a red sentence. Screenshots are the
          only entrance for a buyer whose listing is on Facebook, so a buyer
          who cannot upload has no route into the product at all — and RM29 was
          never the obstacle, the upload was.

          WhatsApp is a real fallback rather than a gesture: a person receives
          the screenshot and can create the check by hand. It appears only on
          failure, so the happy path stays one action. */}
      {error && (
        <div className="mt-1.5">
          <p role="alert" className="font-body text-[12px] text-[#DC2626] leading-relaxed">{error}</p>
          {uploadHelpHref && (
            <a
              href={uploadHelpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block min-h-[44px] font-body text-[12px] font-semibold text-[#3D472F] underline underline-offset-2 mt-1"
            >
              Hantar screenshot melalui WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Required disclosure, stated plainly and where it applies. */}
      <p className="font-body text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
        Screenshot diproses untuk baca maklumat iklan. Disimpan secara peribadi
        dan dipadam selepas 30 hari.
      </p>
    </div>
  )
}
