import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { CollectionSchema } from '@/components/layout/CollectionSchema'
import { BRAND_OG_ALT } from '@/lib/seo/page-metadata'
import { GuideRelated } from '@/components/faq/GuideRelated'

export const metadata: Metadata = {
  title: 'Bandingkan Kereta Terpakai Malaysia — Myvi vs Axia, Vios vs City | Paqar',
  description: 'Bandingkan harga kereta terpakai Malaysia side-by-side. Myvi vs Axia, Vios vs City, Bezza vs Saga, Alza vs X50.',
  alternates: { canonical: 'https://paqar.my/bandingkan' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: BRAND_OG_ALT }],
      locale: 'ms_MY',
    title: 'Bandingkan Kereta Terpakai Malaysia — Myvi vs Axia, Vios vs City',
    description: 'Bandingkan harga kereta terpakai Malaysia side-by-side. Myvi vs Axia, Vios vs City, Bezza vs Saga, Alza vs X50.',
    url: 'https://paqar.my/bandingkan',
  },
}

const COMPARISONS = [
  { slug: 'myvi-vs-axia',   titleA: 'Perodua Myvi',  titleB: 'Perodua Axia',  desc: 'Budget hatchback — mana lebih berbaloi untuk anda?',          tag: 'Paling banyak dicari' },
  { slug: 'myvi-vs-saga',   titleA: 'Perodua Myvi',  titleB: 'Proton Saga',   desc: 'Hatchback vs sedan — kereta paling popular di Malaysia.',       tag: null },
  { slug: 'vios-vs-city',   titleA: 'Toyota Vios',   titleB: 'Honda City',    desc: 'Sedan Jepun paling laris — nilai jual semula vs ruang dalaman.', tag: null },
  { slug: 'bezza-vs-saga',  titleA: 'Perodua Bezza', titleB: 'Proton Saga',   desc: 'Dua sedan nasional — mana lebih jimat dan berbaloi?',           tag: null },
  { slug: 'axia-vs-saga',   titleA: 'Perodua Axia',  titleB: 'Proton Saga',   desc: 'Dua kereta bajet paling murah — enjin kecil vs ruang besar.',   tag: null },
  { slug: 'myvi-vs-bezza',  titleA: 'Perodua Myvi',  titleB: 'Perodua Bezza', desc: 'Hatchback atau sedan Perodua — kabin besar vs boot besar.',     tag: null },
  { slug: 'alza-vs-x50',    titleA: 'Perodua Alza',  titleB: 'Proton X50',    desc: 'MPV 7-tempat duduk vs SUV kompak — pilihan untuk keluarga.',    tag: null },
]

export default function BandingkanHub() {
  return (
    <>
      <CollectionSchema
        name="Bandingkan Kereta Terpakai Malaysia"
        url="https://paqar.my/bandingkan"
        description="Perbandingan model kereta terpakai popular di Malaysia — harga, kos, dan mana lebih berbaloi."
        breadcrumbName="Bandingkan"
        items={COMPARISONS.map(c => ({ name: `${c.titleA} vs ${c.titleB}`, url: `https://paqar.my/bandingkan/${c.slug}` }))}
      />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-5">
          <div>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-2">
              Bandingkan kereta terpakai
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Perbandingan harga pasaran dan kelebihan setiap model — bantu anda pilih yang paling sesuai.
            </p>
          </div>

          <div className="space-y-3">
            {COMPARISONS.map((c) => (
              <Link key={c.slug} href={`/bandingkan/${c.slug}`}
                className="block bg-white border border-[#E5E7EB] rounded-[14px] p-5 hover:border-[#3D472F] hover:bg-[#F0FDF4] transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-heading font-bold text-[15px] text-[#111827] group-hover:text-[#3D472F] transition-colors">
                    {c.titleA} <span className="text-[#9CA3AF]">vs</span> {c.titleB}
                  </p>
                  {c.tag && (
                    <span className="font-body text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-bold bg-[#DCFCE7] text-[#15803D]">
                      {c.tag}
                    </span>
                  )}
                </div>
                <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{c.desc}</p>
                <p className="font-body text-[12px] text-[#3D472F] mt-2 group-hover:underline">Lihat perbandingan →</p>
              </Link>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Link href="/harga-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga semua model →</Link>
            <Link href="/panduan" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Panduan beli kereta terpakai →</Link>
          </div>

          <GuideRelated slug="bandingkan" />
        </div>
      </Shell>
    </>
  )
}
