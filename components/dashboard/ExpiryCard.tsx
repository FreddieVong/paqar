'use client'

import { useState, useTransition } from 'react'
import { saveDocumentExpiry }       from '@/app/dashboard/_actions'
import type { DocType, DocumentExpiry } from '@/types/domain'

type ExpiryStatus = 'safe' | 'warning' | 'urgent' | 'expired' | 'missing'

const DOC_CONFIG: Record<DocType, { label: string; icon: string }> = {
  roadtax:         { label: 'Cukai Jalan',  icon: '🚗' },
  insurance:       { label: 'Insurans',      icon: '🛡️' },
  driving_licence: { label: 'Lesen Memandu', icon: '🪪' },
}

const CARD_STYLES: Record<ExpiryStatus, string> = {
  safe:    'bg-[#F0FDF4] border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] border-[#FDE68A]',
  urgent:  'bg-[#FEF2F2] border-[#FECACA]',
  expired: 'bg-[#FEF2F2] border-[#FECACA]',
  missing: 'bg-[#F9FAFB] border-[#E5E7EB]',
}

const ICON_BG: Record<ExpiryStatus, string> = {
  safe:    'bg-[#DCFCE7]',
  warning: 'bg-[#FEF9C3]',
  urgent:  'bg-[#FEE2E2]',
  expired: 'bg-[#FEE2E2]',
  missing: 'bg-[#F3F4F6]',
}

const DAYS_COLOR: Record<ExpiryStatus, string> = {
  safe:    'text-[#15803D]',
  warning: 'text-[#B45309]',
  urgent:  'text-[#B91C1C]',
  expired: 'text-[#B91C1C]',
  missing: 'text-[#9CA3AF]',
}

function getStatus(expiresOn: string | null): ExpiryStatus {
  if (!expiresOn) return 'missing'
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiresOn)
  const days   = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
  if (days < 0)   return 'expired'
  if (days === 0) return 'expired'
  if (days <= 29) return 'urgent'
  if (days <= 60) return 'warning'
  return 'safe'
}

function getDaysLabel(expiresOn: string | null): string {
  if (!expiresOn) return 'Belum ditambah'
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiresOn)
  const days   = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
  if (days < 0)   return `Tamat ${Math.abs(days)} hari lepas`
  if (days === 0) return 'Tamat hari ini!'
  if (days <= 29) return `${days} hari lagi — Segera!`
  if (days <= 60) return `${days} hari lagi ⚠`
  return `${days} hari lagi`
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface Props {
  docType: DocType
  expiry:  DocumentExpiry | null
  onSaved: () => void
}

export function ExpiryCard({ docType, expiry, onSaved }: Props) {
  const [expanded,    setExpanded]     = useState(false)
  const [dateValue,   setDateValue]    = useState(expiry?.expires_on ?? '')
  const [fieldError,  setFieldError]   = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()
  const cfg    = DOC_CONFIG[docType]
  const status = getStatus(expiry?.expires_on ?? null)

  function handleSave() {
    if (!dateValue) { setFieldError('Sila masukkan tarikh'); return }
    setFieldError(null)
    startTransition(async () => {
      const result = await saveDocumentExpiry({ docType, expiresOn: dateValue })
      if (result.error) { setFieldError(result.error); return }
      setExpanded(false)
      onSaved()
    })
  }

  return (
    <div className={`border-[1.5px] rounded-[14px] p-4 transition-all ${CARD_STYLES[status]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${ICON_BG[status]}`}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-[13px] text-[#111827]">{cfg.label}</p>
          {expiry
            ? <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                Tamat: {formatDisplayDate(expiry.expires_on)}
              </p>
            : <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">Tarikh belum ditambah</p>
          }
          <p className={`font-heading font-bold text-[12px] mt-0.5 ${DAYS_COLOR[status]}`}>
            {getDaysLabel(expiry?.expires_on ?? null)}
          </p>
        </div>
        {!expanded && (
          <button
            onClick={() => { setExpanded(true); setDateValue(expiry?.expires_on ?? '') }}
            className={`font-heading font-semibold text-[12px] border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white flex-shrink-0 ${
              expiry ? 'text-[#064E4A]' : 'text-[#6B7280] border-dashed'
            }`}
          >
            {expiry ? 'Edit' : '+ Tambah'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Tarikh Tamat
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#064E4A] rounded-xl px-4 py-3
                       font-heading font-semibold text-[15px] text-[#111827]
                       focus:outline-none focus:ring-[3px] focus:ring-[#064E4A]/10 mb-3"
          />
          {fieldError && (
            <p className="font-body text-[12px] text-[#DC2626] mb-3">{fieldError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px] rounded-xl py-3 disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Menyimpan…' : 'Simpan →'}
            </button>
            <button
              onClick={() => { setExpanded(false); setFieldError(null) }}
              className="font-heading font-semibold text-[13px] text-[#6B7280] px-4"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
