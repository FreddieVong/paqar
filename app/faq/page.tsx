import type { Metadata } from 'next'
import Link    from 'next/link'
// Nav and Shell come from app/faq/layout.tsx, which wraps this page and every
// /faq/* guide — rendering them here too would double the chrome.

const TITLE = 'Soalan Lazim & Panduan Pembeli Kereta Terpakai | Paqar'
const DESC  = 'Panduan lengkap pembeli kereta terpakai Malaysia — cara pilih model, cara rundingan harga, cara kesan kereta banjir, checklist sebelum beli, dan kadar roadtax sebenar JPJ.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: 'https://paqar.my/faq' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY', title: TITLE, description: DESC, url: 'https://paqar.my/faq' },
}

// Titles/descriptions mirror each guide's own metadata so this hub never
// promises something the destination page does not deliver. All eight guides
// are now in Malay, matching the site and — per Search Console — the language
// people actually search in.
const GROUPS = [
  {
    heading: 'Panduan model',
    items: [
      { slug: 'best-first-car-under-30k',   title: 'Kereta pertama terbaik bawah RM30k',            desc: 'Pilihan kereta pertama bawah RM30,000 — banding Myvi, City dan Vios dengan harga iklan setanding.' },
      { slug: 'honda-city-buying-guide',    title: 'Panduan beli Honda City terpakai',              desc: 'Generasi mana patut beli, varian S/E/V, harga iklan setanding, dan apa perlu disemak.' },
      { slug: 'toyota-vios-buying-guide',   title: 'Panduan beli Toyota Vios terpakai',             desc: 'Generasi mana paling berbaloi, julat harga ikut tahun dan jarak tempuh, serta tanda bahaya Vios.' },
      { slug: 'honda-city-vs-toyota-vios',  title: 'Honda City vs Toyota Vios — mana satu?',        desc: 'Perbandingan terus: harga, kebolehpercayaan, nilai jual semula, keselesaan dan penggunaan minyak.' },
    ],
  },
  {
    heading: 'Sebelum bayar deposit',
    items: [
      { slug: 'what-to-check-buying-used-car', title: 'Senarai semak penuh sebelum beli',           desc: 'Senarai semak penuh — luaran, dalaman, enjin, elektrik, test drive, dan bila patut berundur.' },
      { slug: 'how-to-negotiate-used-car',     title: 'Cara rundingkan harga kereta terpakai',      desc: 'Rangka rundingan 5 langkah, berapa peratus diskaun realistik ikut kondisi, dan bila patut berundur.' },
      { slug: 'how-to-spot-flood-cars',        title: 'Cara kesan kereta banjir',                   desc: 'Tanda fizikal kereta banjir — bau, karat, kesan air, masalah elektrik — dan cara sahkan rekodnya.' },
    ],
  },
  {
    heading: 'Kos & cukai',
    items: [
      { slug: 'roadtax-by-state', title: 'Harga roadtax ikut negeri', desc: 'Ia tidak berbeza ikut negeri di Semenanjung — jadual JPJ sebenar mengikut kapasiti enjin, dan kenapa ramai tersalah sangka.' },
    ],
  },
]

export default function FaqHubPage() {
  const allItems = GROUPS.flatMap(g => g.items)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    url: 'https://paqar.my/faq',
    description: DESC,
    inLanguage: 'ms-MY',
    isPartOf: { '@type': 'WebSite', name: 'Paqar', url: 'https://paqar.my' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: allItems.length,
      itemListElement: allItems.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.title,
        url: `https://paqar.my/faq/${item.slug}`,
      })),
    },
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
      { '@type': 'ListItem', position: 2, name: 'Soalan Lazim', item: 'https://paqar.my/faq' },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-7">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Soalan Lazim
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Panduan pembeli kereta terpakai
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Semua yang anda perlu tahu sebelum bayar deposit — cara pilih model,
              cara rundingan, dan apa yang perlu disemak pada kereta.
            </p>
          </div>

          {GROUPS.map(group => (
            <div key={group.heading} className="space-y-2.5">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">
                {group.heading}
              </p>
              <div className="flex flex-col gap-2.5">
                {group.items.map(item => (
                  <Link
                    key={item.slug}
                    href={`/faq/${item.slug}`}
                    className="block bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#3D472F] hover:bg-[#F0FDF4] transition-colors group"
                  >
                    <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#3D472F] transition-colors mb-0.5">
                      {item.title}
                    </p>
                    <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
                      {item.desc}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-5 space-y-2">
            <p className="font-heading font-bold text-[14px] text-[#3D472F]">
              Dah jumpa kereta yang berkenan?
            </p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">
              Hantar link iklan kereta itu kepada Paqar dahulu — kami beritahu apa patut anda buat sebelum bayar deposit.
            </p>
            <Link
              href="/"
              className="inline-block bg-[#3D472F] text-white font-heading font-extrabold text-[13px] rounded-[10px] px-4 py-2.5 hover:bg-[#2E3523] transition-colors mt-1"
            >
              Semak harga kereta →
            </Link>
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Lagi</p>
            <Link href="/panduan"              className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Semua panduan pembeli →</Link>
            <Link href="/harga-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Harga pasaran ikut model →</Link>
            <Link href="/bandingkan"           className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Bandingkan model →</Link>
          </div>

        </div>
    </>
  )
}
