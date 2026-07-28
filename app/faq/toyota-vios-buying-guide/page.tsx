/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Toyota Vios Buying Guide 2026 | Best Year & Price | Paqar',
  description: 'Complete Vios buyer guide: which year to buy, price range, reliability, what to check. Real Paqar valuations.',
  alternates: { canonical: 'https://paqar.my/faq/toyota-vios-buying-guide' },
}

export default function ViosBuyingGuide() {
  // Every Q&A below must correspond to content visible on this page —
  // structured data that answers something the page does not is a policy
  // violation, not a shortcut.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Which Toyota Vios year should I buy used?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Gen 2 (2013–2018) is the best value — target a 2015–2017 Vios 1.5 with around 110,000 km for about RM24,000. Gen 1 (2007–2013) is worth avoiding unless your budget is under RM12,000. Gen 3 (2018–present) is currently overpriced.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much does a used Toyota Vios cost in Malaysia?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Typical market prices: a 2014 Vios 1.5 at 120,000 km runs RM20,000–23,000; a 2016 at 110,000 km runs RM24,000–26,000; and a 2018 at 80,000 km runs RM27,000–30,000.',
        },
      },
      {
        '@type': 'Question',
        name: 'Why does the Toyota Vios depreciate faster than other cars?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The interior feels plain compared to rivals, many Vios were used as taxis which affects perception, and buyers often prefer the cheaper Myvi or the more feature-rich Honda City. It remains a reliable car, but resale value moves slower.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are the red flags when buying a used Toyota Vios?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Transmission clunking points to a costly CVT or automatic gearbox repair. Engine ticking is common at high mileage and is usually not critical. An unusually cheap asking price often signals taxi history or a hidden problem.',
        },
      },
    ],
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
    </>
  )
}
