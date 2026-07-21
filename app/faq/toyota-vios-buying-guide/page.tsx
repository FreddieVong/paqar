/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Toyota Vios Buying Guide 2026 | Best Year & Price | Paqar',
  description: 'Complete Vios buyer guide: which year to buy, price range, reliability, what to check. Real Paqar valuations.',
}

export default function ViosBuyingGuide() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">Toyota Vios Buying Guide: Best Year & Price</h1>
      <p className="text-lg text-[#6B7280] mb-6">Complete guide: which Vios year to buy, pricing, reliability, depreciation.</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#064E4A] mb-2">Quick Answer</p>
        <p className="text-[#374151]">
          Buy a <strong>2014–2018 Toyota Vios 1.5</strong> with <strong>100–120k km</strong> for <strong>RM22–28k</strong>.
          Toyota reliability is unbeatable. It'll run 500k+ km if maintained. Depreciation is moderate.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Vios Generations</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Gen 1: 2007–2013 (Avoid)</h3>
            <p className="text-[#374151]">Old design, outdated tech. Only if budget &lt; RM12k.</p>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Gen 2: 2013–2018 (BEST VALUE) ⭐</h3>
            <p className="text-[#374151] mb-2"><strong>Price: RM20–28k | Target: 2015–2017, 110k km, RM24k</strong></p>
            <ul className="text-[#374151] space-y-2">
              <li>✅ Toyota reliability (500k+ km lifespan)</li>
              <li>✅ Modern interior, good AC</li>
              <li>✅ Fuel-efficient (7–8 L/100km)</li>
              <li>✅ Spare parts cheap & available</li>
              <li>⚠️ Depreciates faster than Myvi/City</li>
              <li>⚠️ Transmission can be noisy (normal)</li>
            </ul>
          </div>

          <div className="border-l-4 border-amber-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Gen 3: 2018–Present (Pricey Now)</h3>
            <p className="text-[#374151]">Newer design, but overpriced. Wait 2 years for prices to normalize.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Real Market Prices (July 2026)</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F3F4F6]">
              <th className="border p-3 text-left">Model</th>
              <th className="border p-3 text-left">Year</th>
              <th className="border p-3 text-left">Mileage</th>
              <th className="border p-3 text-left">Typical Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3">Vios 1.5</td>
              <td className="border p-3">2014</td>
              <td className="border p-3">120k km</td>
              <td className="border p-3">RM20–23k</td>
            </tr>
            <tr className="bg-[#F9FAFB]">
              <td className="border p-3">Vios 1.5</td>
              <td className="border p-3">2016</td>
              <td className="border p-3">110k km</td>
              <td className="border p-3">RM24–26k</td>
            </tr>
            <tr>
              <td className="border p-3">Vios 1.5</td>
              <td className="border p-3">2018</td>
              <td className="border p-3">80k km</td>
              <td className="border p-3">RM27–30k</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Why Vios Depreciates Fast</h2>
        <div className="text-[#374151] space-y-2">
          <p>✓ Toyota reliability = low ongoing costs, but...</p>
          <p>✗ Interior feels plain (no fancy touchscreen)</p>
          <p>✗ Many Vios used as taxis (mass-market perception)</p>
          <p>✗ Buyers prefer Myvi (cheaper) or City (more features)</p>
          <p>→ <strong>Result:</strong> Good car, but slower resale value.</p>
        </div>
      </section>

      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-[#991B1B] mb-2">⚠️ Vios Red Flags</h3>
        <ul className="text-[#374151] space-y-1">
          <li>❌ Transmission clunking (CVT/auto issue—costly repair)</li>
          <li>❌ Engine ticking noise (normal for high mileage, not critical)</li>
          <li>❌ Very cheap asking price (usually means taxi history or hidden problem)</li>
        </ul>
      </div>

        <FaqGetValuationCta faqSlug="toyota-vios-buying-guide" />
    </div>
  )
}
