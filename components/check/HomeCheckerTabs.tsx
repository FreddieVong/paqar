'use client'

import { useEffect, useState } from 'react'
import { OverpricedCheckerForm } from './OverpricedCheckerForm'
import { PlateCheckerForm }      from './PlateCheckerForm'
import { analytics }             from '@/lib/analytics'

type Tab = 'model' | 'plate'

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
  // No form state is tracked here any more: the only reader was the 1-2-3
  // how-it-works strip, removed because the hero support line and the proof
  // beat directly below it now say the same thing twice over.

  return (
    <div>
      {/* The single journey. No tab bar — the plate form IS the page. */}
      {tab === 'plate' ? <PlateCheckerForm /> : <OverpricedCheckerForm />}

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
    </div>
  )
}
