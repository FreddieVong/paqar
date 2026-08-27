import Link from 'next/link'
import { GUIDE_LINKS } from '@/lib/seo/guide-links'

/**
 * "Baca seterusnya" — the cross-links at the foot of a buyer guide, above the
 * CTA.
 *
 * Renders nothing when a guide has no entry, rather than an empty heading:
 * a related block with nothing in it is worse than no block, and this way a
 * new guide is not broken by having no links yet.
 *
 * A server component on purpose. The guides are static, and the one client
 * component they already carry (FaqGetValuationCta, which reads UTM params off
 * the URL) is enough JavaScript for a page of prose.
 */
export function GuideRelated({ slug }: { slug: string }) {
  const links = GUIDE_LINKS[slug]
  if (!links?.length) return null

  return (
    <section className="mb-10" aria-labelledby="baca-seterusnya">
      <h2 id="baca-seterusnya" className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-3">
        Baca seterusnya
      </h2>
      <div className="flex flex-col gap-2.5">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="block bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#3D472F] hover:bg-[#F4F6F0] transition-colors group"
          >
            <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#3D472F] transition-colors mb-0.5">
              {link.title}
            </p>
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
              {link.why}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
