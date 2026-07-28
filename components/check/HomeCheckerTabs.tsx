'use client'

import { useEffect, useState } from 'react'
import { OverpricedCheckerForm } from './OverpricedCheckerForm'
import { PlateCheckerForm }      from './PlateCheckerForm'
import { analytics }             from '@/lib/analytics'

type Tab = 'model' | 'plate'
type FormState = 'idle' | 'loading' | 'result' | 'error'

export function HomeCheckerTabs({ countDisplay }: { countDisplay: string | null }) {
  const [tab, setTab] = useState<Tab>('model')

  // ?tab=plat preselects the plate form — used by the "Semak nombor plat"
  // recovery action on a not-found report. Read after mount from
  // window.location rather than useSearchParams(): this renders on the
  // statically prerendered homepage, and the hook would force a client-side
  // bailout for the whole page. Starting on 'model' and switching keeps
  // server and first client render identical.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'plat') {
      setTab('plate')
    }
  }, [])
  const [modelFormState, setModelFormState] = useState<FormState>('idle')

  // Hide the how-it-works strip once the user is past those steps
  const showSteps = !(tab === 'model' && (modelFormState === 'result' || modelFormState === 'loading'))

  return (
    <div>
      {/* Segmented tab selector */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          onClick={() => { setTab('model'); analytics.tabSelected({ tab: 'model' }) }}
          className={`text-left rounded-[14px] px-4 py-3.5 transition-all duration-150 ${
            tab === 'model'
              ? 'bg-[#064E4A] shadow-sm'
              : 'bg-white border border-[#E5E7EB] hover:border-[#064E4A]/30'
          }`}
        >
          <p className={`font-heading font-extrabold text-[13px] leading-snug mb-0.5 ${
            tab === 'model' ? 'text-white' : 'text-[#111827]'
          }`}>
            Saya tahu model kereta
          </p>
          <p className={`font-body text-[11px] ${
            tab === 'model' ? 'text-white/70' : 'text-[#9CA3AF]'
          }`}>
            Semak harga — percuma
          </p>
        </button>

        <button
          type="button"
          onClick={() => { setTab('plate'); analytics.tabSelected({ tab: 'plate' }) }}
          className={`text-left rounded-[14px] px-4 py-3.5 transition-all duration-150 ${
            tab === 'plate'
              ? 'bg-[#064E4A] shadow-sm'
              : 'bg-white border border-[#E5E7EB] hover:border-[#064E4A]/30'
          }`}
        >
          <p className={`font-heading font-extrabold text-[13px] leading-snug mb-0.5 ${
            tab === 'plate' ? 'text-white' : 'text-[#111827]'
          }`}>
            Saya ada nombor plat
          </p>
          <p className={`font-body text-[11px] ${
            tab === 'plate' ? 'text-white/70' : 'text-[#9CA3AF]'
          }`}>
            Cari kereta — percuma · Laporan penuh RM12
          </p>
        </button>
      </div>

      {/* Active form */}
      {tab === 'model' ? <OverpricedCheckerForm onStateChange={setModelFormState} /> : <PlateCheckerForm />}

      {/* Soft social proof — below the form, not competing */}
      {countDisplay && (
        <p className="font-body text-[11px] text-[#9CA3AF] text-center mt-4">
          {countDisplay} semakan dibuat
        </p>
      )}

      {/* How it works — hidden once a check is running/showing a verdict,
          because steps 1-2 are already done at that point */}
      {showSteps && (
        <div className="mt-6 flex flex-col gap-2">
          {[
            'Masukkan kereta & harga seller',
            'Dapat keputusan harga serta-merta',
            'Nak skrip rundingan & data penuh? RM12',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] font-heading font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <p className="font-body text-[12px] text-[#6B7280]">{step}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
