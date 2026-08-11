import type { Metadata } from 'next'
import Link           from 'next/link'
import { unstable_cache } from 'next/cache'
import { Nav }           from '@/components/layout/Nav'
import { HomeCheckerTabs } from '@/components/check/HomeCheckerTabs'
import { SocialLinks }    from '@/components/layout/SocialLinks'
import { getCheckCount } from '@/lib/db/checks'
import { organizationSchema, whatsappUrl } from '@/lib/site'

// Only the canonical is declared here — title/description/openGraph are
// inherited from the root layout, which describes the homepage anyway.
// This used to live in the layout, where it leaked onto every other page.
export const metadata: Metadata = {
  alternates: { canonical: 'https://paqar.my' },
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
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://paqar.my/?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
    // sameAs is what tells Google the site, the three social profiles and the
    // Google Business Profile are one entity. The ContactPoint that used to
    // sit here published hello@paqar.my — an address with no MX record — so
    // it is now emitted only when a channel actually works.
    organizationSchema(),
    {
      '@type': 'Service',
      name: 'Laporan Pembeli Kereta Terpakai',
      description: 'Laporan Pembeli RM12 merangkumi keputusan harga pasaran, harga tengah dan julat harga, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit.',
      provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
      areaServed: { '@type': 'Country', name: 'Malaysia' },
      offers: { '@type': 'Offer', price: '12', priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
    },
    {
      '@type': 'Service',
      name: 'Semakan Accident/Claim Insurans Kereta',
      description: 'Semakan Accident/Claim Insurans RM100 merangkumi semua dalam Laporan Pembeli RM12 ditambah semakan rekod claim insurans seperti own damage, banjir, windscreen atau total loss jika direkodkan — sebelum bayar deposit.',
      provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
      areaServed: { '@type': 'Country', name: 'Malaysia' },
      offers: { '@type': 'Offer', price: '100', priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Apakah beza semakan percuma dan laporan RM12?',
          acceptedAnswer: { '@type': 'Answer', text: 'Semakan percuma beri keputusan harga — murah, wajar atau mahal — dengan penjelasan dan tahap keyakinan data. Laporan Pembeli (RM12) tambah angka pasaran penuh iaitu harga tengah dan julat, anggaran trade-in, maklumat kenderaan JPJ, soalan untuk penjual dan skrip rundingan. Tambah Semakan Accident/Claim Insurans (+RM88) untuk semak rekod claim insurans seperti own damage, banjir atau total loss jika direkodkan — sebelum bayar deposit.' },
        },
        {
          '@type': 'Question',
          name: 'Apa yang ada dalam Laporan Pembeli RM12 Paqar?',
          acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli RM12 merangkumi: keputusan harga pasaran (murah/wajar/mahal), harga tengah dan julat harga berdasarkan listing semasa, anggaran trade-in, maklumat kenderaan (tahun daftar, enjin, jenis badan, nombor rangka), skrip rundingan harga siap pakai, soalan penting untuk penjual, dan checklist sebelum bayar deposit.' },
        },
        {
          '@type': 'Question',
          name: 'Boleh semak rekod accident atau claim insurans kereta terpakai di Malaysia?',
          acceptedAnswer: { '@type': 'Answer', text: 'Ya. Paqar menyediakan Semakan Accident/Claim Insurans (RM100) yang semak rekod claim insurans seperti own damage, banjir, windscreen atau total loss jika direkodkan. Penting: tidak semua kemalangan mempunyai rekod claim insurans, dan rekod bersih tidak bermakna kereta tiada isu. Gunakan maklumat ini untuk bertanya soalan yang lebih tepat kepada penjual.' },
        },
        {
          '@type': 'Question',
          name: 'Berapa harga semakan di Paqar?',
          acceptedAnswer: { '@type': 'Answer', text: 'Semakan harga percuma. Laporan Pembeli RM12 (satu bayaran, tanpa akaun). Laporan + Semakan Accident/Claim Insurans RM100. Atau tambah +RM88 kepada laporan RM12 sedia ada.' },
        },
        {
          '@type': 'Question',
          name: 'Adakah saya perlu daftar akaun?',
          acceptedAnswer: { '@type': 'Answer', text: 'Tidak. Tiada akaun diperlukan.' },
        },
        {
          '@type': 'Question',
          name: 'Boleh guna sebelum tengok kereta?',
          acceptedAnswer: { '@type': 'Answer', text: 'Ya. Sesuai guna sebelum pergi tengok kereta atau sebelum bayar deposit.' },
        },
        {
          '@type': 'Question',
          name: 'Adakah Paqar dari JPJ atau PDRM?',
          acceptedAnswer: { '@type': 'Answer', text: 'Paqar adalah perkhidmatan pihak ketiga — bukan afiliasi JPJ atau PDRM.' },
        },
        {
          '@type': 'Question',
          name: 'Apakah had atau limitasi Paqar?',
          acceptedAnswer: { '@type': 'Answer', text: 'Paqar tidak mengesahkan bacaan odometer sebenar. Tidak semua kemalangan mempunyai rekod claim insurans. Rekod claim bersih tidak bermaksud kereta tiada masalah. Pengguna tetap perlu buat inspection fizikal dan tanya penjual soalan yang tepat.' },
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

      {/* ── HERO ── */}
      <section id="semak" className="bg-white px-5 pt-10 pb-12 md:pt-14 md:pb-16 overflow-x-hidden">
        <div className="max-w-xl mx-auto">

          {/* Single trust badge */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-[#16A34A] rounded-full" />
              <span className="font-heading font-bold text-[12px] text-[#15803D]">
                Semakan harga percuma · Tanpa daftar
              </span>
            </div>
          </div>

          {/* Two block spans rather than a <br />: keeps "Semak dulu." on its own
              green line at every width, and lets text-balance split the first
              sentence evenly on narrow screens instead of stranding "kereta."
              on a line by itself. */}
          <h1 className="font-heading font-extrabold text-[30px] md:text-[36px] leading-[1.1] tracking-[-0.03em] text-[#111827] mb-3">
            <span className="block text-balance">Jangan tersalah beli kereta.</span>
            <span className="block text-[#064E4A]">Semak dulu.</span>
          </h1>

          {/* text-balance on both: without it 375px strands "deposit." and
              "odometer." alone on a final line — the two words carrying the message. */}
          <p className="font-body text-[15px] text-[#374151] mb-2 leading-relaxed text-balance">
            Ketahui risiko tersembunyi sebelum anda bayar deposit.
          </p>

          {/* #6B7280 not #9CA3AF: gray-400 on white is 2.5:1 and fails WCAG AA.
              Size (13 vs 15px) and weight keep it subordinate to the subheadline. */}
          <p className="font-body text-[13px] text-[#6B7280] mb-7 leading-relaxed text-balance">
            Harga pasaran percuma. Laporan bermula RM12, dengan pilihan semakan rekod kemalangan dan odometer.
          </p>

          <HomeCheckerTabs countDisplay={countDisplay} />

        </div>
      </section>

      {/* ── APA YANG BOLEH DISEMAK ── */}
      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 md:text-center">
            <h2 className="font-heading font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#111827]">
              Apa yang anda boleh semak
            </h2>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-2 gap-3">
            {/* Free price check card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 md:p-5">
              <p className="font-heading font-bold text-[15px] text-[#111827] mb-0.5">Semak Harga Pasaran</p>
              <p className="font-body text-[13px] text-[#6B7280] mb-3">Tahu sama ada harga seller mahal, wajar atau berbaloi.</p>
              <div className="space-y-1.5 mb-3">
                {/* "Harga tengah & julat pasaran" used to sit here under a
                    "Percuma" badge. Those figures are what RM12 sells now — the
                    free check gives the verdict and how much to trust it. */}
                {[
                  'Keputusan harga percuma',
                  'Tahap keyakinan data',
                  'Analisis siap — bukan data mentah',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="w-[15px] h-[15px] rounded-full bg-[#14453d] flex items-center justify-center flex-shrink-0">
                      <svg width="7" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <p className="font-body text-[12px] text-[#374151]">{item}</p>
                  </div>
                ))}
              </div>
              <span className="inline-block font-heading font-bold text-[11px] px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D]">
                Percuma
              </span>
            </div>

            {/* RM12 report card — value-stacked */}
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
              {/* Hero block */}
              <div className="bg-[#14453d] px-4 py-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] flex-shrink-0" />
                  <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-white/45">
                    Laporan Pembeli — RM12
                  </span>
                </div>
                <p className="font-heading font-extrabold text-[14px] leading-snug text-white mb-1.5">
                  Masuk rundingan dengan data.<br />Bukan agak-agak.
                </p>
                <p className="font-body text-[11px] text-white/55 leading-relaxed">
                  Guna skrip siap untuk tanya soalan penting dan runding harga sebelum bayar deposit.
                </p>
              </div>

              {/* Value stack */}
              <div className="px-4 py-1 border-b border-[#F3F4F6]">
                {[
                  { title: 'Skrip rundingan harga',            desc: 'Bantu anda bincang berdasarkan data.' },
                  { title: 'Harga pasaran & anggaran trade-in', desc: 'Faham harga sebenar dan ruang rundingan anda.' },
                  { title: 'Maklumat kenderaan (JPJ)',            desc: 'Tahun daftar, enjin, jenis badan dan nombor rangka.' },
                  { title: 'Soalan penting untuk seller',      desc: 'Tanya soalan yang boleh dedahkan risiko.' },
                ].map((item, i, arr) => (
                  <div key={item.title} className={`flex gap-2.5 items-start py-2.5 ${i < arr.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                    <span className="w-[17px] h-[17px] rounded-full bg-[#14453d] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <div>
                      <p className="font-heading font-bold text-[12px] text-[#111827] leading-snug">{item.title}</p>
                      <p className="font-body text-[11px] text-[#9CA3AF] leading-snug mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price anchor */}
              <div className="px-4 py-2.5 bg-[#F8FAF7]">
                <p className="font-body text-[11px] text-[#6B7280] leading-relaxed">
                  Untuk pembelian kereta <span className="font-bold text-[#14453d]">bernilai ribuan ringgit</span>, Laporan Pembeli hanya{' '}
                  <span className="font-extrabold text-[13px] text-[#14453d]">RM12</span>.
                </p>
              </div>

              {/* Sample report link */}
              <div className="px-4 py-2.5 text-right">
                <Link
                  href="/contoh-laporan"
                  className="font-body text-[11px] text-[#14453d] font-semibold hover:underline underline-offset-2"
                >
                  Lihat contoh laporan →
                </Link>
              </div>
            </div>
          </div>

          {/* Calculator tool row */}
          <Link
            href="/kira-ansuran-kereta"
            className="mt-3 flex items-center justify-between gap-4 bg-white border-l-[3px] border-l-[#15803D] border border-[#E5E7EB] rounded-[14px] px-4 py-4 hover:bg-[#F0FDF4] transition-colors group"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-[#064E4A]">Kira Ansuran Kereta</span>
                <span className="font-heading font-bold text-[9px] px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">Percuma</span>
              </div>
              <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
                Bayaran bulanan, jumlah faedah, roadtax dan anggaran insurans — tahu kos sebenar sebulan.
              </p>
            </div>
            <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 text-[18px]">→</span>
          </Link>

          {/* RM100 upgrade row */}
          <Link
            href="/semak-accident-claim-insurans-kereta"
            className="mt-3 flex items-center justify-between gap-4 bg-white border-l-[3px] border-l-[#064E4A] border border-[#E5E7EB] rounded-[14px] px-4 py-4 hover:bg-[#F0FDF4] transition-colors group"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-bold text-[9px] uppercase tracking-[.1em] text-[#064E4A]">Semakan Accident/Claim Insurans</span>
                <span className="font-heading font-bold text-[9px] px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#064E4A]">RM100</span>
              </div>
              <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
                Semak sejarah kemalangan kenderaan — own damage, banjir, windscreen atau total loss jika direkodkan, termasuk meter ketika claim dan amaran kalau meter mungkin dipusing balik. Atau tambah +RM88 kepada Laporan Pembeli sedia ada.
              </p>
            </div>
            <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 text-[18px]">→</span>
          </Link>

        </div>
      </section>

      {/* ── KENAPA PERLU SEMAK DULU ── */}
      <section className="bg-[#1C1917] px-5 py-10 md:py-12">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-white/30 mb-4">
            Kenapa perlu semak dulu
          </p>
          <h2 className="font-heading font-extrabold text-[24px] md:text-[28px] leading-tight tracking-tight text-white mb-3">
            Penjual tahu.<br />
            <span className="text-[#F59E0B]">Ramai pembeli tidak.</span>
          </h2>
          <p className="font-body text-[14px] text-white/60 leading-relaxed mb-5">
            Harga pasaran berubah ikut model, tahun, varian, warna dan rekod kereta. Penjual berpengalaman tahu semua ini. Pembeli biasa selalunya tidak. Di situlah ramai orang bayar lebih.
          </p>
          <div className="h-px bg-white/7 mb-5" />
          <div className="flex flex-col gap-4">
            {[
              'Harga yang penjual minta belum tentu mencerminkan harga pasaran sebenar.',
              'Kereta dengan rekod kemalangan atau banjir jarang diberitahu awal-awal.',
              'Deposit yang dah dibayar susah nak dapat balik bila masalah muncul kemudian.',
            ].map((risk) => (
              <div key={risk} className="flex gap-3 items-start">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
                  <path d="M8 2L14.5 13H1.5L8 2Z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M8 6.5V9" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.75" fill="#F59E0B"/>
                </svg>
                <p className="font-body text-[13px] text-white/65 leading-relaxed">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
      ── APA KATA PEMBELI PAQAR ── (uncomment when 2–3 real quotes are collected)

      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Apa kata pembeli Paqar
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-6">
            Beli dengan lebih yakin.
          </h2>
          <div className="flex flex-col gap-3">
            {[
              {
                quote: '"Semak dulu sebelum pegi tengok kereta. Penjual minta RM42k tapi Paqar cakap MAHAL. Lepas tunjuk data, dia turun RM3k."',
                name: 'Hafiz, Selangor',
                car: 'Perodua Myvi 2019',
                outcome: 'Jimat RM3,000',
              },
              // Add more real quotes here. Format: quote, name+city, car, outcome (RM jimat / "beli dengan lebih yakin")
            ].map((t) => (
              <div key={t.name} className="bg-white border border-[#E5E7EB] rounded-[14px] p-4">
                <p className="text-[#FACC15] text-[11px] tracking-widest mb-2">★★★★★</p>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3 italic">{t.quote}</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-heading font-bold text-[12px] text-[#111827]">{t.name}</p>
                    <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">{t.car}</p>
                  </div>
                  <span className="font-heading font-bold text-[10px] bg-[#DCFCE7] text-[#15803D] px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                    {t.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* ── SOALAN LAZIM ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Soalan Lazim
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-6">
            Ada soalan?
          </h2>

          <div className="flex flex-col gap-2">
            {[
              {
                q: 'Apakah beza semakan percuma dan laporan RM12?',
                a: 'Semakan percuma beri keputusan harga — murah, wajar atau mahal — dengan penjelasan dan tahap keyakinan data. Laporan Pembeli (RM12) tambah angka pasaran penuh iaitu harga tengah dan julat, anggaran trade-in, maklumat kenderaan JPJ, soalan untuk penjual dan skrip rundingan. Tambah Semakan Accident/Claim Insurans (+RM88) untuk semak rekod claim insurans seperti own damage, banjir atau total loss jika direkodkan — termasuk meter ketika claim dan amaran kalau meter mungkin dipusing balik — sebelum bayar deposit.',
              },
              {
                q: 'Adakah saya perlu daftar akaun?',
                a: 'Tidak. Tiada akaun diperlukan.',
              },
              {
                q: 'Boleh guna sebelum tengok kereta?',
                a: 'Ya. Sesuai guna sebelum pergi tengok kereta atau sebelum bayar deposit.',
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
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
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
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">
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
                    className="font-body text-[13px] text-[#064E4A] bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] px-3 py-1.5 hover:bg-[#DCFCE7] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF] mb-2">
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
                    className="font-body text-[13px] text-[#064E4A] bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] px-3 py-1.5 hover:bg-[#DCFCE7] transition-colors"
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
      <section className="bg-[#14453d] px-5 py-14 text-center md:py-20">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading font-extrabold text-[24px] md:text-[30px] leading-tight tracking-tight text-white mb-3">
            Semak sebelum<br />bayar deposit
          </h2>
          <p className="font-body text-[14px] text-white/70 mb-7">
            Keputusan harga percuma.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Laporan Pembeli RM12.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Tanpa daftar akaun.
          </p>
          <Link
            href="/#semak"
            className="inline-block bg-white text-[#064E4A] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 hover:bg-[#F8FAF7] transition-colors"
          >
            Semak Harga Percuma →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#E5E7EB] px-5 py-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4">
          <Link href="/checklist-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Checklist</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/cara-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Cara Beli</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/risiko-beli-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Risiko</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/harga-kereta-terpakai" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Harga Model</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/kira-ansuran-kereta" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Kira Ansuran</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/bandingkan" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Bandingkan</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/panduan" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Semua Panduan</Link>
        </div>
        <p className="font-body text-[12px] text-[#D1D5DB] leading-relaxed mb-2">
          © {new Date().getFullYear()} Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
        </p>
        <SocialLinks className="mb-2" />
        <div className="flex items-center justify-center gap-4">
          <Link href="/tentang" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Tentang</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/privasi" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Privasi</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/terma" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Terma</Link>
          {contactHref && (
            <>
              <span className="text-[#E5E7EB]">·</span>
              <a href={contactHref} target="_blank" rel="noopener noreferrer" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Hubungi Kami</a>
            </>
          )}
        </div>
      </footer>
    </>
  )
}
