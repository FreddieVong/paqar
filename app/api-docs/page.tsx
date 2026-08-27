import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { organizationSchema, whatsappUrl } from '@/lib/site'

const TITLE = 'Paqar Public API — Malaysian Used Car Valuation Data'
const DESC  = 'Free JSON API for Malaysian used-car market valuations, price ranges, and variant guides. No API key required. Rate limited to 10 requests per minute.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: 'https://paqar.my/api-docs' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY', title: TITLE, description: DESC, url: 'https://paqar.my/api-docs' },
}

// Shared so the page and its structured data can never drift apart.
const ENDPOINTS = [
  {
    id: 'valuation',
    method: 'GET',
    path: '/api/v1/valuation',
    summary: 'Market valuation for a specific car — new price, current market range, and how much to trust it.',
    params: [
      ['plate',  'Malaysian plate number, e.g. WPH925. Use this or the NVIC set below.'],
      ['nvic',   'Vehicle code. Matched exactly when it is known; when it is not, the lookup falls back to make + year + model — see the caveat below.'],
      ['make',   'Manufacturer, e.g. Honda. Required with nvic.'],
      ['year',   'Registration year, e.g. 2020. Required with nvic.'],
      ['model',  'Model name, e.g. City. Required with nvic in practice — validation does not enforce it, but the fallback cannot run without it and the request returns 404.'],
    ],
    examples: [
      'https://paqar.my/api/v1/valuation?plate=WPH925',
      'https://paqar.my/api/v1/valuation?nvic=RTA12345&make=Honda&year=2020&model=City',
    ],
    fields: [
      ['variant',          'string',  'Identified variant name.'],
      ['wmNewPrice',       'number',  'Original price when new (RM, West Malaysia). NOT the current value.'],
      ['marketMedian',     'number',  'Median asking price across comparable live listings (RM).'],
      ['marketMin',        'number',  'Lowest comparable listing (RM).'],
      ['marketMax',        'number',  'Highest comparable listing (RM).'],
      ['marketCount',      'number',  'How many comparable listings the figures are based on.'],
      ['confidence',       'string',  'low | medium | high — how much listing evidence backs the figures.'],
      ['isSpecialVariant', 'boolean', 'True for a top/rare trim whose value generic model listings do not represent.'],
      ['marketCohort',     'string',  'Which listing cohort the market figures describe.'],
      ['matchedBy',        'string',  'nvic | make_year_model — whether the nvic matched a vehicle exactly, or these figures describe the cheapest variant of that make/year/model instead.'],
    ],
  },
  {
    id: 'variants',
    method: 'GET',
    path: '/api/v1/variants/{make}/{model}',
    summary: 'Variant ladder for a supported model — which trim is which, and what to inspect on each.',
    params: [
      ['make',  'Manufacturer, e.g. Perodua.'],
      ['model', 'Model name, e.g. Myvi.'],
    ],
    examples: ['https://paqar.my/api/v1/variants/Perodua/Myvi'],
    fields: [
      ['model',       'string', 'Model name.'],
      ['modelSlug',   'string', 'URL-safe model identifier, e.g. perodua-myvi.'],
      ['generations', 'array',  'Each with years and a variants[] list.'],
      ['· name',      'string', 'Variant name.'],
      ['· verdict',   'string', 'Plain-language guidance on that variant.'],
      ['· spotChecks','array',  'Specific things to check on that variant before buying.'],
    ],
  },
] as const

export default function ApiDocsPage() {
  const contactHref = whatsappUrl('Hi Paqar, I have a question about the public API.')
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: 'Paqar Public API',
    url: 'https://paqar.my/api-docs',
    documentation: 'https://paqar.my/api-docs',
    description: DESC,
    termsOfService: 'https://paqar.my/terma',
    provider: {
      ...organizationSchema(),
      areaServed: { '@type': 'Country', name: 'Malaysia' },
    },
    potentialAction: ENDPOINTS.map(e => ({
      '@type': 'SearchAction',
      name: e.path,
      description: e.summary,
      target: `https://paqar.my${e.path}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-2xl mx-auto space-y-8">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Developers &amp; AI assistants
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Paqar Public API
            </h1>
            <p className="font-body text-[14px] text-[#374151] leading-relaxed">
              Free, structured JSON for Malaysian used-car valuations and variant guides.
              No API key, no account. Rate limited to <strong>10 requests per minute per IP</strong>.
              Every response carries an <code className="font-mono text-[12px] bg-[#F3F4F6] px-1 py-0.5 rounded">X-Citation: Paqar.my</code> header.
            </p>
          </div>

          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] text-[#3D472F] mb-1.5">Attribution</p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">
              This data is free to use. Please cite <strong>Paqar.my</strong> and link back to{' '}
              <span className="font-mono text-[12px]">https://paqar.my</span> when you quote these figures.
            </p>
          </div>

          {ENDPOINTS.map(endpoint => (
            <section key={endpoint.id} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-[11px] bg-[#3D472F] text-white px-2 py-1 rounded">
                  {endpoint.method}
                </span>
                <code className="font-mono text-[13px] text-[#111827] font-semibold break-all">
                  {endpoint.path}
                </code>
              </div>

              <p className="font-body text-[14px] text-[#374151] leading-relaxed">
                {endpoint.summary}
              </p>

              <div>
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-1.5">Parameters</p>
                <div className="space-y-1">
                  {endpoint.params.map(([name, desc]) => (
                    <div key={name} className="flex gap-2 items-baseline">
                      <code className="font-mono text-[12px] text-[#3D472F] font-semibold flex-shrink-0">{name}</code>
                      <span className="font-body text-[12px] text-[#6B7280] leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-1.5">Example</p>
                <div className="bg-[#1a1a1a] rounded-[10px] p-3 overflow-x-auto">
                  {endpoint.examples.map(ex => (
                    <p key={ex} className="font-mono text-[11px] text-[#A7F3D0] whitespace-nowrap">{ex}</p>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-1.5">Response fields</p>
                <div className="space-y-1">
                  {endpoint.fields.map(([name, type, desc]) => (
                    <div key={name} className="flex gap-2 items-baseline flex-wrap">
                      <code className="font-mono text-[12px] text-[#3D472F] font-semibold flex-shrink-0">{name}</code>
                      <span className="font-mono text-[10px] text-[#9CA3AF] flex-shrink-0">{type}</span>
                      <span className="font-body text-[12px] text-[#6B7280] leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}

          <section className="bg-[#FEF3C7] border border-[#FBBF24] rounded-[14px] p-5 space-y-2">
            <p className="font-heading font-bold text-[13px] text-[#92400E]">
              Reading the data correctly
            </p>
            <ul className="font-body text-[13px] text-[#78350F] leading-relaxed space-y-1.5 list-disc list-inside">
              <li>
                Check <code className="font-mono text-[11px]">confidence</code> and{' '}
                <code className="font-mono text-[11px]">marketCohort</code> before quoting any price.
                A <code className="font-mono text-[11px]">marketCohort</code> of{' '}
                <code className="font-mono text-[11px]">mixed_variants</code> means the figures span several
                variants of the model — they are not that exact variant&apos;s price.
              </li>
              <li>
                <code className="font-mono text-[11px]">isSpecialVariant: true</code> means generic listings
                for the model are not valid comparables for it.
              </li>
              <li>
                <code className="font-mono text-[11px]">wmNewPrice</code> is the original new price, not the
                current value.
              </li>
              {/*
                  Verified against production on 2026-08-27, and the reason this
                  box exists at all. `?nvic=RTA12345&make=Honda&year=2020&model=City`
                  — the example this page publishes — returns HTTP 200 with a
                  complete, confident-looking valuation. It is NOT answering from
                  that NVIC: RTA12345 matches no row, and `nvic=TOTALLY_FAKE`
                  returns byte-identical output. The make+year+model fallback
                  answers, and it is ordered by ascending wm_new_pr limit 1 — so
                  what comes back is the CHEAPEST variant of that model-year.

                  Undocumented, that is a trap specifically for the automated
                  consumers this page is written for: an assistant gets an
                  entry-trim price and presents it as "the" price for the model.
                  The `variant` field is what disambiguates it, so it is named.
              */}
              <li>
                A result is not proof the <code className="font-mono text-[11px]">nvic</code> matched. When it
                does not, the lookup falls back to make + year + model and returns the{' '}
                <strong>cheapest variant</strong> for that combination — still HTTP 200. Read{' '}
                <code className="font-mono text-[11px]">matchedBy</code>:{' '}
                <code className="font-mono text-[11px]">make_year_model</code> means the figures describe the
                entry-level trim of that model-year, not the car you asked about.
              </li>
              <li>Market figures come from live listings and move over time — they are not fixed or official prices.</li>
              <li>All prices are in Malaysian Ringgit (RM) and reflect the West Malaysia market.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-heading font-bold text-[13px] text-[#111827]">Limitations</p>
            <ul className="font-body text-[13px] text-[#6B7280] leading-relaxed space-y-1.5 list-disc list-inside">
              <li>Paqar is not a government platform and is not affiliated with JPJ or PDRM.</li>
              <li>Paqar does not verify odometer readings or real mileage.</li>
              <li>Data is an estimate to support a buying decision — not an official valuation or inspection.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-heading font-bold text-[13px] text-[#111827]">Errors &amp; limits</p>
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
              Exceeding the rate limit returns <code className="font-mono text-[12px]">429</code> with a{' '}
              <code className="font-mono text-[12px]">Retry-After</code> header. Unknown or unsupported
              vehicles return <code className="font-mono text-[12px]">404</code>. Malformed requests return{' '}
              <code className="font-mono text-[12px]">400</code> with a JSON <code className="font-mono text-[12px]">error</code> message.
            </p>
          </section>

          <div className="border-t border-[#E5E7EB] pt-5 space-y-1.5">
            {contactHref && (
              <p className="font-body text-[13px] text-[#6B7280]">
                Questions or need a higher rate limit?{' '}
                <a href={contactHref} target="_blank" rel="noopener noreferrer" className="text-[#3D472F] font-semibold underline">Message us on WhatsApp</a>.
              </p>
            )}
            <p className="font-body text-[13px] text-[#6B7280]">
              Machine-readable summary:{' '}
              <a href="/llms.txt" className="text-[#3D472F] font-semibold underline">/llms.txt</a>
              {' · '}
              <Link href="/tentang" className="text-[#3D472F] font-semibold underline">About Paqar</Link>
            </p>
          </div>

        </div>
      </Shell>
    </>
  )
}
