import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { OverpricedCheckerForm } from '@/components/check/OverpricedCheckerForm'
import { VARIANT_GUIDES, type VariantVerdict } from '@/lib/variant-guides'
import { variantLabelList } from '@/lib/variant-label'

type Props = { params: { model: string } }

export function generateStaticParams() {
  return Object.keys(VARIANT_GUIDES).map(model => ({ model }))
}

export function generateMetadata({ params }: Props): Metadata {
  const guide = VARIANT_GUIDES[params.model]
  if (!guide) return {}
  // Newest generation — that's what most searchers are cross-shopping.
  // Labels are the trim identifiers (G, X, H, AV), not the engine size: most
  // variants in a generation share a displacement, so the old first-token
  // extraction rendered "1.3 vs 1.3 vs 1.5 vs 1.5". See lib/variant-label.ts.
  const newestGen    = guide.generations[guide.generations.length - 1]
  const variantNames = variantLabelList(newestGen?.variants.map(v => v.name) ?? [])
  const title = `${guide.model} Varian Mana Patut Beli? ${variantNames} | Paqar`
  // "Beza" is how the query data shows people actually phrase this ("beza
  // honda city e dan v"), and the description has room for it that the title
  // does not.
  const description = `Beza varian ${guide.brand} ${guide.model} terpakai — ${variantNames}. ${guide.answerLine} Nilai terbaik, varian untuk elak, cara cam varian sebenar, dan harga berpatutan.`
  return {
    title,
    description,
    alternates: { canonical: `https://paqar.my/varian/${params.model}` },
    openGraph: { title, description, url: `https://paqar.my/varian/${params.model}` },
  }
}

const VERDICT_STYLE: Record<VariantVerdict, { label: string; cls: string }> = {
  'best-value':  { label: 'NILAI TERBAIK', cls: 'bg-[#DCFCE7] text-[#15803D]' },
  'ok':          { label: 'OKAY',          cls: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  'worth-it-if': { label: 'BERBALOI JIKA', cls: 'bg-[#FEF9C3] text-[#B45309]' },
  'avoid':       { label: 'ELAK',          cls: 'bg-[#FEE2E2] text-[#DC2626]' },
}

export default function VariantGuidePage({ params }: Props) {
  const guide = VARIANT_GUIDES[params.model]
  if (!guide) notFound()

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Harga Kereta Terpakai', item: 'https://paqar.my/harga-kereta-terpakai' },
          { '@type': 'ListItem', position: 3, name: `Varian ${guide.brand} ${guide.model}`, item: `https://paqar.my/varian/${params.model}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: guide.faq.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          {/* Hero — question + one-line answer */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Varian · {guide.brand}
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              {guide.question}
            </h1>
            <p className="font-body text-[14px] text-[#374151] leading-relaxed">
              {guide.answerLine}
            </p>
          </div>

          {/* Quick verdict strip */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-body text-[13px] text-[#374151]">Nilai terbaik</p>
              <p className="font-heading font-extrabold text-[15px] text-[#15803D]">{guide.bestValue}</p>
            </div>
            {guide.avoid && (
              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-[13px] text-[#374151]">Elak</p>
                <p className="font-heading font-bold text-[13px] text-[#DC2626] text-right">{guide.avoid}</p>
              </div>
            )}
          </div>

          {/* Variant ladder per generation */}
          {guide.generations.map(gen => (
            <div key={gen.label} className="space-y-3">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
                {gen.label} · {gen.years}
              </p>
              {gen.variants.map(v => {
                const style = VERDICT_STYLE[v.verdict]
                return (
                  <div key={v.name} className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="font-heading font-extrabold text-[17px] text-[#111827]">{v.name}</p>
                      <span className={`font-heading font-bold text-[10px] px-2.5 py-1 rounded-full flex-shrink-0 ${style.cls}`}>
                        {style.label}
                      </span>
                    </div>
                    {v.years && (
                      <p className="font-body text-[11px] text-[#9CA3AF] mb-1">{v.years}</p>
                    )}
                    <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">{v.verdictNote}</p>

                    <div className="space-y-1.5 mb-3">
                      {v.differentiators.map(d => (
                        <div key={d} className="flex gap-2 items-start">
                          <span className="text-[#064E4A] font-bold flex-shrink-0">·</span>
                          <p className="font-body text-[13px] text-[#374151]">{d}</p>
                        </div>
                      ))}
                    </div>

                    <p className="font-body text-[12px] text-[#6B7280] mb-3">
                      <span className="font-semibold">Harga terpakai:</span> {v.usedPriceBand}
                    </p>

                    <div className="bg-[#F9FAFB] rounded-lg p-3">
                      <p className="font-heading font-bold text-[11px] uppercase tracking-[.05em] text-[#6B7280] mb-1.5">
                        Macam mana nak cam
                      </p>
                      {v.spotChecks.map(s => (
                        <p key={s} className="font-body text-[12px] text-[#374151] leading-relaxed">✓ {s}</p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Red flags */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#B45309] mb-3">
              Red flag varian — hati-hati
            </h2>
            <ul className="space-y-2">
              {guide.redFlags.map((r, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151] leading-relaxed">
                  <span className="flex-shrink-0">⚠️</span>
                  {r}
                </li>
              ))}
            </ul>
            {guide.reconNote && (
              <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-3 pt-3 border-t border-[#FDE68A]/50">
                {guide.reconNote}
              </p>
            )}
          </div>

          {/* CTA — into the existing free check */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Dah jumpa {guide.model} yang berkenan? Semak harganya dulu:
            </p>
            <OverpricedCheckerForm initialBrand={guide.brand} initialModel={guide.model} />
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-1">
              Soalan Lazim
            </p>
            {guide.faq.map(f => (
              <details key={f.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{f.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{f.a}</p>
                </div>
              </details>
            ))}
          </div>

          {/* Related links */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
              Panduan berkaitan
            </p>
            <Link href={guide.hubHref ?? `/harga-kereta-terpakai/${guide.modelSlug}`} className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
              Harga {guide.brand} {guide.model} terpakai mengikut tahun →
            </Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
              Checklist sebelum bayar deposit →
            </Link>
            <Link href="/risiko-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
              Risiko beli kereta terpakai →
            </Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
