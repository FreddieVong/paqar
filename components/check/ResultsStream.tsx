'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import { Progress }     from '@/components/ui/progress'
import { Button }       from '@/components/ui/button'
import { ResultCard }   from './ResultCard'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'
import type { Check, CheckResult } from '@/types/domain'
import type { PollCheckResponse, CheckMode } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
const TOTAL_SOURCES    = 7

interface Props {
  checkId:    string
  claimToken: string
  mode?:      CheckMode
}

export function ResultsStream({ checkId, claimToken, mode = 'owner' }: Props) {
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
    if (check?.status === 'complete') return  // Already done — don't fire another poll
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
      void claimCheck(check.claim_token, authedUser)
    }
  }, [check, authedUser, poll])

  const completedCount = results.filter((r) => r.status !== 'pending').length
  const isComplete     = check?.status === 'complete'
  const isBuyer        = mode === 'buyer'
  const showSaveCta    = isComplete && !isBuyer && check?.user_id == null && authedUser === null
  const showDocsCta    = isComplete && !isBuyer && authedUser != null
  const showBuyerCta   = isComplete && isBuyer

  if (error) return <p className="font-body text-[14px] text-[#DC2626] py-4">{error}</p>

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span className="font-heading font-bold text-[#064E4A]">
            {isComplete ? 'Semakan selesai' : 'Menyemak 7 sumber…'}
          </span>
          <span className="font-body text-[#6B7280]">{completedCount} daripada {TOTAL_SOURCES}</span>
        </div>
        <Progress
          value={(completedCount / TOTAL_SOURCES) * 100}
          className="h-1 bg-[#E5E7EB] [&>div]:bg-[#064E4A]"
        />
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <ResultCard key={result.source} result={result} buyerMode={isBuyer} />
        ))}
      </div>

      {showSaveCta && (
        <div className="border-[1.5px] border-dashed border-[#064E4A]/30 rounded-xl p-4 bg-[#064E4A]/5">
          <p className="font-heading font-bold text-[14px] text-[#064E4A] mb-1">
            Dapatkan notifikasi jika ada perubahan
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-3">
            Simpan kenderaan ini dan kami akan maklumkan jika ada saman atau blacklist baru.
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
          <p className="font-heading font-bold text-[14px] text-[#064E4A] mb-1">
            Pantau dokumen kenderaan anda
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-3">
            Tambah tarikh tamat cukai jalan, insurans &amp; lesen. Kami akan ingatkan anda sebelum tamat tempoh.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px]"
          >
            Tambah Dokumen →
          </Button>
        </div>
      )}

      {showBuyerCta && (
        <div className="bg-[#064E4A] rounded-[16px] p-5">
          <p className="font-heading font-extrabold text-[16px] text-white mb-2">
            Jangan bagi deposit dulu.
          </p>
          <p className="font-body text-[12px] text-white/70 mb-4 leading-relaxed">
            Semakan asas selesai. Laporan penuh mendedahkan lebih banyak — sebelum anda rugi RM40K.
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {[
              'Sejarah saman lengkap semua sumber',
              'Semak hutang pinjaman (panduan JPJ)',
              'Analisis harga pasaran terperinci',
              'Senarai soalan untuk penjual',
              'Cadangan rundingan harga',
            ].map((item) => (
              <span key={item} className="font-body text-[12px] text-white/80 flex gap-2">
                <span className="text-[#FACC15] flex-shrink-0">✓</span>{item}
              </span>
            ))}
          </div>
          <button
            disabled
            className="w-full bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-xl py-4 opacity-90 cursor-not-allowed"
            title="Akan datang — daftar minat"
          >
            Dapatkan Laporan Penuh — RM19 →
          </button>
          <p className="font-body text-[11px] text-white/40 text-center mt-2">
            Akan datang · Daftar minat di bawah
          </p>
        </div>
      )}
    </div>
  )
}
