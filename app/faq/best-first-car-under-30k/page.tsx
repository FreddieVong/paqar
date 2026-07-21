/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Best First Car Under RM30k in Malaysia | Paqar',
  description: 'Guide to choosing your first used car under RM30,000. Compare Perodua Myvi, Honda City, Toyota Vios with real Paqar valuations and buyer tips.',
  openGraph: {
    title: 'Best First Car Under RM30k in Malaysia',
    description: 'Honest guide to affordable first cars: which model holds value, which to avoid, real market prices.',
    type: 'article',
  },
}

export default function FirstCarUnder30k() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the best first car to buy in Malaysia under RM30k?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The Perodua Myvi (2015-2020) is widely considered the best first car under RM30k due to low maintenance costs, high resale value, and availability of spare parts. The Honda City (2014-2018) is also excellent if you prioritize comfort and reliability. The Toyota Vios (2013-2018) is a solid third option for those wanting a sedan.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much should I expect to pay for a 2018 Perodua Myvi?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A 2018 Perodua Myvi 1.5 H typically costs RM24,000–RM28,000 depending on mileage and condition. Use Paqar to get an instant valuation for any specific plate.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which first car depreciates the least?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Perodua Myvi and Honda City hold their value best in the sub-RM30k segment. Avoid Proton models (older generations depreciate sharply) and unknown Chinese brands.',
        },
      },
      {
        '@type': 'Question',
        name: 'Should I buy a hatchback or sedan as my first car?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'For a first car under RM30k, hatchbacks (Myvi) are cheaper, easier to park, and have lower fuel costs. Sedans (City, Vios) offer more space and comfort but cost slightly more. Choose based on your lifestyle.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I check if a used car under RM30k has been flooded or in an accident?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Get a JomCheck inspection (RM99–RM150) which reveals accident history, flood damage, and service records. Never skip this step—it can save you from buying a lemon.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-[#111827] mb-3">Best First Car Under RM30k in Malaysia</h1>
            <p className="text-lg text-[#6B7280] mb-4">
              Complete guide to choosing an affordable, reliable first car. Includes real Paqar valuations and what to avoid.
            </p>
            <div className="flex gap-4 text-sm text-[#6B7280]">
              <span>Updated July 2026</span>
              <span>•</span>
              <span>7 min read</span>
            </div>
          </div>

          {/* Quick Answer */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
            <p className="text-lg font-semibold text-[#064E4A] mb-2">Quick Answer</p>
            <p className="text-[#374151]">
              <strong>Perodua Myvi (2015–2020)</strong> is the best first car under RM30k. It's affordable (RM24–28k), reliable, holds value, and has cheap spare parts. If you prefer a sedan, buy a <strong>Honda City (2014–2018)</strong> instead.
            </p>
          </div>

          {/* Why These Cars */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Why These Cars?</h2>

            <div className="space-y-6">
              <div className="border-l-4 border-[#064E4A] pl-4">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">1. Perodua Myvi (Best Overall)</h3>
                <p className="text-[#374151] mb-3">
                  <strong>Price range:</strong> RM24,000–RM28,000 (2018 model, 80k km)
                </p>
                <ul className="text-[#374151] space-y-2 mb-3">
                  <li>✅ Cheapest to maintain (local parts, many mechanics)</li>
                  <li>✅ Holds resale value best in its class</li>
                  <li>✅ 5-star ASEAN NCAP safety rating</li>
                  <li>✅ Fuel-efficient (6.5–7.5 L/100km)</li>
                  <li>⚠️ Interior feels basic compared to City or Vios</li>
                </ul>
                <p className="text-sm text-[#6B7280]">
                  <strong>Verdict:</strong> Best for budget-conscious first-time buyers. Resale value stays strong.
                </p>
              </div>

              <div className="border-l-4 border-[#064E4A] pl-4">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">2. Honda City (Best Comfort)</h3>
                <p className="text-[#374151] mb-3">
                  <strong>Price range:</strong> RM25,000–RM32,000 (2016 model, 100k km)
                </p>
                <ul className="text-[#374151] space-y-2 mb-3">
                  <li>✅ More spacious & comfortable than Myvi</li>
                  <li>✅ Excellent reliability record</li>
                  <li>✅ Better resale value than Vios</li>
                  <li>✅ Good fuel economy (7–8 L/100km)</li>
                  <li>⚠️ Slightly pricier than Myvi</li>
                </ul>
                <p className="text-sm text-[#6B7280]">
                  <strong>Verdict:</strong> Best if you want sedan comfort but still under RM30k. Holds value well.
                </p>
              </div>

              <div className="border-l-4 border-[#064E4A] pl-4">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">3. Toyota Vios (Safe Choice)</h3>
                <p className="text-[#374151] mb-3">
                  <strong>Price range:</strong> RM22,000–RM30,000 (2013 model, 120k km)
                </p>
                <ul className="text-[#374151] space-y-2 mb-3">
                  <li>✅ Toyota reliability reputation</li>
                  <li>✅ Very durable (500k+ km lifespan)</li>
                  <li>✅ Parts widely available</li>
                  <li>⚠️ Loses value faster than Myvi or City</li>
                  <li>⚠️ Older generations feel dated inside</li>
                </ul>
                <p className="text-sm text-[#6B7280]">
                  <strong>Verdict:</strong> Safe but depreciates more. Only buy if you plan to keep it 5+ years.
                </p>
              </div>
            </div>
          </section>

          {/* What to Avoid */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">What to Avoid</h2>
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
              <ul className="space-y-3 text-[#374151]">
                <li><strong>❌ Proton Saga / Persona (pre-2015):</strong> Poor reliability, expensive repairs, resale value crashes</li>
                <li><strong>❌ Chinese brands (Chery, Geely):</strong> Limited parts availability, no resale market</li>
                <li><strong>❌ Nissan Almera / Datsun:</strong> Depreciates faster than Japanese brands</li>
                <li><strong>❌ High-mileage vehicles (&gt;150k km):</strong> Maintenance costs spike; risk of hidden problems</li>
                <li><strong>❌ Vehicles without JomCheck inspection:</strong> Could be flooded, stolen, or in an accident</li>
              </ul>
            </div>
          </section>

          {/* Price Expectations */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Real Market Prices (July 2026)</h2>
            <p className="text-[#374151] mb-4">
              These are <strong>Paqar valuations</strong> based on actual Mudah.my listings. Prices vary by mileage & condition.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F3F4F6]">
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Car Model</th>
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Year</th>
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Typical Price</th>
                    <th className="border border-[#E5E7EB] p-3 text-left font-semibold">Get Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#E5E7EB] p-3">Perodua Myvi 1.5 H</td>
                    <td className="border border-[#E5E7EB] p-3">2018</td>
                    <td className="border border-[#E5E7EB] p-3">RM24–28k</td>
                    <td className="border border-[#E5E7EB] p-3"><Link href="/" className="text-[#064E4A] underline">Check</Link></td>
                  </tr>
                  <tr className="bg-[#F9FAFB]">
                    <td className="border border-[#E5E7EB] p-3">Honda City 1.5 S</td>
                    <td className="border border-[#E5E7EB] p-3">2016</td>
                    <td className="border border-[#E5E7EB] p-3">RM25–30k</td>
                    <td className="border border-[#E5E7EB] p-3"><Link href="/" className="text-[#064E4A] underline">Check</Link></td>
                  </tr>
                  <tr>
                    <td className="border border-[#E5E7EB] p-3">Toyota Vios 1.5</td>
                    <td className="border border-[#E5E7EB] p-3">2013</td>
                    <td className="border border-[#E5E7EB] p-3">RM22–26k</td>
                    <td className="border border-[#E5E7EB] p-3"><Link href="/" className="text-[#064E4A] underline">Check</Link></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[#6B7280] mt-4">
              💡 <strong>Tip:</strong> Use Paqar to value any specific plate before making an offer. Have the seller's plate number? <Link href="/" className="text-[#064E4A] underline">Check it instantly</Link>.
            </p>
          </section>

          {/* Buying Checklist */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-4">Buying Checklist</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#064E4A] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Get a JomCheck inspection (RM99–150)</p>
                  <p className="text-sm text-[#6B7280]">Reveals accident history, flood damage, service records. Non-negotiable.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#064E4A] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Check Paqar valuation on the plate</p>
                  <p className="text-sm text-[#6B7280]">Know the market price before negotiating. Don't overpay.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#064E4A] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Verify variant matches NVIC record</p>
                  <p className="text-sm text-[#6B7280]">Seller says "1.5 H" but NVIC says "1.5 G"? Walk away.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#064E4A] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Test drive in multiple conditions</p>
                  <p className="text-sm text-[#6B7280]">City traffic, highway, over bumps. Listen for weird noises.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 bg-[#064E4A] text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <div>
                  <p className="font-semibold text-[#111827]">Negotiate RM2–5k below asking price</p>
                  <p className="text-sm text-[#6B7280]">Use Paqar valuation as your anchor. Professional buyers always negotiate.</p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#111827] mb-6">Frequently Asked Questions</h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Is it better to buy from a dealer or private seller?</h3>
                <p className="text-[#374151]">
                  <strong>Private seller:</strong> Cheaper, but more risk. No warranty, no guarantee.
                  <br/>
                  <strong>Dealer:</strong> More expensive (mark-up 10–15%), but you have recourse if something breaks.
                  <br/>
                  <strong>Recommendation:</strong> Private seller IF you get a thorough JomCheck inspection. Dealer if you want peace of mind.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">How much should I offer for a Perodua Myvi listed at RM28k?</h3>
                <p className="text-[#374151]">
                  Use Paqar to see the market median for that specific year/variant. If median is RM26k but seller asks RM28k, offer RM24–25k. Negotiation room: RM1–3k typical.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">What if the car I like has high mileage (150k+ km)?</h3>
                <p className="text-[#374151]">
                  <strong>Walk away.</strong> At 150k+ km, you're buying someone else's future repair bills. Brake pads, transmission fluid, suspension all wear out around this mileage. Save RM2k, get a lower-mileage car instead.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Can I get financing for a 5–10-year-old car?</h3>
                <p className="text-[#374151]">
                  Yes, most banks finance used cars up to 9–10 years old. Interest rates are 3–5% p.a. Check with your bank. You'll need 40% down payment minimum.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#111827] mb-2">What's the best time to buy a used car?</h3>
                <p className="text-[#374151]">
                  Month-end or year-end (sellers are motivated). Avoid festival seasons when everyone's buying. Prices on Mudah are most stable mid-month.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-8 text-center">
            <h3 className="text-xl font-bold text-[#064E4A] mb-3">Ready to Find Your First Car?</h3>
            <p className="text-[#374151] mb-6">Enter a plate number to see its instant valuation, market price range, and whether it's a good deal.</p>
            <Link href="/" className="inline-block bg-[#064E4A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#053935]">
              Check a Car Now
            </Link>
          </div>

          {/* Related */}
          <div className="mt-12 pt-8 border-t">
            <h3 className="text-lg font-semibold text-[#111827] mb-4">Related Guides</h3>
            <ul className="space-y-2 text-[#064E4A]">
              <li><Link href="/faq/how-to-spot-flood-cars" className="underline">How to Spot a Flooded Car (JomCheck Guide)</Link></li>
              <li><Link href="/faq/what-to-check-buying-used-car" className="underline">Complete Checklist: What to Check When Buying a Used Car</Link></li>
              <li><Link href="/faq/how-to-negotiate-used-car" className="underline">How to Negotiate a Used Car Price</Link></li>
              <li><Link href="/varian" className="underline">Variant Guides (Myvi, City, Vios)</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
