'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { analytics } from '@/lib/analytics'

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5'

const fmt = (n: number) => Math.round(n).toLocaleString()

// JPJ road tax schedule — private saloon, Peninsular Malaysia. Deterministic,
// not an estimate. (Sabah/Sarawak and non-saloon bodies differ.)
function roadTaxPeninsularSaloon(cc: number): number {
  if (cc <= 1000) return 20
  if (cc <= 1200) return 55
  if (cc <= 1400) return 70
  if (cc <= 1600) return 90
  if (cc <= 1800) return 200 + (cc - 1600) * 0.4
  if (cc <= 2000) return 280 + (cc - 1800) * 0.5
  if (cc <= 2500) return 380 + (cc - 2000) * 1.0
  if (cc <= 3000) return 880 + (cc - 2500) * 2.5
  return 2130 + (cc - 3000) * 4.5
}

export function LoanCalculator() {
  const searchParams = useSearchParams()
  const prefill      = searchParams.get('harga')

  const [price,      setPrice]      = useState(prefill && /^\d+$/.test(prefill) ? prefill : '')
  const [depositPct, setDepositPct] = useState(10)
  const [rate,       setRate]       = useState('3.5')
  const [years,      setYears]      = useState(9)
  const [cc,         setCc]         = useState('')
  const [leadEmail,  setLeadEmail]  = useState('')
  const [leadState,  setLeadState]  = useState<'idle' | 'sending' | 'done'>('idle')

  const priceNum = parseInt(price, 10) || 0
  const rateNum  = parseFloat(rate) || 0
  const deposit  = Math.round(priceNum * depositPct / 100)
  const loan     = priceNum - deposit

  // Malaysian car loans (hire purchase) use a FLAT rate: interest is charged
  // on the full principal for the whole tenure, not on the reducing balance.
  const totalInterest = loan * (rateNum / 100) * years
  const totalPayment  = loan + totalInterest
  const monthly       = years > 0 ? totalPayment / (years * 12) : 0
  const hasResult     = priceNum >= 1000 && loan > 0

  // Kos lain setahun
  const ccNum        = parseInt(cc, 10) || 0
  const roadTax      = ccNum >= 600 ? roadTaxPeninsularSaloon(ccNum) : null
  // Comprehensive premium ≈ 2.5–3.5% of car value/year before NCD discount
  const insLow       = priceNum ? priceNum * 0.025 : 0
  const insHigh      = priceNum ? priceNum * 0.035 : 0
  const insMid       = (insLow + insHigh) / 2
  const trueMonthly  = hasResult && roadTax != null
    ? monthly + roadTax / 12 + insMid / 12
    : null

  async function handleLeadCapture(e: React.FormEvent) {
    e.preventDefault()
    if (!leadEmail.includes('@') || leadState !== 'idle') return
    setLeadState('sending')
    try {
      await fetch('/api/capture-calculator-lead', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:         leadEmail.trim(),
          priceRm:       priceNum,
          depositRm:     deposit,
          monthlyRm:     Math.round(monthly),
          totalInterest: Math.round(totalInterest),
          years,
          ratePct:       rateNum,
          roadTaxRm:     roadTax != null ? Math.round(roadTax) : null,
          insLowRm:      priceNum ? Math.round(insLow) : null,
          insHighRm:     priceNum ? Math.round(insHigh) : null,
        }),
      })
    } catch { /* non-fatal — still show done */ }
    setLeadState('done')
  }

  return (
    <div className="space-y-4">

      {/* ── Inputs ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3.5">
        <div>
          <label htmlFor="lc-price" className={LABEL_CLS}>Harga Kereta (RM)</label>
          <input
            id="lc-price" type="number" value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={() => { if (priceNum >= 1000) analytics.calculatorUsed({ price: priceNum }) }}
            placeholder="cth: 45000" min={1000} max={2000000} className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Deposit</label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 10, 20, 30].map(pct => (
              <button
                key={pct} type="button" onClick={() => setDepositPct(pct)}
                className={`rounded-[10px] py-2.5 font-heading font-bold text-[13px] transition-colors ${
                  depositPct === pct
                    ? 'bg-[#064E4A] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#374151] hover:border-[#064E4A]/40'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          {priceNum > 0 && (
            <p className="font-body text-[11px] text-[#6B7280] mt-1.5">
              Deposit: RM{fmt(deposit)} · Jumlah loan: RM{fmt(loan)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lc-rate" className={LABEL_CLS}>Kadar Faedah (%)</label>
            <input
              id="lc-rate" type="number" value={rate} step="0.1"
              onChange={e => setRate(e.target.value)}
              placeholder="3.5" min={0} max={15} className={INPUT_CLS}
            />
          </div>
          <div>
            <label htmlFor="lc-years" className={LABEL_CLS}>Tempoh (tahun)</label>
            <select
              id="lc-years" value={years}
              onChange={e => setYears(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              {[3, 5, 7, 9].map(y => <option key={y} value={y}>{y} tahun</option>)}
            </select>
          </div>
        </div>
        <p className="font-body text-[11px] text-[#9CA3AF] leading-relaxed">
          Kiraan guna kadar faedah rata (flat) — cara biasa loan kereta di Malaysia.
          Kereta terpakai selalunya 3.3%–4.5%.
        </p>
      </div>

      {/* ── Result ── */}
      {hasResult && (
        <div className="bg-[#14453d] rounded-[16px] p-5">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-white/45 mb-1">
            Ansuran Bulanan
          </p>
          <p className="font-heading font-extrabold text-[36px] text-white leading-none mb-4">
            RM{fmt(monthly)}
          </p>
          <div className="space-y-1.5 pt-3 border-t border-white/10">
            <div className="flex justify-between">
              <p className="font-body text-[12px] text-white/55">Jumlah faedah ({rateNum}% × {years} tahun)</p>
              <p className="font-heading font-bold text-[13px] text-white/90">RM{fmt(totalInterest)}</p>
            </div>
            <div className="flex justify-between">
              <p className="font-body text-[12px] text-white/55">Jumlah bayaran balik</p>
              <p className="font-heading font-bold text-[13px] text-white/90">RM{fmt(totalPayment)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Kos lain setahun ── */}
      {hasResult && (
        <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 space-y-3">
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
            Kos Lain Setahun
          </p>
          <div>
            <label htmlFor="lc-cc" className={LABEL_CLS}>
              Enjin (cc) <span className="text-[#9CA3AF] font-normal normal-case tracking-normal">— pilihan</span>
            </label>
            <input
              id="lc-cc" type="number" value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="cth: 1500" min={600} max={6000} className={INPUT_CLS}
            />
          </div>

          {roadTax != null && (
            <div className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5">
              <div>
                <p className="font-body text-[13px] text-[#374151]">Cukai jalan (roadtax)</p>
                <p className="font-body text-[10px] text-[#9CA3AF]">Semenanjung · kereta persendirian · ikut jadual JPJ</p>
              </div>
              <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(roadTax)}/tahun</p>
            </div>
          )}

          <div className="bg-[#F9FAFB] rounded-lg px-3 py-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <p className="font-body text-[13px] text-[#374151]">Insurans komprehensif</p>
              <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(insLow)}–RM{fmt(insHigh)}/tahun</p>
            </div>
            <p className="font-body text-[10px] text-[#9CA3AF] leading-relaxed">
              Anggaran sebelum diskaun NCD — NCD boleh kurangkan sehingga 55%. Harga sebenar bergantung pada syarikat insurans.
            </p>
            <a
              href="https://bjak.my/?p=FREDDIE-0FC9AL" target="_blank" rel="noopener noreferrer"
              onClick={() => analytics.ctaClicked({ cta: 'bjak' })}
              className="font-heading font-bold text-[12px] text-[#064E4A] mt-1.5 inline-block"
            >
              Dapatkan quote sebenar — percuma →
            </a>
          </div>

          {trueMonthly != null && (
            <div className="flex items-center justify-between bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-3">
              <div>
                <p className="font-heading font-bold text-[13px] text-[#111827]">Kos sebenar sebulan</p>
                <p className="font-body text-[10px] text-[#6B7280]">Ansuran + insurans + roadtax</p>
              </div>
              <p className="font-heading font-extrabold text-[18px] text-[#064E4A]">≈ RM{fmt(trueMonthly)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Save calculation via email — turns calculator traffic into leads ── */}
      {hasResult && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4">
          {leadState === 'done' ? (
            <p className="font-body text-[13px] text-[#064E4A] font-semibold">
              ✓ Kiraan dihantar ke e-mel anda. Semak inbox (atau spam).
            </p>
          ) : (
            <>
              <p className="font-heading font-bold text-[13px] text-[#111827] mb-1">
                Simpan kiraan ini
              </p>
              <p className="font-body text-[12px] text-[#6B7280] mb-3">
                Kami hantar breakdown penuh ke e-mel anda — mudah rujuk semula bila jumpa kereta.
              </p>
              <form onSubmit={handleLeadCapture} className="flex gap-2">
                <input
                  type="email"
                  value={leadEmail}
                  onChange={e => setLeadEmail(e.target.value)}
                  placeholder="anda@email.com"
                  required
                  className="flex-1 bg-white border border-[#D1D5DB] rounded-lg px-3 py-2
                             font-body text-[16px] text-[#111827] placeholder:text-[#D1D5DB]
                             focus:outline-none focus:border-[#064E4A] min-w-0"
                />
                <button
                  type="submit"
                  disabled={leadState === 'sending'}
                  className="bg-[#064E4A] text-white font-heading font-bold text-[13px]
                             px-4 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap"
                >
                  {leadState === 'sending' ? '…' : 'Hantar'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ── Cross-sell into the free check ── */}
      {hasResult && (
        <Link
          href="/#semak"
          className="flex items-center justify-between bg-white border-l-[3px] border-l-[#064E4A] border border-[#E5E7EB] rounded-[14px] px-4 py-4 hover:bg-[#F0FDF4] transition-colors group"
        >
          <div>
            <p className="font-heading font-bold text-[13px] text-[#111827]">
              Harga RM{fmt(priceNum)} ni berpatutan ke?
            </p>
            <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
              Semak harga kereta ini — percuma, 10 saat.
            </p>
          </div>
          <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3 text-[18px]">→</span>
        </Link>
      )}

    </div>
  )
}
