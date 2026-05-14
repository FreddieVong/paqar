import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

const CITIES: Record<string, {
  name:        string
  state:       string
  description: string
  tips:        string[]
  faqs:        { q: string; a: string }[]
}> = {
  'kuala-lumpur': {
    name:        'Kuala Lumpur',
    state:       'Wilayah Persekutuan',
    description: 'Pasaran kereta terpakai di Kuala Lumpur adalah antara yang paling aktif di Malaysia. Dengan trafik tinggi dan penggunaan harian, risiko saman kenderaan adalah lebih tinggi — semak sebelum beli.',
    tips: [
      'Kereta KL sering terdedah kepada saman AES di lebuh raya dan jalan persekutuan',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Minta penjual tunjukkan screenshot bukti tiada saman sebelum bayar deposit',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta KL secara online?', a: 'Ya, saman PDRM boleh disemak di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-duanya memerlukan log masuk IC pemilik kenderaan.' },
      { q: 'Berapa banyak saman biasanya untuk kereta KL?', a: 'Tiada data rasmi, tapi kereta yang selalu bergerak di kawasan bandar lebih terdedah kepada saman AES, saman parking, dan saman trafik PDRM.' },
      { q: 'Apa perlu buat kalau kereta yang nak dibeli ada saman di KL?', a: 'Minta penjual selesaikan semua saman dahulu sebelum proses tukar milik, atau tolak jumlah saman dari harga jual. Saman yang belum selesai boleh menghalang proses tukar milik.' },
    ],
  },
  'selangor': {
    name:        'Selangor',
    state:       'Selangor',
    description: 'Selangor adalah negeri paling padat penduduk di Malaysia dan mempunyai pasaran kereta terpakai yang sangat aktif. Dari Shah Alam hingga Subang Jaya, Klang hingga Petaling Jaya — semak saman sebelum beli.',
    tips: [
      'Kereta di Selangor terdedah kepada saman PDRM, JPJ, dan majlis perbandaran (MBPJ, MBSA, MPKlang)',
      'Saman majlis perbandaran Selangor boleh menjadi tanggungan pembeli jika tidak diselesaikan',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Selangor secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Saman majlis perbandaran perlu disemak di portal masing-masing (MBPJ, MBSA, MPKlang).' },
      { q: 'Adakah saman majlis perbandaran Selangor perlu diselesaikan sebelum tukar milik?', a: 'Saman majlis perbandaran tidak menghalang tukar milik JPJ secara langsung, tetapi ia adalah tanggungan yang boleh dikenakan kepada pemilik baru. Elak dengan minta penjual selesaikan dahulu.' },
      { q: 'Di mana nak beli kereta terpakai yang selamat di Selangor?', a: 'Semak saman kenderaan dahulu tanpa mengira dari mana anda beli. Semua penjual — dealer atau individu — kena tunjukkan bukti tiada saman sebelum anda commit.' },
    ],
  },
  'johor': {
    name:        'Johor Bahru',
    state:       'Johor',
    description: 'Johor Bahru adalah hab ekonomi selatan Malaysia dengan pasaran kereta terpakai yang berkembang pesat. Kedekatan dengan Singapura bermakna ramai pembeli dari kedua-dua belah — semak saman sebelum membuat keputusan.',
    tips: [
      'Kereta Johor sering digunakan untuk lintas sempadan — periksa rekod servis dengan teliti',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Pastikan geran atas nama penjual, bukan nama syarikat atau orang lain',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Johor secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk IC pemilik.' },
      { q: 'Ada risiko khas beli kereta terpakai di Johor Bahru?', a: 'Kereta yang selalu digunakan untuk lintas sempadan mungkin mempunyai jarak tempuh sebenar lebih tinggi dari yang ditunjukkan. Bawa ke bengkel untuk inspection sebelum commit.' },
      { q: 'Macam mana nak elak tertipu beli kereta terpakai di JB?', a: 'Semak saman, pastikan nama geran betul, bawa ke bengkel untuk inspection, dan jangan bayar deposit sebelum semua dokumen disahkan.' },
    ],
  },
  'penang': {
    name:        'Pulau Pinang',
    state:       'Pulau Pinang',
    description: 'Pulau Pinang mempunyai trafik yang padat dan kadar saman yang tinggi terutama di kawasan bandar Georgetown. Semak saman kenderaan terpakai sebelum beli untuk elak tanggungan yang tidak dijangka.',
    tips: [
      'Kawasan bandar Georgetown dan Bayan Lepas mempunyai kadar saman parking yang tinggi',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Kereta pulau mungkin terdedah kepada karat lebih awal kerana udara laut',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Pulau Pinang secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk IC pemilik.' },
      { q: 'Ada risiko khas beli kereta terpakai di Pulau Pinang?', a: 'Persekitaran pesisir pantai boleh mempercepatkan kakisan. Semasa inspection, periksa bahagian bawah kenderaan untuk tanda karat lebih awal dari biasa.' },
      { q: 'Berapa lama proses tukar milik kereta di Penang?', a: 'Proses tukar milik di JPJ Pulau Pinang biasanya mengambil masa 1-3 hari bekerja jika semua dokumen lengkap dan tiada saman atau pinjaman aktif.' },
    ],
  },
  'perak': {
    name:        'Perak',
    state:       'Perak',
    description: 'Ipoh dan kawasan Perak menawarkan kereta terpakai pada harga yang lebih berpatutan berbanding KL. Namun begitu, semak saman tetap perlu dilakukan untuk memastikan pembelian yang selamat.',
    tips: [
      'Kereta Perak sering mempunyai jarak tempuh yang lebih tinggi kerana perjalanan antara bandar',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Harga kereta terpakai di Perak biasanya lebih rendah — semak nilai pasaran sebelum negotiate',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Perak secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk IC pemilik.' },
      { q: 'Kenapa harga kereta terpakai di Perak lebih murah?', a: 'Permintaan yang lebih rendah dan kos hidup yang lebih rendah menyebabkan harga pasaran kereta terpakai di Perak biasanya lebih rendah berbanding Klang Valley. Tapi semak saman dan kondisi tetap penting.' },
      { q: 'Macam mana nak beli kereta terpakai dari Perak dengan selamat?', a: 'Semak saman, pastikan geran atas nama penjual, bawa ke bengkel untuk inspection, dan minta rekod servis. Pertimbangkan kos hantar kereta ke kawasan anda jika beli dari jauh.' },
    ],
  },
  'melaka': {
    name:        'Melaka',
    state:       'Melaka',
    description: 'Melaka adalah destinasi popular untuk beli kereta terpakai dengan harga berpatutan. Dengan populasi yang sederhana dan trafik yang lebih rendah, kereta Melaka sering dalam kondisi yang baik — tapi semak saman tetap perlu.',
    tips: [
      'Kereta Melaka sering terdedah kepada trafik pelancong terutama di kawasan bandar bersejarah',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Majlis Bandaraya Melaka Bersejarah (MBMB) mungkin ada saman parking tersendiri',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Melaka secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk IC pemilik.' },
      { q: 'Adakah kereta Melaka lebih selamat untuk dibeli?', a: 'Trafik yang lebih rendah berbanding KL bermakna risiko kemalangan mungkin lebih rendah, tapi ini tidak boleh diandaikan. Semak saman, kondisi fizikal, dan rekod servis tetap perlu.' },
      { q: 'Di mana boleh inspection kereta terpakai di Melaka?', a: 'Hubungi bengkel berlesen di Melaka untuk inspection pre-purchase. Atau gunakan perkhidmatan rakan Paqar di Klang Valley jika anda merancang membawa kereta ke sana.' },
    ],
  },
  'negeri-sembilan': {
    name:        'Negeri Sembilan',
    state:       'Negeri Sembilan',
    description: 'Seremban dan kawasan Negeri Sembilan menawarkan pilihan kereta terpakai dengan harga kompetitif, terletak strategik antara KL dan Johor. Semak saman sebelum beli untuk pastikan tiada tanggungan tersembunyi.',
    tips: [
      'Kereta NS yang selalu bergerak ke KL mungkin mempunyai jarak tempuh lebih tinggi',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Periksa kondisi tayar dan brek — kereta yang selalu guna highway boleh ada lebih haus',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Negeri Sembilan secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk IC pemilik.' },
      { q: 'Apa kelebihan beli kereta terpakai di Negeri Sembilan?', a: 'Harga biasanya lebih rendah berbanding KL dan Selangor. Letaknya strategik menjadikannya mudah untuk pembeli dari KL atau Johor.' },
      { q: 'Berapa lama proses tukar milik kereta di NS?', a: 'Proses tukar milik di JPJ Negeri Sembilan biasanya 1-3 hari bekerja jika semua dokumen lengkap dan tiada isu tunggakan.' },
    ],
  },
  'kedah': {
    name:        'Kedah',
    state:       'Kedah',
    description: 'Alor Setar dan kawasan Kedah menawarkan kereta terpakai pada harga yang sangat kompetitif. Pasaran yang lebih kecil bermakna pilihan lebih terhad, tapi peluang untuk dapat harga baik lebih tinggi — semak dahulu sebelum commit.',
    tips: [
      'Kereta Kedah mungkin menggunakan lebih banyak highway utara-selatan',
      'Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my',
      'Pertimbangkan kos servis jika beli dari jauh dan bawa ke kawasan anda',
    ],
    faqs: [
      { q: 'Boleh semak saman kereta Kedah secara online?', a: 'Ya, saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my. Kedua-dua portal memerlukan log masuk IC pemilik.' },
      { q: 'Ada risiko khas beli kereta terpakai dari Kedah?', a: 'Jarak dari KL bermakna kos perjalanan untuk viewing dan inspection perlu diambil kira. Pertimbangkan untuk minta penjual hantar lebih banyak foto dan video sebelum buat lawatan.' },
      { q: 'Macam mana nak semak kereta dari Kedah tanpa pergi sendiri?', a: 'Minta penjual rekod video menyeluruh termasuk bawah kereta, dalam enjin, dan dashboard. Kalau serius, hire perkhidmatan inspection tempatan sebelum pergi.' },
    ],
  },
}

interface Props {
  params: { city: string }
}

export function generateStaticParams() {
  return Object.keys(CITIES).map(city => ({ city }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = CITIES[params.city]
  if (!city) return {}
  const titleText    = `Semak Saman Kereta ${city.name} 2025`
  const subtitleText = `Panduan pembeli terpakai ${city.state}`
  return {
    title:       `Semak Saman Kereta ${city.name} 2025 — Percuma | Paqar`,
    description: `Cara semak saman kereta di ${city.name}, ${city.state}. Semak PDRM, JPJ, dan sumber lain sebelum beli kereta terpakai. Percuma, tanpa daftar akaun.`,
    openGraph: {
      images: [{
        url:    `/api/og?title=${encodeURIComponent(titleText)}&subtitle=${encodeURIComponent(subtitleText)}`,
        width:  1200,
        height: 630,
      }],
    },
  }
}

export default function CityPage({ params }: Props) {
  const city = CITIES[params.city]
  if (!city) notFound()

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Panduan', item: 'https://paqar.my/panduan' },
          { '@type': 'ListItem', position: 3, name: `Semak Saman Kereta ${city.name}`, item: `https://paqar.my/semak-saman-kereta/${params.city}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: city.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
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

          {/* Hero */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              {city.state}
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Semak saman kereta di {city.name}
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              {city.description}
            </p>
          </div>

          {/* Check form */}
          <DualCheckForm />

          {/* Tips */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">
              Panduan semak saman kereta di {city.name}
            </h2>
            <ul className="space-y-2.5">
              {city.tips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 font-body text-[13px] text-[#374151] leading-relaxed">
                  <span className="text-[#064E4A] font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">
              Soalan lazim
            </h2>
            {city.faqs.map((faq) => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{faq.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>

          {/* Related guides */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[12px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Panduan berkaitan
            </p>
            <div className="space-y-2">
              {[
                { href: '/panduan-semak-saman',           label: 'Cara semak saman PDRM & JPJ langkah demi langkah' },
                { href: '/cara-beli-kereta-terpakai',     label: 'Panduan lengkap beli kereta terpakai Malaysia' },
                { href: '/risiko-beli-kereta-terpakai',   label: '7 risiko tersembunyi & cara elak' },
                { href: '/checklist-beli-kereta-terpakai',label: 'Checklist sebelum bayar deposit' },
              ].map(g => (
                <Link key={g.href} href={g.href}
                  className="flex items-center gap-2 font-body text-[13px] text-[#064E4A] hover:underline">
                  <span className="text-[#9CA3AF]">→</span>{g.label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </Shell>
    </>
  )
}
