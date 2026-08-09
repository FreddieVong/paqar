import Link from 'next/link'
import type { BrandModel } from '@/lib/model-hubs'
import type { ModelPriceSpan } from '@/lib/db/market-prices'

// Shared model list for the five brand hub pages (/harga-{brand}-terpakai).
//
// All five had this markup copy-pasted, and all five linked every model to
// /harga-kereta-terpakai/{slug} unconditionally — including Civic, Persona and
// Yaris, which have no hub page and so returned a hard 404 via notFound().
//
// A model without a `hubSlug` still renders: same card, same price range, same
// year chips. It simply is not a link, because there is nowhere to go. The
// year pages it points to are real and stay clickable.
//
// `spans` is keyed on yearKey and comes from getCoverageModelSpans(). A model
// with no entry renders its tag alone: the row, the link and every year chip
// survive, only the unevidenced figure goes. Dropping the row instead would
// cost internal links to pages that are perfectly fine.

function formatSpan(span: ModelPriceSpan): string {
  const k = (n: number) => `RM${Math.round(n / 1000)}k`
  return `${k(span.min)} – ${k(span.max)}`
}

export function BrandModelList({ brand, models, spans }: {
  brand:  string
  models: BrandModel[]
  spans:  Map<string, ModelPriceSpan>
}) {
  return (
    <div className="flex flex-col gap-3">
      {models.map((m) => {
        const span = spans.get(m.yearKey)
        const heading = (
          <>
            <div>
              <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">{brand} {m.model}</p>
              <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">
                {span ? `${formatSpan(span)} · ${m.tag}` : m.tag}
              </p>
            </div>
            {m.hubSlug && (
              <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
            )}
          </>
        )

        return (
          <div key={m.model} className="space-y-1.5">
            {m.hubSlug ? (
              <Link
                href={`/harga-kereta-terpakai/${m.hubSlug}`}
                className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group"
              >
                {heading}
              </Link>
            ) : (
              // Same card, minus the hover affordances and the arrow — both
              // would promise a destination that does not exist.
              <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5">
                {heading}
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap px-1">
              {m.years.map(y => (
                <Link
                  key={y}
                  href={`/harga-${m.yearKey}-${y}`}
                  className="font-body text-[11px] text-[#064E4A] bg-[#F0FDF4] border border-[#BBF7D0] rounded-[6px] px-2 py-0.5 hover:bg-[#DCFCE7] transition-colors"
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Only models with a real hub page belong in ItemList structured data. */
export function brandCollectionItems(brand: string, models: BrandModel[]) {
  return models
    .filter((m): m is BrandModel & { hubSlug: NonNullable<BrandModel['hubSlug']> } => Boolean(m.hubSlug))
    .map(m => ({ name: `${brand} ${m.model}`, url: `https://paqar.my/harga-kereta-terpakai/${m.hubSlug}` }))
}
