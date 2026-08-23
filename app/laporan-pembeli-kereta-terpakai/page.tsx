import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { BASE_REPORT_CENTS, ringgit } from '@/lib/pricing'
import { ListingIntakeForm }   from '@/components/check/ListingIntakeForm'

export const metadata: Metadata = {
  title: 'Laporan Pembeli Kereta Terpakai Malaysia RM29 | Paqar',
  description: 'Laporan Pembeli Paqar RM29 — keputusan harga pasaran, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit. Satu bayaran, tanpa akaun.',
  alternates: { canonical: 'https://paqar.my/laporan-pembeli-kereta-terpakai' },
  openGraph: {
    locale: 'ms_MY',
    title: 'Laporan Pembeli Kereta Terpakai Malaysia RM29',
    description: 'Laporan Pembeli Paqar RM29 — keputusan harga pasaran, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit. Satu bayaran, tanpa akaun.',
    url: 'https://paqar.my/laporan-pembeli-kereta-terpakai',
    images: [{ url: '/api/og?title=Laporan%20Pembeli%20Kereta%20Terpakai&subtitle=RM29%20%C2%B7%20Satu%20bayaran%20%C2%B7%20Tanpa%20akaun', width: 1200, height: 630 }],
  },
}

export default function LaporanPembelihPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Laporan Pembeli Kereta Terpakai', item: 'https://paqar.my/laporan-pembeli-kereta-terpakai' },
        ],
      },
      {
        '@type': 'Article',
        headline: 'Laporan Pembeli Kereta Terpakai Malaysia RM29',
        description: 'Apa yang ada dalam Laporan Pembeli Paqar RM29 — keputusan harga, trade-in estimate, maklumat kenderaan, skrip rundingan dan checklist deposit.',
        author: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        publisher: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        datePublished: '2026-06-23',
        url: 'https://paqar.my/laporan-pembeli-kereta-terpakai',
      },
      {
        '@type': 'Service',
        name: 'Laporan Pembeli Kereta Terpakai',
        description: 'Laporan Pembeli RM29 merangkumi keputusan harga pasaran, harga tengah dan julat harga, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit.',
        provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        areaServed: { '@type': 'Country', name: 'Malaysia' },
        offers: { '@type': 'Offer', price: String(ringgit(BASE_REPORT_CENTS)), priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa yang ada dalam Laporan Pembeli RM29 Paqar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli RM29 merangkumi: keputusan untuk unit itu — patut diteruskan, dirunding atau dilepaskan — nota daripada orang yang menyemak iklan anda, sasaran harga dan skrip rundingan siap pakai, soalan penting untuk penjual, checklist sebelum bayar deposit, dan harga yang sedang diiklankan untuk kereta setanding sebagai bukti di sebaliknya. Setiap laporan disemak oleh manusia sebelum dihantar.' },
          },
          {
            '@type': 'Question',
            name: 'Berapa lama untuk dapat laporan selepas bayar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Setiap laporan disemak oleh manusia sebelum dihantar. Biasanya dalam 30 minit pada waktu semakan (10 pagi hingga 12 malam), dan dijamin dalam 24 jam. Kalau kami tidak dapat siapkan, duit dikembalikan sepenuhnya.' },
          },
          {
            '@type': 'Question',
            name: 'Adakah laporan sah untuk mana-mana kereta terpakai?',
            acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli boleh dijana untuk kereta terpakai Malaysia. Kualiti data harga bergantung kepada bilangan listing serupa di pasaran untuk model dan tahun berkenaan.' },
          },
        ],
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
              Alat Pembeli Kereta Terpakai
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Laporan Pembeli kereta terpakai — RM29
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Paqar membantu pembeli kereta terpakai Malaysia masuk rundingan dengan data — bukan agak-agak. Laporan Pembeli RM29 memberi anda semua yang perlu tahu sebelum bayar deposit.
            </p>
          </div>

          {/* What's included */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="bg-[#3D472F] px-5 py-4">
              <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45 mb-1">
                Laporan Pembeli — RM29
              </p>
              <p className="font-heading font-extrabold text-[15px] text-white">
                Satu laporan. Semua yang perlu anda tahu.
              </p>
            </div>
            <div className="px-5 py-1">
              {[
                {
                  title: 'Keputusan harga',
                  desc: 'Murah, wajar, atau mahal — berdasarkan listing semasa untuk model dan tahun yang sama.',
                },
                {
                  title: 'Harga tengah & julat iklan setanding',
                  desc: 'Tahu harga tengah dan julat harga — bukan sekadar "harga dalam RM30k-50k".',
                },
                {
                  title: 'Anggaran trade-in',
                  desc: 'Anggaran harga dealer akan bayar untuk kereta ini. Guna sebagai sebahagian rundingan.',
                },
                {
                  title: 'Maklumat kenderaan',
                  desc: 'Tahun daftar, kapasiti enjin, jenis badan dan nombor rangka.',
                },
                {
                  title: 'Skrip rundingan harga',
                  desc: 'Skrip siap pakai berdasarkan data pasaran — untuk tanya harga dengan yakin.',
                },
                {
                  title: 'Soalan penting untuk penjual',
                  desc: 'Soalan yang boleh dedahkan risiko tersembunyi sebelum anda commit.',
                },
                {
                  title: 'Checklist sebelum bayar deposit',
                  desc: 'Senarai semak lengkap — dari geran hingga nombor casis.',
                },
              ].map((item, i, arr) => (
                <div key={item.title} className={`flex gap-2.5 items-start py-2.5 ${i < arr.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                  <span className="w-[17px] h-[17px] rounded-full bg-[#3D472F] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div>
                    <p className="font-heading font-bold text-[12px] text-[#111827] leading-snug">{item.title}</p>
                    <p className="font-body text-[11px] text-[#9CA3AF] leading-snug mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-[#F8FAF7] border-t border-[#F3F4F6]">
              <p className="font-body text-[11px] text-[#6B7280]">
                Satu bayaran sahaja · Tanpa daftar akaun ·{' '}
                <Link href="/contoh-laporan" className="text-[#3D472F] font-semibold hover:underline">
                  Lihat contoh laporan →
                </Link>
              </p>
            </div>
          </div>

          {/* THE ACCIDENT/CLAIM UPSELL IS GONE, not hidden.
              It advertised "+RM88 … Laporan + Semakan RM100" for a service
              that does not exist: HISTORY_UPGRADE_OPERATIONAL is false in
              lib/pricing precisely because the purchase -> second review ->
              revised decision -> release journey was never built. Hiding the
              button while leaving this copy crawlable would still be selling
              it — to buyers, to Google and to every AI that reads the page.

              The same paragraph also promised "amaran kalau meter mungkin
              pernah dipusing balik". Paqar has no independent dated odometer
              reading, so it can never support a tampering finding — a rule
              lib/mileage-provenance enforces in the report and this page
              contradicted in marketing. */}

          {/* Limitations */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#B45309] mb-2">Yang perlu anda tahu</p>
            <ul className="space-y-2">
              {[
                'Paqar adalah perkhidmatan pihak ketiga — bukan platform rasmi JPJ atau PDRM.',
                'Paqar tidak mengesahkan bacaan odometer sebenar.',
                'Harga pasaran adalah anggaran berdasarkan listing semasa — bukan harga tetap.',
                'Anda tetap perlu buat inspection fizikal dan tanya penjual soalan yang tepat.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#B45309] flex-shrink-0">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Check form */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Semak harga kereta yang anda minat:
            </p>
            <ListingIntakeForm />
          </div>

          {/* Related links */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/contoh-laporan" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Lihat contoh laporan →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Checklist lengkap sebelum bayar deposit →</Link>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Panduan cara beli kereta terpakai →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
