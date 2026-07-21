/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Honda City vs Toyota Vios: Which Should You Buy? | Paqar',
  description: 'Detailed comparison: price, reliability, resale value, comfort, fuel efficiency. Which is the better buy?',
}

export default function CityVsVios() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">Honda City vs Toyota Vios: Which Should You Buy?</h1>
      <p className="text-lg text-[#6B7280] mb-6">Direct comparison: both popular, both reliable. But which is the better deal?</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#064E4A] mb-2">Quick Verdict</p>
        <p className="text-[#374151]">
          <strong>Honda City:</strong> Better features, holds value better. Choose if you want a modern feel.
          <br/>
          <strong>Toyota Vios:</strong> Better reliability, slightly cheaper. Choose if you want absolute durability.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Head-to-Head Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Factor</th>
                <th className="border p-3 text-left">Honda City</th>
                <th className="border p-3 text-left">Toyota Vios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3 font-semibold">Price (2016, 110k km)</td>
                <td className="border p-3">RM26–28k</td>
                <td className="border p-3">RM24–26k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Resale Value</td>
                <td className="border p-3">Better (+5%)</td>
                <td className="border p-3">Slower</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Reliability</td>
                <td className="border p-3">Good</td>
                <td className="border p-3">Excellent</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Fuel Economy</td>
                <td className="border p-3">7–8 L/100km</td>
                <td className="border p-3">7–8 L/100km</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Interior Feel</td>
                <td className="border p-3">Modern, upscale</td>
                <td className="border p-3">Basic, plain</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Touchscreen (mid trim)</td>
                <td className="border p-3">6.5" Android CarPlay</td>
                <td className="border p-3">Basic 4" radio</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Comfort (seats, AC)</td>
                <td className="border p-3">More spacious</td>
                <td className="border p-3">Adequate</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3 font-semibold">Spare Parts Cost</td>
                <td className="border p-3">Slightly higher</td>
                <td className="border p-3">Cheaper</td>
              </tr>
              <tr>
                <td className="border p-3 font-semibold">Lifespan (with care)</td>
                <td className="border p-3">400k+ km</td>
                <td className="border p-3">500k+ km</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Which to Choose?</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Choose Honda City If:</h3>
            <ul className="text-[#374151] space-y-2">
              <li>✅ You want a modern-feeling interior</li>
              <li>✅ Touchscreen + CarPlay matter to you</li>
              <li>✅ You prioritize resale value (better hold)</li>
              <li>✅ You plan to keep it 3–5 years (resale is easier)</li>
              <li>✅ Budget allows RM26–28k</li>
            </ul>
          </div>

          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="text-lg font-semibold mb-2">Choose Toyota Vios If:</h3>
            <ul className="text-[#374151] space-y-2">
              <li>✅ You want Toyota's legendary reliability</li>
              <li>✅ You plan to keep it 10+ years (lifespan matters)</li>
              <li>✅ Budget is tight (RM24–26k vs RM26–28k)</li>
              <li>✅ You value simplicity (fewer electronics = fewer things break)</li>
              <li>✅ You care more about durability than features</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">The Verdict</h2>
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6">
          <p className="text-[#374151] mb-4">
            <strong>Honda City wins for features and resale.</strong> You get a more modern car that holds value better.
          </p>
          <p className="text-[#374151]">
            <strong>Toyota Vios wins for longevity.</strong> It'll outlast the City by 100k+ km if you take care of it.
          </p>
          <p className="text-[#374151] mt-4">
            <strong>Our recommendation:</strong> If you're under RM28k budget, get the City. If you're budget-conscious and plan to keep the car 10+ years, get the Vios. Both are solid cars—you can't go wrong.
          </p>
        </div>
      </section>

      <div className="text-center mt-12">
        <p className="text-[#374151] mb-4">Compare prices for specific listings using Paqar.</p>
        <a href="/" className="inline-block bg-[#064E4A] text-white px-6 py-3 rounded-lg font-semibold">Get Valuation</a>
      </div>
    </div>
  )
}
