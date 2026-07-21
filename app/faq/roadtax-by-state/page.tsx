/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Roadtax by State in Malaysia 2026 | How Much to Pay | Paqar',
  description: 'Complete roadtax breakdown by state: Selangor, KL, Johor, Penang. How much roadtax for your car, engine size, vehicle type.',
}

export default function RoadtaxByState() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much is roadtax in Malaysia?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Roadtax depends on state, engine capacity, and vehicle type. Peninsular Malaysia: RM20–RM500/year. Sabah/Sarawak: RM15–RM300/year. A 2020 Honda City 1.5cc costs RM100–120/year in most states.',
        },
      },
      {
        '@type': 'Question',
        name: 'Why is roadtax different by state?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Each state sets its own roadtax rates. Selangor and KL are pricier (higher revenue demand). Rural states are cheaper. It\'s a state tax, not federal.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-6">Roadtax by State in Malaysia 2026</h1>
        <p className="text-lg text-[#6B7280] mb-6">How much roadtax do you pay? State-by-state breakdown + how to calculate for your car.</p>

        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#064E4A] mb-2">Quick Answer</p>
          <p className="text-[#374151]">
            A typical 2020 car with 1500cc engine costs <strong>RM100–120/year</strong> in most Peninsular states.
            Selangor & KL: higher. Johor & Kedah: lower. Sabah/Sarawak: separate rates.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Peninsular Malaysia Roadtax (2026)</h2>
          <p className="text-[#374151] mb-4">Based on engine capacity (cc). Rates vary by state.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="border p-3 text-left">Engine (cc)</th>
                  <th className="border p-3 text-left">Selangor/KL</th>
                  <th className="border p-3 text-left">Johor</th>
                  <th className="border p-3 text-left">Penang</th>
                  <th className="border p-3 text-left">Kedah</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-3 font-semibold">≤1000cc</td>
                  <td className="border p-3">RM50–60</td>
                  <td className="border p-3">RM40–50</td>
                  <td className="border p-3">RM45–55</td>
                  <td className="border p-3">RM35–45</td>
                </tr>
                <tr className="bg-[#F9FAFB]">
                  <td className="border p-3 font-semibold">1001–1500cc</td>
                  <td className="border p-3">RM100–120</td>
                  <td className="border p-3">RM80–100</td>
                  <td className="border p-3">RM90–110</td>
                  <td className="border p-3">RM70–90</td>
                </tr>
                <tr>
                  <td className="border p-3 font-semibold">1501–2000cc</td>
                  <td className="border p-3">RM180–220</td>
                  <td className="border p-3">RM150–190</td>
                  <td className="border p-3">RM160–200</td>
                  <td className="border p-3">RM130–170</td>
                </tr>
                <tr className="bg-[#F9FAFB]">
                  <td className="border p-3 font-semibold">2001cc+</td>
                  <td className="border p-3">RM300–500</td>
                  <td className="border p-3">RM250–400</td>
                  <td className="border p-3">RM270–420</td>
                  <td className="border p-3">RM220–350</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#6B7280] mt-4">💡 Rates are annual. Paid once per year at your state's Road Transport Department (JPJ).</p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Common Cars: Estimated Roadtax</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Car Model</th>
                <th className="border p-3 text-left">Engine</th>
                <th className="border p-3 text-left">Selangor</th>
                <th className="border p-3 text-left">Johor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3">Perodua Myvi</td>
                <td className="border p-3">1500cc</td>
                <td className="border p-3">RM110</td>
                <td className="border p-3">RM90</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">Honda City</td>
                <td className="border p-3">1500cc</td>
                <td className="border p-3">RM115</td>
                <td className="border p-3">RM95</td>
              </tr>
              <tr>
                <td className="border p-3">Toyota Vios</td>
                <td className="border p-3">1500cc</td>
                <td className="border p-3">RM110</td>
                <td className="border p-3">RM90</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
          <h3 className="font-semibold text-[#991B1B] mb-3">⚠️ Roadtax Overdue = Fine</h3>
          <ul className="text-[#374151] space-y-2">
            <li>❌ Expired roadtax: fine RM300–1000</li>
            <li>❌ Driving without valid roadtax: can be towed</li>
            <li>✅ Renew online: JPJ website (5 minutes)</li>
            <li>✅ Or at any JPJ counter with your IC + vehicle registration</li>
          </ul>
        </section>

        <FaqGetValuationCta faqSlug="roadtax-by-state" />
      </div>
    </>
  )
}
