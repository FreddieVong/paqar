'use client'

import { useState } from 'react'
import { OverpricedCheckerForm } from './OverpricedCheckerForm'
import { PlateCheckerForm }      from './PlateCheckerForm'

type Tab = 'model' | 'plate'

export function HomeCheckerTabs({ countDisplay }: { countDisplay: string | null }) {
  const [tab, setTab] = useState<Tab>('model')

  return (
    <div>
      {/* Segmented tab selector */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab('model')}
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
          onClick={() => setTab('plate')}
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
            RM12 · laporan kenderaan + semak harga
          </p>
        </button>
      </div>

      {/* Active form */}
      {tab === 'model' ? <OverpricedCheckerForm /> : <PlateCheckerForm />}

      {/* Soft social proof — below the form, not competing */}
      {countDisplay && (
        <p className="font-body text-[11px] text-[#9CA3AF] text-center mt-4">
          {countDisplay} semakan dibuat
        </p>
      )}
    </div>
  )
}
