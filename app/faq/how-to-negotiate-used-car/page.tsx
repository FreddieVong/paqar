/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How to Negotiate a Used Car Price | Paqar Guide',
  description: 'Master negotiation tactics: use Paqar valuations as your anchor, know when to walk away, typical discounts, leverage inspection results.',
}

export default function HowToNegotiate() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">How to Negotiate a Used Car Price</h1>
      <p className="text-lg text-[#6B7280] mb-6">Professional car buyers save RM2–5k per purchase. Here's their playbook.</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#064E4A] mb-2">The Golden Rule</p>
        <p className="text-[#374151]"><strong>Always have a Paqar valuation on the plate before negotiating.</strong> Know the market price. Sellers can sense uncertainty. Confidence = leverage.</p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">5-Step Negotiation Framework</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-[#064E4A] pl-4">
            <h3 className="text-lg font-semibold mb-2">Step 1: Get Your Anchor (Paqar Valuation)</h3>
            <p className="text-[#374151] mb-2">Before viewing the car, check its plate on Paqar. Example:</p>
            <ul className="bg-[#F9FAFB] p-4 rounded text-[#374151] space-y-1 text-sm">
              <li>Listing price: RM32,000</li>
              <li><strong>Paqar valuation: RM28,000–30,000</strong></li>
              <li>Your target: RM27,000–29,000</li>
            </ul>
            <p className="text-[#374151] mt-2"><strong>Why?</strong> Paqar is based on real Mudah sales data. Sellers know their asking price is often optimistic. You have leverage.</p>
          </div>

          <div className="border-l-4 border-[#064E4A] pl-4">
            <h3 className="text-lg font-semibold mb-2">Step 2: Inspect Thoroughly (Find Ammunition)</h3>
            <ul className="text-[#374151] space-y-2">
              <li>✓ Get JomCheck inspection (RM99–150)</li>
              <li>✓ Note any repairs needed: tyres, brake pads, filters</li>
              <li>✓ Check for mileage concerns ("You said 80k but odometer says 85k?")</li>
              <li>✓ Take photos of minor damage (dents, scratches)</li>
            </ul>
            <p className="text-[#374151] mt-2"><strong>Real example:</strong> "JomCheck found brake pads at 3mm (need replacement soon—RM400). That's RM400 I'll spend after buying. Your asking price needs to account for that."</p>
          </div>

          <div className="border-l-4 border-[#064E4A] pl-4">
            <h3 className="text-lg font-semibold mb-2">Step 3: Make Your Opening Offer</h3>
            <p className="text-[#374151] mb-2">Open 10–15% below asking price. Example:</p>
            <ul className="bg-[#F9FAFB] p-4 rounded text-[#374151] space-y-1 text-sm">
              <li>Asking: RM32,000</li>
              <li>Your opening: RM27,000 (16% below)</li>
              <li>Seller's counteroffer: RM30,000</li>
              <li>Your reply: RM28,500</li>
              <li>Final: RM29,000 (RM3k discount)</li>
            </ul>
            <p className="text-[#374151] mt-2"><strong>Script:</strong> "Your asking price is RM32k, but Paqar shows similar cars at RM28–30k. JomCheck found [list issues]. I'm offering RM27k based on market data."</p>
          </div>

          <div className="border-l-4 border-[#064E4A] pl-4">
            <h3 className="text-lg font-semibold mb-2">Step 4: Use Leverage Points</h3>
            <ul className="text-[#374151] space-y-2">
              <li>💰 <strong>Market data:</strong> "Paqar shows RM28–30k. You're asking RM32k—that's 10% above market."</li>
              <li>🔧 <strong>Repairs needed:</strong> "JomCheck found brake pads, air filter. That's RM500–600 out of pocket."</li>
              <li>⏰ <strong>Time pressure:</strong> "I have 2 other cars to view. I need to decide today. Discount gets you a quick sale."</li>
              <li>💳 <strong>Cash buyer:</strong> "I'm paying cash today (no financing delay). That's worth RM1–2k to you."</li>
            </ul>
          </div>

          <div className="border-l-4 border-[#064E4A] pl-4">
            <h3 className="text-lg font-semibold mb-2">Step 5: Know When to Walk Away</h3>
            <p className="text-[#374151]"><strong>Walk away if:</strong></p>
            <ul className="text-[#374151] space-y-1 mt-2">
              <li>❌ Seller won't budge below RM31k when market is RM28–30k (unrealistic)</li>
              <li>❌ JomCheck finds major issues (flood, accident, engine problems) and seller refuses price cut</li>
              <li>❌ Mileage or variant doesn't match what seller claimed (dishonesty = red flag)</li>
              <li>❌ Gut feeling says "something's off" (trust your instinct)</li>
            </ul>
            <p className="text-[#374151] mt-4"><strong>Why?</strong> Another car will come along. You're not desperate. Desperation = overpaying.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Typical Discounts by Condition</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F3F4F6]">
              <th className="border p-3 text-left">Condition</th>
              <th className="border p-3 text-left">Discount Off Asking Price</th>
              <th className="border p-3 text-left">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3">Excellent (JomCheck clean)</td>
              <td className="border p-3">2–3%</td>
              <td className="border p-3">RM30k asking → RM29.1k</td>
            </tr>
            <tr className="bg-[#F9FAFB]">
              <td className="border p-3">Good (minor wear, clean history)</td>
              <td className="border p-3">5–8%</td>
              <td className="border p-3">RM30k asking → RM27.9k</td>
            </tr>
            <tr>
              <td className="border p-3">Fair (cosmetic issues, no accidents)</td>
              <td className="border p-3">8–12%</td>
              <td className="border p-3">RM30k asking → RM26.4k</td>
            </tr>
            <tr className="bg-[#F9FAFB]">
              <td className="border p-3">Poor (repairs needed, high mileage)</td>
              <td className="border p-3">12–15%</td>
              <td className="border p-3">RM30k asking → RM25.5k</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-[#991B1B] mb-2">⚠️ Red Flags: Walk Away</h3>
        <ul className="text-[#374151] space-y-2">
          <li>❌ Seller refuses JomCheck inspection ("It's fine, trust me")</li>
          <li>❌ Selling because transmission is "acting up" (major repair ahead)</li>
          <li>❌ "My mechanic says it's good" but JomCheck finds problems (bias)</li>
          <li>❌ Price is RM5k+ below Paqar median ("If it sounds too good, it is")</li>
        </ul>
      </div>

        <FaqGetValuationCta faqSlug="how-to-negotiate-used-car" />
    </div>
  )
}
