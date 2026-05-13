'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import { Progress }     from '@/components/ui/progress'
import { Button }       from '@/components/ui/button'
import { SamanGuide }  from './SamanGuide'
import { ReportCTA }   from './ReportCTA'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'
import type { Check, CheckResult } from '@/types/domain'
import type { PollCheckResponse } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
const POLL_TIMEOUT_MS  = 90_000
const TOTAL_SOURCES    = 4

interface Props {
  checkId:    string
  claimToken: string
  plate?:     string
}

export function ResultsStream({ checkId, claimToken, plate }: Props) {
  const router = useRouter()
  const [check,      setCheck]      = useState<Check | null>(null)
  const [results,    setResults]    = useState<CheckResult[]>([])
  const [error,      setError]      = useState<string | null>(null)
  const [authedUser, setAuthedUser] = useState<string | null | undefined>(undefined)

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

  useEffect(() => {
    if (
      check?.status === 'complete' &&
      authedUser != null &&
      check.user_id == null &&
      check.claim_token != null
    ) {
      void claimCheck(check.claim_token, authedUser)
    }
  }, [check, authedUser, poll])

  const completedCount = Math.min(
    results.filter(r => r.status !== 'pending').length,
    TOTAL_SOURCES
  )
  const isComplete  = check?.status === 'complete'
  const showSaveCta = isComplete && check?.user_id == null && authedUser === null
  const showDocsCta = isComplete && authedUser != null

  // results kept for completedCount but not rendered as cards
  void results

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
          <ReportCTA checkId={checkId} claimToken={claimToken} plate={plate} />
        </>
      )}

      {/* Secondary CTAs */}
      {showSaveCta && (
        <div className="border-[1.5px] border-dashed border-[#064E4A]/30 rounded-xl p-4 bg-[#064E4A]/5">
          <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">
            Simpan semakan ini
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-3">
            Buat akaun percuma untuk akses semula semakan ini pada bila-bila masa.
          </p>
          <Button
            onClick={() => {
              const next = `/check/${checkId}?claim_token=${claimToken}`
              router.push(`/auth?claim_token=${claimToken}&next=${encodeURIComponent(next)}`)
            }}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px]"
          >
            Simpan &amp; buat akaun
          </Button>
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
