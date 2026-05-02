'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import { Progress }     from '@/components/ui/progress'
import { Button }       from '@/components/ui/button'
import { ResultCard }   from './ResultCard'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'
import type { Check, CheckResult } from '@/types/domain'
import type { PollCheckResponse } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
const TOTAL_SOURCES    = 7

interface Props {
  checkId:    string
  claimToken: string
}

export function ResultsStream({ checkId, claimToken }: Props) {
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
      if (!res.ok) { setError('Could not load results'); return }
      const data = await res.json() as PollCheckResponse
      setCheck(data.check)
      setResults(data.results)
    } catch {
      setError('Network error — retrying…')
    }
  }, [checkId, claimToken])

  useEffect(() => {
    void poll()
    const interval = setInterval(() => {
      if (check?.status === 'complete') { clearInterval(interval); return }
      void poll()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [poll, check?.status])

  // Auto-claim: authenticated user lands on unclaimed check
  useEffect(() => {
    if (
      check?.status === 'complete' &&
      authedUser != null &&
      check.user_id == null &&
      check.claim_token != null
    ) {
      void claimCheck(check.claim_token, authedUser).then(() => void poll())
    }
  }, [check, authedUser, poll])

  const completedCount = results.filter((r) => r.status !== 'pending').length
  const isComplete     = check?.status === 'complete'
  const showSaveCta    = isComplete && check?.user_id == null && authedUser === null

  if (error) return <p className="text-sm text-red-600 py-4">{error}</p>

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span className="font-semibold text-teal-700">
            {isComplete ? 'Check complete' : 'Checking 7 sources'}
          </span>
          <span>{completedCount} of {TOTAL_SOURCES}</span>
        </div>
        <Progress
          value={(completedCount / TOTAL_SOURCES) * 100}
          className="h-1 bg-slate-100 [&>div]:bg-teal-700"
        />
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <ResultCard key={result.source} result={result} />
        ))}
      </div>

      {showSaveCta && (
        <div className="border-[1.5px] border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
          <p className="text-sm font-semibold text-teal-800 mb-1">
            Get notified if anything changes
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Save this vehicle to your account and we'll alert you if new saman or blacklist entries appear.
          </p>
          <Button
            onClick={() => {
              const next = `/check/${checkId}?claim_token=${claimToken}`
              router.push(`/auth?claim_token=${claimToken}&next=${encodeURIComponent(next)}`)
            }}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm"
          >
            Save &amp; create account
          </Button>
        </div>
      )}
    </div>
  )
}
