import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How to Spot a Flooded Car | Paqar Guide',
  description: 'Complete guide: physical signs of a flooded car (rust, mold smell, electrical issues), how JomCheck reveals flood damage, what to check before buying.',
}

export default function HowToSpotFloodedCars() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How can I tell if a used car has been flooded?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Signs of flood damage: musty/moldy smell in cabin, rust on undercarriage bolts, water stains on upholstery, electrical issues (windows/locks fail), foam in engine oil, discolored carpets. Best method: Get a JomCheck inspection (RM99–150) which reveals flood history definitively.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can a flooded car still be driven?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, initially. But flooded cars develop electrical issues months later (door locks, power windows fail), rust spreads hidden, and engine reliability drops. Avoid buying flooded cars—the hidden repair costs are not worth the savings.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-6">How to Spot a Flooded Car</h1>
        <p className="text-lg text-[#6B7280] mb-6">Floods cost buyers thousands in hidden repairs. This guide teaches you the physical signs and how JomCheck catches what your eyes miss.</p>

        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#991B1B] mb-2">⚠️ Critical Rule</p>
          <p className="text-[#374151]"><strong>Never buy a car from 2022 that was in a flood zone, even if it looks fine.</strong> Flood damage appears 6–12 months later (electrical failures, rust inside panels, mold in AC). Get JomCheck; if it shows flood, walk away.</p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Physical Signs of Flood Damage</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">1. Musty / Moldy Smell</h3>
              <p className="text-[#374151]">The most obvious sign. If the car smells like wet carpet or old books, flood water got inside. Fresh air freshener can mask it—smell under the seats and trunk.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">2. Rust on Bolts Under the Car</h3>
              <p className="text-[#374151]">Get under the car (with seller's permission). Look at suspension bolts, exhaust hangers, undercarriage. If they're rusty but the car is only 5 years old = flood damage. Normal cars don't rust that fast underneath.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">3. Water Stains on Seats/Carpet</h3>
              <p className="text-[#374151]">Check bottom of seats, under floor mats. Brownish stains that won't come off = floodwater. Same for trunk.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">4. Electrical Issues</h3>
              <p className="text-[#374151]">Test all electrical: power windows, locks, air con, lights, dashboard. Intermittent failures (works one day, not the next) = water in wiring. Flooded cars develop these weeks after drying out.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-2">5. Foam in Engine Oil</h3>
              <p className="text-[#374151]">Check dipstick. If oil looks foamy/milky instead of brown = water in engine. This is catastrophic damage. Engine will fail soon.</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">JomCheck: The Definitive Test</h2>
          <p className="text-[#374151] mb-4">
            JomCheck is a certified mechanic inspection (RM99–150, 1 hour). It includes accident history, flood damage check, service records, engine condition. <strong>Get this before buying any car, especially if you suspect flooding.</strong>
          </p>
          <p className="text-[#374151]">
            <strong>What JomCheck reveals that your eyes can't:</strong>
          </p>
          <ul className="list-disc list-inside text-[#374151] space-y-2 mt-2">
            <li>Previous flood reports (if car was registered as damaged)</li>
            <li>Hidden rust inside door panels & under insulation</li>
            <li>Mold/moisture in AC system</li>
            <li>Previous repairs (replaced carpets, interior work)</li>
            <li>Engine compression (if flooding damaged internals)</li>
          </ul>
        </section>

        <section className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6">
          <h3 className="font-semibold text-[#064E4A] mb-2">💡 Smart Buyer Tip</h3>
          <p className="text-[#374151]">Use Paqar valuation on the plate. If the car is priced RM3–5k below market median, ask yourself why. Flood damage is often the reason.</p>
        </section>

        <section className="mt-8">
          <Link href="/" className="text-[#064E4A] underline">← Back to all FAQ</Link>
        </section>
      </div>
    </>
  )
}
