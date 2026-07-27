'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { extractJomCheckClaims, submitReviewedJomCheckResult } from './_actions'

// Editable mirror of RawClaimRow (mileage as a text field for the input)
interface EditRow {
  dateOfLoss:   string
  claimType:    string
  accidentType: string
  mileage:      string
  severityRaw:  string
}

const EMPTY_ROW: EditRow = { dateOfLoss: '', claimType: '', accidentType: '', mileage: '', severityRaw: '' }

const INPUT = 'w-full border border-[#D1D5DB] rounded-lg px-2 py-2 text-[16px]'

export function JomCheckExtractForm({ reportId }: { reportId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows]       = useState<EditRow[] | null>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError]     = useState<string | null>(null)
  const [extracting, startExtract] = useTransition()
  const [submitting, startSubmit]  = useTransition()

  function extract() {
    setError(null)
    const files = fileRef.current?.files
    if (!files || files.length === 0) { setError('Pilih gambar laporan JomCheck dahulu.'); return }
    // Keep the uploaded images on screen next to the read-back rows so the
    // owner verifies every mileage/severity against the source (Opus vision is
    // accurate, but a paid report must never email an unchecked machine read).
    setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return Array.from(files).map(f => URL.createObjectURL(f)) })
    const fd = new FormData()
    fd.set('reportId', reportId)
    for (const f of Array.from(files)) fd.append('images', f)
    startExtract(async () => {
      const res = await extractJomCheckClaims(fd)
      if (!res.ok) { setError(res.error ?? 'Gagal membaca gambar.'); return }
      setRows((res.rows ?? []).map(r => ({
        dateOfLoss:   r.dateOfLoss ?? '',
        claimType:    r.claimType,
        accidentType: r.accidentType,
        mileage:      r.mileage != null ? String(r.mileage) : '',
        severityRaw:  r.severityRaw ?? '',
      })))
    })
  }

  function update(i: number, key: keyof EditRow, value: string) {
    setRows(rs => rs!.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
  }

  function submit() {
    const cleaned = (rows ?? [])
      .filter(r => r.claimType.trim() || r.accidentType.trim())
      .map(r => ({
        dateOfLoss:   r.dateOfLoss.trim() || null,
        claimType:    r.claimType.trim(),
        accidentType: r.accidentType.trim(),
        mileage:      r.mileage.trim() ? parseInt(r.mileage.replace(/[^\d]/g, ''), 10) : null,
        severityRaw:  r.severityRaw.trim() || null,
      }))
    const fd = new FormData()
    fd.set('reportId', reportId)
    fd.set('rows', JSON.stringify(cleaned))
    startSubmit(async () => {
      await submitReviewedJomCheckResult(fd)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" multiple
          className="text-[13px] flex-1 min-w-0" />
        <button type="button" onClick={extract} disabled={extracting}
          className="bg-[#064E4A] text-white font-heading font-bold text-[13px] rounded-lg px-3 py-2 whitespace-nowrap disabled:opacity-50">
          {extracting ? 'Membaca…' : 'Baca dari gambar'}
        </button>
      </div>

      {error && <p className="font-body text-[12px] text-[#991B1B]">{error}</p>}

      {rows != null && (
        <div className="space-y-3">
          {previews.length > 0 && (
            <div>
              <p className="font-body text-[11px] text-[#6B7280] mb-1">
                Gambar asal — banding setiap baris di bawah dengan gambar ini:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {previews.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Gambar laporan ${i + 1}`}
                      className="h-44 w-auto rounded-lg border border-[#E5E7EB] object-contain bg-[#F9FAFB]"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="font-body text-[12px] text-[#6B7280]">
            {rows.length === 0
              ? 'Tiada rekod dibaca. Tambah manual jika perlu, atau simpan sebagai "tiada claim".'
              : `${rows.length} baris dibaca — semak & betulkan sebelum hantar.`}
          </p>

          {rows.map((r, i) => (
            <div key={i} className="border border-[#E5E7EB] rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-[11px] text-[#6B7280]">Baris {i + 1}</span>
                <button type="button" onClick={() => setRows(rs => rs!.filter((_, j) => j !== i))}
                  className="font-body text-[12px] text-[#991B1B] underline">Buang</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="font-body text-[11px] text-[#6B7280]">Date of Loss</span>
                  <input className={INPUT} value={r.dateOfLoss} onChange={e => update(i, 'dateOfLoss', e.target.value)} placeholder="14 Apr 2024" /></label>
                <label className="block"><span className="font-body text-[11px] text-[#6B7280]">Mileage</span>
                  <input className={INPUT} inputMode="numeric" value={r.mileage} onChange={e => update(i, 'mileage', e.target.value)} placeholder="136086" /></label>
                <label className="block"><span className="font-body text-[11px] text-[#6B7280]">Type of Claim</span>
                  <input className={INPUT} value={r.claimType} onChange={e => update(i, 'claimType', e.target.value)} placeholder="Own Damage (OD)" /></label>
                <label className="block"><span className="font-body text-[11px] text-[#6B7280]">Type of Accident</span>
                  <input className={INPUT} value={r.accidentType} onChange={e => update(i, 'accidentType', e.target.value)} placeholder="Collision" /></label>
                <label className="block col-span-2"><span className="font-body text-[11px] text-[#6B7280]">Severity</span>
                  <input className={INPUT} value={r.severityRaw} onChange={e => update(i, 'severityRaw', e.target.value)} placeholder="SEVERE" /></label>
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setRows(rs => [...(rs ?? []), { ...EMPTY_ROW }])}
            className="font-body text-[13px] text-[#064E4A] underline">+ Tambah baris</button>

          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-[#064E4A] text-white font-heading font-bold text-[15px] rounded-[10px] py-3 disabled:opacity-50">
            {submitting ? 'Menghantar…' : 'Semak selesai — Simpan & Hantar E-mel'}
          </button>
        </div>
      )}
    </div>
  )
}
