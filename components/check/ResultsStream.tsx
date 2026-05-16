'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { Progress }     from '@/components/ui/progress'
import { Button }       from '@/components/ui/button'
import { SamanGuide }    from './SamanGuide'
import { ReportCTA }     from './ReportCTA'
import { InspectionCTA } from '@/components/report/InspectionCTA'
import { createClient }  from '@/lib/supabase/client'

import type { Check, CheckResult } from '@/types/domain'
import type { PollCheckResponse } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
const POLL_TIMEOUT_MS  = 90_000
const TOTAL_SOURCES    = 4

interface Props {
  checkId:      string
  claimToken:   string
  plate?:       string
  askingPrice?: string
}

export function ResultsStream({ checkId, claimToken, plate, askingPrice }: Props) {
  const router = useRouter()
  const [check,        setCheck]        = useState<Check | null>(null)
  const [results,      setResults]      = useState<CheckResult[]>([])
  const [error,        setError]        = useState<string | null>(null)
  const [authedUser,   setAuthedUser]   = useState<string | null | undefined>(undefined)
  const [captureEmail, setCaptureEmail] = useState('')
  const [captureState, setCaptureState] = useState<'idle' | 'sending' | 'done'>('idle')
  const captureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setAuthedUser(data.user?.id ?? null)
    })
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/checks/${checkId}?claim_token=${encodeURIComponent(claimToken)}`
      )
      if (!res.ok) { setError('Tidak dapat memuatkan keputusan'); return }
      const data = await res.json() as PollCheckResponse
      setCheck(data.check)
      setResults(data.results)
    } catch {
      setError('Ralat rangkaian — cuba semula…')
    }
  }, [checkId, claimToken])

  useEffect(() => {
    if (check?.status === 'complete') return
    void poll()
    const interval = setInterval(() => {
      if (check?.status === 'complete') { clearInterval(interval); return }
      void poll()
    }, POLL_INTERVAL_MS)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      setError('Semakan mengambil masa terlalu lama — sila muat semula halaman')
    }, POLL_TIMEOUT_MS)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [poll, check?.status])

  // Auto-claim removed: it was invalidating claim_token before the user
  // could complete the purchase flow, causing 404s on laporan-pembeli.
  // Dashboard access works via buyer_reports (email + check_id join).

  const completedCount = Math.min(
    results.filter(r => r.status !== 'pending').length,
    TOTAL_SOURCES
  )
  const isComplete  = check?.status === 'complete'
  const showDocsCta = isComplete && authedUser != null

  // results kept for completedCount but not rendered as cards
  void results

  async function handleEmailCapture(e: React.FormEvent) {
    e.preventDefault()
    if (!captureEmail.includes('@')) return
    setCaptureState('sending')
    try {
      await fetch('/api/capture-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ checkId, claimToken, email: captureEmail }),
      })
    } catch { /* non-fatal */ }
    setCaptureState('done')
  }

  if (error) return <p className="font-body text-[14px] text-[#DC2626] py-4">{error}</p>

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-heading font-bold text-[#064E4A]">
            {isComplete ? 'Semakan selesai' : 'Menyemak kereta anda…'}
          </span>
          <span className="font-body text-[#6B7280]">{completedCount} daripada {TOTAL_SOURCES}</span>
        </div>
        <Progress
          value={(completedCount / TOTAL_SOURCES) * 100}
          className="h-1 bg-[#E5E7EB] [&>div]:bg-[#064E4A]"
        />
      </div>

      {/* After check: compact saman message + personalised report CTA */}
      {isComplete && (
        <>
          <SamanGuide />
          <ReportCTA checkId={checkId} claimToken={claimToken} plate={plate} askingPrice={askingPrice} />
          <InspectionCTA plate={plate} />
        </>
      )}

      {/* Email capture for non-authed users */}
      {isComplete && authedUser === null && (
        <div className="border border-[#E5E7EB] rounded-xl p-4 bg-white">
          {captureState === 'done' ? (
            <>
              <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">Terima kasih!</p>
              <p className="font-body text-[12px] text-[#6B7280]">
                Kami akan hantarkan link laporan ini ke e-mel anda jika anda belum buka laporan dalam 24 jam.
              </p>
            </>
          ) : (
            <>
              <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">
                Simpan laporan ini
              </p>
              <p className="font-body text-[12px] text-[#6B7280] mb-3">
                Masukkan e-mel untuk kami hantarkan link laporan ini — boleh buka semula bila-bila masa.
              </p>
              <form onSubmit={handleEmailCapture} className="flex gap-2">
                <input
                  ref={captureRef}
                  type="email"
                  value={captureEmail}
                  onChange={e => setCaptureEmail(e.target.value)}
                  placeholder="anda@email.com"
                  required
                  className="flex-1 bg-white border border-[#D1D5DB] rounded-lg px-3 py-2
                             font-body text-[13px] text-[#111827] placeholder:text-[#D1D5DB]
                             focus:outline-none focus:border-[#064E4A]"
                />
                <button
                  type="submit"
                  disabled={captureState === 'sending'}
                  className="bg-[#064E4A] text-white font-heading font-bold text-[13px]
                             px-4 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap"
                >
                  {captureState === 'sending' ? '…' : 'Simpan'}
                </button>
              </form>
            </>
          )}
        </div>
      )}


      {showDocsCta && (
        <div className="border-[1.5px] border-[#064E4A]/30 rounded-xl p-4 bg-[#064E4A]/5">
          <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">
            Pantau dokumen kenderaan anda
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-3">
            Tambah tarikh tamat cukai jalan, insurans &amp; lesen.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px]"
          >
            Pantau Dokumen →
          </Button>
        </div>
      )}
    </div>
  )
}
