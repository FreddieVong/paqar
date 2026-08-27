import type { Metadata } from 'next'
import { historyAddOnLimitLine, competitorComparisonAnswer } from '@/lib/history-addon-copy'

import Link           from 'next/link'
import { unstable_cache } from 'next/cache'
import { Nav }           from '@/components/layout/Nav'
import { ListingIntakeForm } from '@/components/check/ListingIntakeForm'
import { ServiceShortcuts } from '@/components/home/ServiceShortcuts'
import { SocialLinks }    from '@/components/layout/SocialLinks'
import { getCheckCount } from '@/lib/db/checks'
import { organizationSchema, whatsappUrl } from '@/lib/site'
import { BASE_REPORT_LABEL, BASE_REPORT_CENTS, ringgit, REVIEW_SLA_HOURS, REFUND_WORKING_DAYS } from '@/lib/pricing'
import { TYPICAL_MINUTES, REVIEW_OPENS_HOUR } from '@/lib/review-capacity'

// Title, description and the social image are inherited from the root layout,
// which describes the homepage anyway. og:url is declared HERE because the root
// no longer sets one: a url in the layout became og:url on every page that
// declared no openGraph of its own, and all seven FAQ guides were shipping
// the homepage's URL as their own. The homepage is the one page for which
// https://paqar.my is genuinely correct, so it says so itself.
export const metadata: Metadata = {
  alternates: { canonical: 'https://paqar.my' },
  // Restated in full, not partially. A child `openGraph` REPLACES the root's
  // rather than merging into it, so declaring only `url` here erased the
  // locale and the image — scripts/seo-check.mjs caught exactly that. Title
  // and description still resolve from `metadata.title`/`description`, which
  // the root supplies and which genuinely describe this page.
  openGraph: {
    url: 'https://paqar.my',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

// ISR: without this the page is fully static and the social-proof check count
// freezes at build time. Hourly revalidation keeps it fresh, still CDN-served.
export const revalidate = 3600

// Social-proof count only needs to be roughly fresh — cache for an hour
// instead of hitting the DB on every homepage view.
const getCachedCheckCount = unstable_cache(getCheckCount, ['home-check-count'], { revalidate: 3600 })

const homeSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Paqar',
      url: 'https://paqar.my',
    },
    // sameAs is what tells Google the site, the three social profiles and the
    // Google Business Profile are one entity. The ContactPoint that used to
    // sit here published hello@paqar.my — an address with no MX record — so
    // it is now emitted only when a channel actually works.
    organizationSchema(),
    {
      '@type': 'Service',
      name: 'Semakan Pembeli Paqar',
      description: 'Hantar iklan kereta terpakai yang anda nak beli. Paqar beritahu sama ada patut diteruskan, berapa patut anda tawar, dan apa yang perlu ditanya penjual. Setiap laporan dibaca oleh orang kami — biasanya dalam 30 minit.',
      provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
      areaServed: { '@type': 'Country', name: 'Malaysia' },
      offers: { '@type': 'Offer', price: String(ringgit(BASE_REPORT_CENTS)), priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Kenapa tak semak sendiri di Mudah atau Carlist?',
          acceptedAnswer: { '@type': 'Answer', text: 'Portal iklan tunjuk kereta yang ada untuk dijual dan harga yang penjual minta. Paqar guna maklumat itu untuk cadangkan langkah seterusnya untuk satu unit tertentu — patut teruskan atau tidak, berapa patut ditawarkan, apa yang perlu disahkan dengan penjual, dan bila lebih baik cari unit lain.' },
        },
        {
          '@type': 'Question',
          name: 'Apa yang saya dapat untuk RM29?',
          acceptedAnswer: { '@type': 'Answer', text: 'Keputusan untuk satu kereta: sama ada patut diteruskan, skrip rundingan siap pakai, soalan penting untuk penjual, semakan varian yang diiklankan supaya harga dibanding dengan varian yang sama, dan checklist sebelum bayar deposit. Setiap laporan dibaca dan disemak oleh manusia sebelum dihantar.' },
        },
        {
          '@type': 'Question',
          name: 'Berapa lama untuk dapat laporan?',
          acceptedAnswer: { '@type': 'Answer', text: 'Dalam tempoh 24 jam. Laporan tidak dijana automatik — seorang manusia baca iklan yang anda hantar dan semak keputusan sebelum ia dilepaskan kepada anda.' },
        },
        {
          '@type': 'Question',
          name: 'Adakah Paqar sama seperti laporan SCRUT atau MyEG?',
          acceptedAnswer: { '@type': 'Answer', text: competitorComparisonAnswer(BASE_REPORT_LABEL) },
        },
        {
          '@type': 'Question',
          name: 'Bagaimana jika Paqar tidak dapat siapkan laporan saya?',
          acceptedAnswer: { '@type': 'Answer', text: 'Duit anda dikembalikan sepenuhnya. Kalau kami tidak jumpa cukup iklan setanding untuk kereta itu, kami tidak jual keputusan yang tidak dapat kami sokong.' },
        },
        {
          '@type': 'Question',
          name: 'Adakah saya perlu daftar akaun?',
          acceptedAnswer: { '@type': 'Answer', text: 'Tidak. Tiada akaun diperlukan.' },
        },
        {
          '@type': 'Question',
          name: 'Adakah Paqar dari JPJ atau PDRM?',
          acceptedAnswer: { '@type': 'Answer', text: 'Paqar adalah perkhidmatan pihak ketiga — bukan afiliasi JPJ atau PDRM.' },
        },
        {
          '@type': 'Question',
          name: 'Apakah had atau limitasi Paqar?',
          acceptedAnswer: { '@type': 'Answer', text: `Harga iklan adalah harga yang diminta, bukan harga jualan sebenar. Mileage dan keadaan fizikal boleh mengubah nilai dengan ketara. ${historyAddOnLimitLine()} Pemeriksaan fizikal masih perlu sebelum bayar deposit.` },
        },
      ],
    },
  ],
}

export default async function HomePage() {
  // Social proof only helps once the number is genuinely impressive — "100+"
  // reads as a small/new site (and includes our own test checks). Hidden
  // until 1,000, then rounded down to the nearest hundred.
  const checkCount = await getCachedCheckCount().catch(() => 0)
  const countDisplay = checkCount >= 1000
    ? `${(Math.floor(checkCount / 100) * 100).toLocaleString()}+`
    : null

  const contactHref = whatsappUrl('Hai Paqar, saya perlukan bantuan.')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeSchema) }} />
      <Nav />

      {/* The skip-link target. The homepage does not use Shell — it lays out
          its own full-bleed sections — so it needs its own anchor, or "Terus
          ke kandungan" lands nowhere on the one page most people arrive at.
          Zero-height: it marks the point after the nav, nothing more. */}
      <div id="main-content" tabIndex={-1} className="outline-none" />

      {/* ── HERO ──
          ONE JOB: the buyer has already found a car. Everything here serves
          the decision about THAT car, which is the ground no competitor
          occupies — SCRUT, METACAR and Otofacts all sell records. */}
      <section id="semak" className="bg-white px-5 pt-10 pb-12 md:pt-14 md:pb-16 overflow-x-hidden">
        <div className="max-w-xl mx-auto">

          <div className="mb-5">
            {/* THE EYEBROW IS GONE.
                It read "Untuk pembeli · Disemak oleh manusia" — and four lines
                below it, the meta line says "Disemak oleh manusia" again. Two
                claims, one fact, on the page a tester had already called full
                of text.
                Removing it also lets the headline land first, which is the
                stronger opening: the pill was a label on the page, and the
                headline is the reason to stay. */}
          </div>

          <h1 className="font-heading font-extrabold text-[30px] md:text-[36px] leading-[1.1] tracking-[-0.03em] text-[#111827] mb-3">
            {/* THE RESULT, NOT THE PROCESS.
                It read "Dah jumpa kereta? / Semak dulu." — and checking is
                what PAQAR does, not what the buyer wants. Nobody wakes up
                wanting to check a car; they want to not get it wrong.
                "Tersalah beli" carries both halves of that fear in two words,
                the money and the lemon, which a price-only line would not. */}
            <span className="block text-balance">Semak dulu,</span>
            <span className="block text-[#3D472F]">jangan tersalah beli kereta.</span>
          </h1>

          {/* ONE PLAN, ONE OUTCOME.
              This listed three deliverables joined by commas — a feature list,
              which is strategy. And "Paqar beritahu" made Paqar the hero of a
              story the buyer is in. What they are buying is not three
              artefacts: it is knowing what to do about one car. */}
          <p className="font-body text-[15px] text-[#374151] mb-2 leading-relaxed text-balance">
            Hantar iklan kereta itu. Biasanya dalam {TYPICAL_MINUTES} minit kami
            beritahu apa patut anda buat.
          </p>

          {/* "Disemak oleh manusia" moves up here from the body copy. It is the
              part no assistant and no portal can match, so it belongs beside
              the price rather than buried in a paragraph. */}
          <p className="font-body text-[13px] text-[#6B7280] mb-1.5 leading-relaxed text-balance">
            {BASE_REPORT_LABEL} · Disemak oleh manusia · Tanpa daftar akaun
          </p>

          {/* The hours, stated plainly. Thirty minutes is the truth during the
              day and a lie at 3am, and a buyer who sends one at 3am and hears
              nothing for seven hours has been misled by an average. */}
          <p className="font-body text-[12px] text-[#6B7280] mb-7 leading-relaxed text-balance">
            Semakan manusia {REVIEW_OPENS_HOUR} pagi &ndash; 12 malam · dijamin dalam {REVIEW_SLA_HOURS} jam
          </p>

          <ListingIntakeForm />

          {countDisplay && (
            <p className="font-body text-[11px] text-[#9CA3AF] text-center mt-4">
              {countDisplay} semakan dibuat
            </p>
          )}
        </div>
      </section>

      {/* ── DIBINA UNTUK PEMBELI ── */}
      <section className="bg-white px-5 pb-10 border-b border-[#F3F4F6]">
        {/* ONE LINE, NOT THREE COLUMNS.
            A three-column grid at 390px broke every claim across two or three
            lines — "Bukan ganti / pemeriksaan / fizikal" — so the row read as
            ragged fragments rather than three plain statements. Wrapping as a
            flow with separators lets each claim break only where it must. */}
        <div className="max-w-xl mx-auto flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
          {[
            'Tidak menjual kereta',
            'Tidak dibayar oleh penjual',
            'Bukan ganti pemeriksaan fizikal',
          ].map((claim, i) => (
            // Separator AFTER each claim rather than before the next one: a
            // wrapped line that BEGINS with a stray dot reads as a bullet
            // point that lost its list.
            <span key={claim} className="flex items-center gap-2.5">
              <span className="font-body text-[12px] text-[#6B7280] leading-snug">{claim}</span>
              {i < 2 && <span aria-hidden="true" className="text-[#CBD4BB]">·</span>}
            </span>
          ))}
        </div>
      </section>

      {/* ── SATU TEMPAT SEBELUM BELI KERETA ──
          The three shortcuts, and the sequence they belong to.

          Placed AFTER the hero, never beside it: the RM29 intake is this page's
          single job, and a row of equally-weighted options next to it would
          turn one decision into three. Here they answer the question a buyer
          has once they have seen the form — "what else does this place do?" —
          rather than competing with it. */}
      <section className="bg-white px-5 py-12 md:py-16 border-t border-[#F3F4F6]">
        <div className="max-w-5xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
            Satu tempat sebelum beli kereta
          </p>
          <h2 className="font-heading font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#111827] mb-3">
            Semak &rarr; Periksa &rarr; Insurans
          </h2>
          <p className="font-body text-[14px] text-[#374151] leading-relaxed mb-6 max-w-2xl">
            Tiga langkah, ikut urutan. Semak dulu sama ada unit itu berbaloi
            dikejar &mdash; lebih murah daripada memeriksa kereta yang anda
            takkan beli. Bila dah pasti, periksa fizikalnya. Bila dah putus,
            baru bandingkan insurans.
          </p>

          <ServiceShortcuts />
        </div>
      </section>

      {/* ── APA YANG ANDA DAPAT ──
          The human review LEADS. Everything under it is machine output a
          competitor could reproduce; the review is what the price buys, and
          the RM12 product's mistake was headlining the commodity half. */}
      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
            Apa yang anda dapat
          </p>
          <h2 className="font-heading font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#111827] mb-6">
            Satu kereta. Satu keputusan.
          </h2>

          <div className="bg-[#3D472F] rounded-[14px] px-5 py-5 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] flex-shrink-0" />
              <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45">
                Yang paling penting
              </span>
            </div>
            <p className="font-heading font-extrabold text-[15px] leading-snug text-white mb-1.5">
              Disemak oleh manusia sebelum dihantar.
            </p>
            <p className="font-body text-[12px] text-white/60 leading-relaxed">
              Bukan laporan auto. Seorang manusia baca iklan yang anda hantar,
              sahkan varian dan tahun kereta itu, dan pastikan apa yang Paqar
              cadangkan betul untuk unit tersebut. Sampai dalam {REVIEW_SLA_HOURS} jam.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-1">
            {[
              { title: 'Patut teruskan atau tidak',   desc: 'Keputusan jelas untuk unit ini, bukan data mentah.' },
              { title: 'Skrip rundingan harga',       desc: 'Ayat siap pakai berdasarkan iklan setanding.' },
              { title: 'Soalan penting untuk penjual', desc: 'Soalan yang boleh dedahkan risiko awal-awal.' },
              { title: 'Varian disemak',              desc: 'Harga dibanding varian yang sama, bukan campuran.' },
              { title: 'Checklist sebelum deposit',   desc: 'Apa yang perlu disahkan sebelum anda bayar.' },
            ].map((item, i, arr) => (
              <div key={item.title} className={`flex gap-2.5 items-start py-3 ${i < arr.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                <span className="w-[17px] h-[17px] rounded-full bg-[#3D472F] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <div>
                  <p className="font-heading font-bold text-[13px] text-[#111827] leading-snug">{item.title}</p>
                  <p className="font-body text-[12px] text-[#6B7280] leading-snug mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-right">
            <Link
              href="/contoh-laporan"
              className="font-body text-[12px] text-[#3D472F] font-semibold hover:underline underline-offset-2"
            >
              Lihat contoh laporan →
            </Link>
          </div>
        </div>
      </section>

      {/* ── KENAPA TAK SEMAK SENDIRI ──
          The viral objection, answered head-on and without naming or attacking
          anyone. Paqar operates AFTER discovery and ABOVE raw records. */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
            Soalan yang berbaloi ditanya
          </p>
          <h2 className="font-heading font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#111827] mb-3">
            Kenapa tak semak sendiri?
          </h2>
          <p className="font-body text-[14px] text-[#374151] leading-relaxed mb-6">
            Anda memang boleh. Portal iklan tunjuk apa yang ada untuk dijual.
            Laporan sejarah tunjuk apa yang pernah direkodkan. Kedua-duanya beri
            anda maklumat&mdash;tetapi bukan keputusan.
          </p>

          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Portal iklan',    desc: 'Tunjuk kereta yang ada dan harga yang penjual minta.' },
              { label: 'Laporan sejarah', desc: 'Tunjuk tuntutan atau rekod lain, jika ada.' },
              { label: 'Paqar',           desc: 'Gabungkan semua itu untuk cadangkan langkah seterusnya bagi satu unit tertentu.', highlight: true },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-[12px] px-4 py-3.5 border ${
                  item.highlight
                    ? 'bg-[#F4F6F0] border-[#CBD4BB]'
                    : 'bg-white border-[#E5E7EB]'
                }`}
              >
                <p className={`font-heading font-bold text-[13px] mb-0.5 ${item.highlight ? 'text-[#3D472F]' : 'text-[#111827]'}`}>
                  {item.label}
                </p>
                <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HAD & JAMINAN ──
          Replaces the fear-led black section. Limits stated plainly build more
          trust than warnings do, and this product is sold on trust. */}
      <section className="bg-[#3D472F] px-5 py-12 md:py-14">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-white/40 mb-3">
            Had &amp; jaminan
          </p>
          <h2 className="font-heading font-extrabold text-[24px] md:text-[28px] leading-tight tracking-tight text-white mb-5">
            Paqar akan beritahu bila<br />
            <span className="text-[#FACC15]">bukti tidak cukup.</span>
          </h2>

          <div className="flex flex-col gap-3.5 mb-6">
            {[
              'Harga iklan adalah harga yang diminta, bukan harga jualan sebenar.',
              'Model, varian dan tahun perlu disahkan sebelum harga bermakna.',
              'Mileage dan keadaan fizikal boleh mengubah nilai dengan ketara.',
              historyAddOnLimitLine(),
              'Pemeriksaan fizikal masih perlu sebelum anda bayar deposit.',
            ].map((limit) => (
              <div key={limit} className="flex gap-3 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] flex-shrink-0 mt-[7px]" />
                <p className="font-body text-[13px] text-white/70 leading-relaxed">{limit}</p>
              </div>
            ))}
          </div>

          <div className="border border-white/15 rounded-[12px] px-4 py-3.5">
            <p className="font-heading font-bold text-[13px] text-white mb-1">
              Tidak dapat siapkan? Duit dikembalikan.
            </p>
            <p className="font-body text-[12px] text-white/60 leading-relaxed">
              Kalau kami tidak jumpa cukup iklan setanding untuk kereta anda,
              kami tidak jual keputusan yang tidak dapat kami sokong. Kalau kami
              dah ambil bayaran dan tetap tidak dapat siapkan, duit dipulangkan
              penuh dalam {REFUND_WORKING_DAYS} hari bekerja &mdash; diproses
              oleh manusia, bukan automatik.
            </p>
          </div>
        </div>
      </section>

      {/* ── SOALAN LAZIM ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
            Soalan Lazim
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-6">
            Ada soalan?
          </h2>

          <div className="flex flex-col gap-2">
            {[
              {
                q: 'Kenapa tak semak sendiri di Mudah atau Carlist?',
                a: 'Portal iklan tunjuk kereta yang ada untuk dijual dan harga yang penjual minta. Paqar guna maklumat itu untuk cadangkan langkah seterusnya untuk satu unit tertentu — patut teruskan atau tidak, berapa patut ditawarkan, apa yang perlu disahkan dengan penjual, dan bila lebih baik cari unit lain.',
              },
              {
                q: 'Adakah Paqar sama seperti laporan SCRUT atau MyEG?',
                a: competitorComparisonAnswer(BASE_REPORT_LABEL),
              },
              {
                q: 'Berapa lama untuk dapat laporan?',
                a: 'Dalam tempoh 24 jam. Laporan tidak dijana automatik — seorang manusia baca iklan yang anda hantar dan semak keputusan sebelum ia dilepaskan kepada anda.',
              },
              {
                q: 'Bagaimana jika Paqar tidak dapat siapkan laporan saya?',
                a: 'Duit anda dikembalikan sepenuhnya. Kalau kami tidak jumpa cukup iklan setanding untuk kereta itu, kami tidak jual keputusan yang tidak dapat kami sokong.',
              },
              {
                q: 'Adakah saya perlu daftar akaun?',
                a: 'Tidak. Tiada akaun diperlukan.',
              },
              {
                q: 'Adakah Paqar dari JPJ atau PDRM?',
                a: 'Paqar adalah perkhidmatan pihak ketiga — bukan afiliasi JPJ atau PDRM.',
              },
            ].map((faq) => (
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
        </div>
      </section>

      {/* ── POPULAR COMPARISONS ──
          Placed below the FAQ, after the conversion flow, so it does not
          compete with the 5-second decision the hero is built for.

          Search Console shows these are the pages that actually rank —
          /varian/* and /bandingkan/* sit at positions 8.8–12.9 while every
          year-page and brand hub sits at 27–55. They were also getting no
          link equity from here: the homepage previously linked only to hubs,
          never to an individual variant or comparison page. These are the
          site's near-page-1 pages, and this is its strongest page.

          They earn their place on merit too — "beza honda city e dan v",
          "saga vs bezza" and "honda city e vs v" are real queries in the
          data, so this answers something buyers are already asking. */}
      <section className="bg-white px-5 py-12 md:py-16 border-t border-[#F3F4F6]">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
            Panduan Pilihan
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-2">
            Tak pasti varian mana?
          </h2>
          <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-6">
            Beza antara varian selalunya beribu ringgit. Baca dulu sebelum tawar.
          </p>

          <div className="space-y-5">
            <div>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-2">
                Beza varian
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/varian/honda-city',    label: 'Honda City' },
                  { href: '/varian/perodua-myvi',  label: 'Perodua Myvi' },
                  { href: '/varian/perodua-bezza', label: 'Perodua Bezza' },
                  { href: '/varian/toyota-alphard', label: 'Toyota Alphard' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="font-body text-[13px] text-[#3D472F] bg-[#F4F6F0] border border-[#CBD4BB] rounded-[8px] px-3 py-1.5 hover:bg-[#E7EBDF] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-2">
                Bandingkan model
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/bandingkan/alza-vs-x50',  label: 'Alza vs X50' },
                  { href: '/bandingkan/bezza-vs-saga', label: 'Bezza vs Saga' },
                  { href: '/bandingkan/vios-vs-city',  label: 'Vios vs City' },
                  { href: '/bandingkan/myvi-vs-axia',  label: 'Myvi vs Axia' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="font-body text-[13px] text-[#3D472F] bg-[#F4F6F0] border border-[#CBD4BB] rounded-[8px] px-3 py-1.5 hover:bg-[#E7EBDF] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-[#F8FAF7] px-5 py-14 text-center md:py-20 border-t border-[#E5E7EB]">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading font-extrabold text-[24px] md:text-[30px] leading-tight tracking-tight text-[#111827] mb-3">
            Ada satu kereta yang<br />anda sedang fikirkan?
          </h2>
          <p className="font-body text-[14px] text-[#6B7280] mb-7">
            Hantar sekarang. Disemak oleh manusia, sampai dalam {REVIEW_SLA_HOURS} jam,
            dan duit dikembalikan kalau kami tidak dapat siapkan.
          </p>
          <Link
            href="/#semak"
            className="inline-block bg-[#3D472F] text-white font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 hover:bg-[#2E3523] transition-colors"
          >
            Semak kereta ini — {BASE_REPORT_LABEL} →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#E5E7EB] px-5 py-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4">
          <Link href="/checklist-beli-kereta-terpakai" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Checklist</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/cara-beli-kereta-terpakai" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Cara Beli</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/risiko-beli-kereta-terpakai" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Risiko</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/harga-kereta-terpakai" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Harga Model</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/kira-ansuran-kereta" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Kira Ansuran</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/pemeriksaan-fizikal" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Pemeriksaan Fizikal</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/banding-insurans" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Banding Insurans</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/bandingkan" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Bandingkan</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/panduan" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Semua Panduan</Link>
        </div>
        <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mb-2">
          © {new Date().getFullYear()} Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
        </p>
        <SocialLinks className="mb-2" />
        <div className="flex items-center justify-center gap-4">
          <Link href="/tentang" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Tentang</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/privasi" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Privasi</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/terma" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Terma</Link>
          {contactHref && (
            <>
              <span className="text-[#E5E7EB]">·</span>
              <a href={contactHref} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 font-body text-[12px] text-[#6B7280] hover:text-[#3D472F] transition-colors">Hubungi Kami</a>
            </>
          )}
        </div>
      </footer>
    </>
  )
}
