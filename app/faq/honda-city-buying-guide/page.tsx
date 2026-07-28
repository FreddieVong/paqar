/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'

export const metadata: Metadata = {
  title: 'Honda City Buying Guide 2026 | Which Year, Which Variant | Paqar',
  description: 'Complete Honda City buyer guide: best year to buy, which variant (1.5 S vs 1.5 H), real market prices, depreciation, what to check before buying.',
  alternates: { canonical: 'https://paqar.my/faq/honda-city-buying-guide' },
}

export default function HondaCityGuide() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Which Honda City year is the best to buy?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '2016–2020 Honda City 1.5 S/H is the sweet spot: good reliability, modern features, hold resale value well. Avoid pre-2014 models (older tech, depreciate fast). Avoid 2021+ (premium pricing, not enough market data yet).',
        },
      },
      {
        '@type': 'Question',
        name: 'Should I buy Honda City 1.5 S or 1.5 H?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'S (base): cheaper, fuel-efficient, sufficient for daily driving. H (mid-range): better features (touchscreen, sensors), worth RM1–2k premium if budget allows. Price difference: RM2–3k used.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div lang="en">
        <h1 className="text-4xl font-bold mb-6">Honda City Buying Guide: Best Year & Variant</h1>
        <p className="text-lg text-[#6B7280] mb-6">Complete guide to buying a used Honda City: which generation, which variant, real market prices, what to check.</p>

        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#064E4A] mb-2">Quick Answer</p>
          <p className="text-[#374151]">
            Buy a <strong>2016–2020 Honda City 1.5 S or H</strong> with <strong>80–100k km</strong> for <strong>RM25–30k</strong>.
            It's reliable, holds value, and has modern enough features. Avoid pre-2014 (old) and 2021+ (overpriced).
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Honda City Generations: Which to Buy?</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-semibold mb-2">Generation 1: 2008–2014 (Avoid)</h3>
              <p className="text-[#374151]"><strong>Price: RM12–18k</strong></p>
              <p className="text-[#374151] mt-2">Old interior, no power steering in base models, depreciated heavily. Only buy if budget is under RM15k and you don't mind older tech.</p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-semibold mb-2">Generation 2: 2014–2020 (BEST VALUE) ⭐</h3>
              <p className="text-[#374151]"><strong>Price: RM22–32k</strong></p>
              <ul className="text-[#374151] space-y-2 mt-2">
                <li>✅ Modern design, good fuel efficiency (7–8 L/100km)</li>
                <li>✅ Touchscreen + power steering standard</li>
                <li>✅ Holds resale value well</li>
                <li>✅ Good availability of spare parts</li>
                <li>⚠️ Some earlier units (2014–2015) have minor electrical issues</li>
              </ul>
              <p className="text-[#374151] mt-2"><strong>Target: 2016–2019 model with 80–100k km. RM25–28k.</strong></p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="text-lg font-semibold mb-2">Generation 3: 2020–Present (Avoid Now)</h3>
              <p className="text-[#374151]"><strong>Price: RM35–42k</strong></p>
              <p className="text-[#374151] mt-2">Newer, but overpriced. Wait 2–3 years for market prices to normalize. Too few listings yet to calculate fair value.</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Variant Comparison: S vs H</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Feature</th>
                <th className="border p-3 text-left">1.5 S (Base)</th>
                <th className="border p-3 text-left">1.5 H (Mid)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3 font-semibold">Price (2017 model)</td>
                <td className="border p-3">RM24–26k</td>
                <td className="border p-3">RM26–28k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Touchscreen</td>
                <td className="border p-3">4" Basic</td>
                <td className="border p-3">6.5" Android/Apple CarPlay</td>
              </tr>
              <tr>
                <td className="border p-3">Parking Sensors</td>
                <td className="border p-3">❌ No</td>
                <td className="border p-3">✅ Rear only</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Air Con</td>
                <td className="border p-3">Manual</td>
                <td className="border p-3">Automatic Climate</td>
              </tr>
              <tr>
                <td className="border p-3">Power Windows</td>
                <td className="border p-3">Front only</td>
                <td className="border p-3">All 4</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Fuel Economy</td>
                <td className="border p-3">7.5–8 L/100km</td>
                <td className="border p-3">7–7.5 L/100km</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-[#6B7280] mt-4">
            💡 <strong>Verdict:</strong> If budget allows, get the H (RM2–3k premium for better features). If you're under RM27k, the S is still solid.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Real Market Prices (July 2026)</h2>
          <p className="text-[#374151] mb-4">Based on Paqar valuations from actual Mudah.my sales:</p>
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
                <td className="border p-3">City 1.5 S</td>
                <td className="border p-3">2017</td>
                <td className="border p-3">90k km</td>
                <td className="border p-3">RM24–26k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">City 1.5 H</td>
                <td className="border p-3">2017</td>
                <td className="border p-3">90k km</td>
                <td className="border p-3">RM26–28k</td>
              </tr>
              <tr>
                <td className="border p-3">City 1.5 S</td>
                <td className="border p-3">2019</td>
                <td className="border p-3">60k km</td>
                <td className="border p-3">RM28–30k</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Pre-Purchase Checklist</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Get JomCheck inspection</p>
                <p className="text-sm text-[#6B7280]">RM99–150. Non-negotiable.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Check Paqar valuation on the plate</p>
                <p className="text-sm text-[#6B7280]">Know market price before negotiating.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Verify NVIC variant matches seller's claim</p>
                <p className="text-sm text-[#6B7280]">S vs H matters for price. Don't let seller lie.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Test drive on highway + city</p>
                <p className="text-sm text-[#6B7280]">Listen for transmission clunk (CVT issue common on older units).</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Negotiate RM2–4k below asking</p>
                <p className="text-sm text-[#6B7280]">Use Paqar valuation + JomCheck results as leverage.</p>
              </div>
            </div>
          </div>
        </section>

        <FaqGetValuationCta faqSlug="honda-city-buying-guide" />
      </div>
    </>
  )
}
