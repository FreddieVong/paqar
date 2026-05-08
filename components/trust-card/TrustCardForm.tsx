'use client'

import { useState, useTransition } from 'react'
import { useSearchParams }         from 'next/navigation'
import { initiateTrustCard }       from '@/app/buat-trust-card/_actions'
import type { CreateCheckResponse } from '@/types/api'

// Sources that block eligibility if they have a hit or require user action
const CRITICAL_SOURCES = ['pdrm', 'jpj', 'aes']

const SOURCE_LABELS: Record<string, string> = {
  pdrm:          'PDRM Saman',
  jpj:           'JPJ Saman',
  aes:           'AES Saman',
  local_councils:'Majlis Tempatan',
}

const PORTAL_LINKS: Record<string, { label: string; url: string }> = {
  pdrm: { label: 'Semak di MyBayar PDRM →', url: 'https://mybayar.rmp.gov.my' },
  jpj:  { label: 'Semak di MyJPJ →',        url: 'https://myjpj.jpj.gov.my'   },
}

interface CheckResultSummary {
  source: string
  status: string
}

type EligibilityState = 'eligible' | 'has_hit' | 'needs_verification'

function getEligibility(results: CheckResultSummary[]): EligibilityState {
  const criticals = results.filter(r => CRITICAL_SOURCES.includes(r.source))
  if (criticals.some(r => r.status === 'hit'))                    return 'has_hit'
  if (criticals.some(r => r.status === 'requires_user_action'))   return 'needs_verification'
  return 'eligible'
}

type Step = 'check' | 'eligible' | 'ineligible' | 'needs_verification'

export function TrustCardForm() {
  const searchParams = useSearchParams()
  const [step,       setStep]       = useState<Step>('check')
  const [plate,      setPlate]      = useState(() => searchParams.get('plate')?.toUpperCase() ?? '')
  const [ic,         setIc]         = useState('')
  const [email,      setEmail]      = useState('')
  const [checkId,    setCheckId]    = useState('')
  const [token,      setToken]      = useState('')
  const [issues,     setIssues]     = useState<CheckResultSummary[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate, ic, idempotencyKey: crypto.randomUUID(), mode: 'owner' }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Ralat semakan — sila cuba semula')
        return
      }
      const { checkId: id, claimToken } = await res.json() as CreateCheckResponse
      setCheckId(id)
      setToken(claimToken)

      // Poll until complete, capture full results
      const poll = async (): Promise<CheckResultSummary[]> => {
        const r = await fetch(`/api/checks/${id}?claim_token=${claimToken}`)
        const d = await r.json() as { check: { status: string }; results: CheckResultSummary[] }
        if (d.check.status !== 'complete') {
          await new Promise(resolve => setTimeout(resolve, 1500))
          return poll()
        }
        return d.results
      }

      const results = await poll()
      const eligibility = getEligibility(results)

      if (eligibility === 'eligible') {
        setStep('eligible')
      } else if (eligibility === 'needs_verification') {
        const unverified = results.filter(r =>
          CRITICAL_SOURCES.includes(r.source) && r.status === 'requires_user_action'
        )
        setIssues(unverified)
        setStep('needs_verification')
      } else {
        const hitIssues = results.filter(r =>
          CRITICAL_SOURCES.includes(r.source) && r.status === 'hit'
        )
        setIssues(hitIssues)
        setStep('ineligible')
      }
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setLoading(false)
    }
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await initiateTrustCard({
        checkId,
        claimToken: token,
        sellerEmail: email,
        baseUrl: window.location.origin,
      })
      if (result.error) { setError(result.error); return }
      if (result.billUrl) window.location.href = result.billUrl
    })
  }

  // ── Step 1: Plate + IC check ──────────────────────────────────────────────

  if (step === 'check') {
    return (
      <form onSubmit={handleCheck} className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 space-y-4">
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Nombor Plat
          </label>
          <input
            type="text" value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            placeholder="contoh: WVP 1234" required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
              font-heading font-extrabold text-[20px] tracking-[.1em] text-center uppercase
              placeholder:text-[#D1D5DB] placeholder:font-normal placeholder:text-[15px]
              placeholder:tracking-normal placeholder:normal-case
              focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10 transition-all"
          />
        </div>
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            No. IC Pemilik
          </label>
          <input
            type="text" value={ic}
            onChange={e => setIc(e.target.value)}
            placeholder="880614-10-5421" inputMode="numeric" required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
              font-heading font-semibold text-[16px] text-[#111827]
              placeholder:text-[#D1D5DB] placeholder:font-normal
              focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10 transition-all"
          />
        </div>
        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4 disabled:opacity-60 transition-colors">
          {loading ? 'Menyemak kelayakan…' : 'Semak Kelayakan →'}
        </button>
        <p className="font-body text-[11px] text-[#9CA3AF] text-center">
          Semakan percuma · IC disulitkan · Tidak disimpan dalam teks biasa
        </p>
      </form>
    )
  }

  // ── Step 2a: Eligible — show payment form ─────────────────────────────────

  if (step === 'eligible') {
    return (
      <div className="space-y-4">
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-5">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#15803D] mb-2">
            Layak
          </p>
          <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">
            Kereta ini layak untuk Paqar Seller Trust Card.
          </p>
          <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
            Jana link verifikasi yang boleh dikongsi dengan pembeli sebelum mereka datang melihat kereta anda.
          </p>
        </div>

        <form onSubmit={handlePay} className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 space-y-4">
          <div>
            <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
              E-mel untuk resit
            </label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="anda@email.com" required
              className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
                font-heading font-semibold text-[15px] text-[#111827]
                placeholder:text-[#D1D5DB] placeholder:font-normal
                focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10 transition-all"
            />
          </div>
          {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
          <button type="submit" disabled={isPending}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4 disabled:opacity-60 transition-colors">
            {isPending ? 'Memproses…' : 'Jana Trust Card — RM29 →'}
          </button>
          <p className="font-body text-[11px] text-[#9CA3AF] text-center">
            FPX · Kad kredit · Sah 30 hari · Boleh kongsi
          </p>
        </form>
      </div>
    )
  }

  // ── Step 2b: Needs verification — guide to official portal ───────────────

  if (step === 'needs_verification') {
    return (
      <div className="space-y-4">
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[16px] p-5">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#1D4ED8] mb-2">
            Semakan Rasmi Diperlukan
          </p>
          <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">
            Trust Card belum boleh dijana.
          </p>
          <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
            Semakan rasmi PDRM atau JPJ diperlukan sebelum Trust Card boleh dijana. Sila semak di portal rasmi terlebih dahulu.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
            Portal Rasmi Untuk Semak
          </p>
          <div className="space-y-2">
            {issues.map(r => {
              const portal = PORTAL_LINKS[r.source]
              return (
                <div key={r.source} className="flex items-center justify-between px-3 py-2.5 bg-[#EFF6FF] rounded-lg">
                  <span className="font-heading font-bold text-[13px] text-[#111827]">
                    {SOURCE_LABELS[r.source] ?? r.source}
                  </span>
                  {portal && (
                    <a href={portal.url} target="_blank" rel="noopener noreferrer"
                      className="font-body text-[12px] text-[#1D4ED8] underline underline-offset-2">
                      {portal.label}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={() => { setStep('check'); setError(null); setPlate(''); setIc('') }}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors"
        >
          Semak Semula →
        </button>

        <p className="font-body text-[12px] text-[#9CA3AF] text-center">
          Selepas semak di portal rasmi, semak semula di sini untuk menjana Trust Card.
        </p>
      </div>
    )
  }

  // ── Step 2c: Ineligible — private issue page, no payment ──────────────────

  return (
    <div className="space-y-4">
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[16px] p-5">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#B91C1C] mb-2">
          Tidak Layak Buat Masa Ini
        </p>
        <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">
          Trust Card belum boleh dijana.
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
          Terdapat isu yang perlu diselesaikan sebelum berkongsi kereta ini dengan pembeli.
        </p>
      </div>

      {issues.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
            Isu Yang Ditemui
          </p>
          <div className="space-y-2">
            {issues.map(r => (
              <div key={r.source} className="flex items-center justify-between px-3 py-2.5 bg-[#FEF2F2] rounded-lg">
                <span className="font-heading font-bold text-[13px] text-[#111827]">
                  {SOURCE_LABELS[r.source] ?? r.source}
                </span>
                <span className="font-body text-[12px] text-[#B91C1C]">Ada Saman</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => { setStep('check'); setError(null); setPlate(''); setIc('') }}
        className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors"
      >
        Semak Semula Selepas Selesai →
      </button>

      <p className="font-body text-[12px] text-[#9CA3AF] text-center">
        Selesaikan saman dahulu, kemudian semak semula untuk menjana Trust Card.
      </p>
    </div>
  )
}
