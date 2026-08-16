'use client'

import { useEffect, useState } from 'react'
import { OverpricedCheckerForm } from './OverpricedCheckerForm'
import { PlateCheckerForm }      from './PlateCheckerForm'
import { analytics }             from '@/lib/analytics'

type Tab = 'model' | 'plate'
type FormState = 'idle' | 'loading' | 'result' | 'error'

/**
 * ONE journey, not two tabs.
 *
 * The tab selector defaulted to 'model', and the measured consequence was
 * stark: the model journey took 65.3% of all journeys, answered "not enough
 * data" 54.3% of the time, and produced ZERO purchases — every paid row Paqar
 * has ever taken carries a check_id, which only the plate paths create.
 *
 * So the plate form is now the page's single input, and the model checker is a
 * link rather than an equal choice. It is kept, not deleted: it is the honest
 * fallback for a buyer who genuinely has no plate yet, and the only thing
 * Paqar can offer them.
 */
export function HomeCheckerTabs({ countDisplay }: { countDisplay: string | null }) {
  const [tab, setTab] = useState<Tab>('plate')

  // ?tab=model opens the fallback directly. ?tab=plat is still honoured so the
  // "Semak nombor plat" recovery action on a not-found report keeps working,
  // and so any existing link or bookmark does not break — it simply asks for
  // what is already the default. Read after mount from window.location rather
  // than useSearchParams(): this renders on the statically prerendered
  // homepage, and the hook would force a client-side bailout for the whole page.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'model') {
      setTab('model')
    }
  }, [])
  const [modelFormState, setModelFormState] = useState<FormState>('idle')

  // Hide the how-it-works strip once the user is past those steps
  const showSteps = !(tab === 'model' && (modelFormState === 'result' || modelFormState === 'loading'))

  return (
    <div>
      {/* The single journey. No tab bar — the plate form IS the page. */}
      {tab === 'plate' ? <PlateCheckerForm /> : <OverpricedCheckerForm onStateChange={setModelFormState} />}

      {/* The fallback, as one quiet link rather than an equal choice. */}
      {tab === 'plate' ? (
        <button
          type="button"
          onClick={() => { setTab('model'); analytics.tabSelected({ tab: 'model' }) }}
          className="w-full min-h-[44px] py-3 inline-flex items-center justify-center font-body text-[12px] text-[#6B7280] underline underline-offset-2 mt-2 hover:text-[#064E4A] transition-colors"
        >
          Tak ada nombor plat? Semak ikut model dan tahun →
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setTab('plate'); analytics.tabSelected({ tab: 'plate' }) }}
          className="w-full min-h-[44px] py-3 inline-flex items-center justify-center font-body text-[12px] text-[#6B7280] underline underline-offset-2 mt-2 hover:text-[#064E4A] transition-colors"
        >
          ← Dah ada nombor plat? Semak kereta itu sendiri
        </button>
      )}

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
            // Step 1 names the plate, because the plate is now the journey.
            // Kept accurate for the fallback too: the model form asks for the
            // same asking price.
            tab === 'plate'
              ? 'Masukkan nombor plat & harga yang penjual minta'
              : 'Masukkan model, tahun & harga yang penjual minta',
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
