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
//
// Each row used to carry a rounded market span — "RM29k - RM42k" — beside the
// model tag. Rounding to the nearest thousand does not change what it is: the
// minimum and maximum of a scraped cohort, which is the range the RM12 report
// sells. It is gone, and `spans` with it, so the component can no longer
// receive the figures at all. The rows, the links and every year chip survive
// unchanged; only the disclosure goes.

export function BrandModelList({ brand, models }: {
  brand:  string
  models: BrandModel[]
}) {
  return (
    <div className="flex flex-col gap-3">
      {models.map((m) => {
        const heading = (
          <>
            <div>
              <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">{brand} {m.model}</p>
              <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">
                {m.tag}
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
                // The chip stays a bare year — it is a tight wrapping row and
                // "Harga Myvi 2021 terpakai" in every pill would wreck it. The
                // label carries the meaning instead, which fixes the same
                // problem for two different audiences: a screen reader
                // otherwise announces "link, 2021" with no idea what it opens,
                // and these were the ONLY inbound links most year pages had —
                // 58 pages whose entire anchor text was a repeated numeral.
                <Link
                  key={y}
                  href={`/harga-${m.yearKey}-${y}`}
                  aria-label={`Harga ${m.model} ${y} terpakai`}
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
