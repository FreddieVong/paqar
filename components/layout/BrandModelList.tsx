import Link from 'next/link'
import type { BrandModel } from '@/lib/model-hubs'

// Shared model list for the five brand hub pages (/harga-{brand}-terpakai).
//
// All five had this markup copy-pasted, and all five linked every model to
// /harga-kereta-terpakai/{slug} unconditionally — including Civic, Persona and
// Yaris, which have no hub page and so returned a hard 404 via notFound().
//
// A model without a `hubSlug` still renders: same card, same price range, same
// year chips. It simply is not a link, because there is nowhere to go. The
// year pages it points to are real and stay clickable.

export function BrandModelList({ brand, models }: { brand: string; models: BrandModel[] }) {
  return (
    <div className="flex flex-col gap-3">
      {models.map((m) => {
        const heading = (
          <>
            <div>
              <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">{brand} {m.model}</p>
              <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">{m.range} · {m.tag}</p>
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
