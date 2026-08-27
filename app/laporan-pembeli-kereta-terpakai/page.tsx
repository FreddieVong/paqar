import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { BASE_REPORT_CENTS, BASE_REPORT_LABEL, ringgit, REVIEW_SLA_HOURS, REFUND_GUARANTEE_LONG } from '@/lib/pricing'
import { TYPICAL_MINUTES } from '@/lib/review-capacity'
import { ListingIntakeForm }   from '@/components/check/ListingIntakeForm'
import { organizationRef } from '@/lib/site'
import { articleDates } from '@/lib/seo/editorial-dates'

export const metadata: Metadata = {
  title: `Laporan Pembeli Kereta Terpakai Malaysia ${BASE_REPORT_LABEL} | Paqar`,
  description: `Hantar link iklan kereta itu. Orang kami baca dan beritahu sama ada patut diteruskan, berapa patut ditawar, dan apa perlu disahkan — ${BASE_REPORT_LABEL}.`,
  alternates: { canonical: 'https://paqar.my/laporan-pembeli-kereta-terpakai' },
  openGraph: {
    locale: 'ms_MY',
    title: `Laporan Pembeli Kereta Terpakai Malaysia ${BASE_REPORT_LABEL}`,
    description: `Hantar link iklan kereta itu. Orang kami baca dan beritahu sama ada patut diteruskan, berapa patut ditawar, dan apa perlu disahkan — ${BASE_REPORT_LABEL}.`,
    url: 'https://paqar.my/laporan-pembeli-kereta-terpakai',
    images: [{ url: `/api/og?title=Laporan%20Pembeli%20Kereta%20Terpakai&subtitle=${encodeURIComponent(`${BASE_REPORT_LABEL} · Disemak oleh manusia · Tanpa akaun`)}`, width: 1200, height: 630 }],
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
        author: organizationRef(),
        publisher: organizationRef(),
        ...articleDates('/laporan-pembeli-kereta-terpakai', '2026-06-23'),
        url: 'https://paqar.my/laporan-pembeli-kereta-terpakai',
      },
      {
        '@type': 'Service',
        name: 'Laporan Pembeli Kereta Terpakai',
        description: 'Laporan Pembeli RM29 merangkumi keputusan harga pasaran, harga tengah dan julat harga, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit.',
        provider: organizationRef(),
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

          {/* ── HERO ──
              This page was the last surface still selling the automated tool.
              "Alat Pembeli Kereta Terpakai" is what Paqar was before the
              review gate: something you operate. It is now something a person
              does for you, and the two claims that carry the product —
              disemak oleh manusia, and the refund — appeared nowhere on the
              page whose whole job is to explain what RM29 buys. */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#3D472F] mb-2">
              Disemak oleh manusia &middot; Dalam {REVIEW_SLA_HOURS} jam
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Hantar satu iklan. Kami beritahu apa patut anda buat.
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Laporan Pembeli {BASE_REPORT_LABEL} adalah keputusan tentang satu kereta
              tertentu yang anda sedang pertimbang — bukan carian yang anda buat sendiri.
              Anda hantar link iklannya; orang kami baca, banding dengan iklan setanding,
              dan hantar keputusan. Biasanya dalam {TYPICAL_MINUTES} minit, dijamin dalam{' '}
              {REVIEW_SLA_HOURS} jam.
            </p>
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mt-3 bg-[#F4F6F0] border border-[#CBD4BB] rounded-[12px] p-3">
              {REFUND_GUARANTEE_LONG}
            </p>
          </div>

          {/* What's included */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="bg-[#3D472F] px-5 py-4">
              <p className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45 mb-1">
                Laporan Pembeli — RM29
              </p>
              <p className="font-heading font-extrabold text-[15px] text-white">
                Satu laporan. Apa patut anda buat dengan kereta ini.
              </p>
            </div>
            <div className="px-5 py-1">
              {[
                {
                  title: 'Keputusan: teruskan, atau cari unit lain',
                  desc: 'Keputusan jelas untuk kereta ini, ditulis oleh orang yang membacanya — bukan hanya satu label harga.',
                },
                {
                  title: 'Berapa patut anda tawar',
                  desc: 'Sasaran harga untuk mula rundingan, dikira dari harga tengah iklan setanding.',
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
                  // Conditional, and said so. The plate is OPTIONAL at intake
                  // and the lookup runs after payment, so this section exists
                  // only when a registration number was given and resolved.
                  // Promising it unconditionally on the page that explains
                  // what RM29 buys is the one claim this product can least
                  // afford to get wrong.
                  title: 'Maklumat pendaftaran kenderaan — jika anda beri nombor plat',
                  desc: 'Tahun daftar, kapasiti enjin, jenis badan dan nombor rangka, dibandingkan dengan apa yang penjual iklankan.',
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
