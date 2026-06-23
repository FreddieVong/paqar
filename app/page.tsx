import Link           from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { HomeCheckerTabs } from '@/components/check/HomeCheckerTabs'
import { getCheckCount } from '@/lib/db/checks'

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
    {
      '@type': 'Organization',
      name: 'Paqar',
      url: 'https://paqar.my',
      logo: 'https://paqar.my/paqar-logo.png',
      description: 'Paqar membantu pembeli kereta terpakai Malaysia semak harga pasaran, dapatkan Laporan Pembeli, dan semak rekod claim insurans sebelum bayar booking atau deposit.',
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'hello@paqar.my' },
    },
    {
      '@type': 'Service',
      name: 'Laporan Pembeli Kereta Terpakai',
      description: 'Laporan Pembeli RM12 merangkumi verdict harga pasaran, median dan range harga, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit.',
      provider: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
      areaServed: { '@type': 'Country', name: 'Malaysia' },
      offers: { '@type': 'Offer', price: '12', priceCurrency: 'MYR', availability: 'https://schema.org/InStock' },
    },
    {
      '@type': 'Service',
      name: 'Semakan Accident/Claim Insurans Kereta',
      description: 'Semakan Accident/Claim Insurans RM100 merangkumi semua dalam Laporan Pembeli RM12 ditambah semakan rekod claim insurans seperti own damage, banjir, windscreen atau total loss jika direkodkan — sebelum bayar booking atau deposit.',
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
          acceptedAnswer: { '@type': 'Answer', text: 'Semakan percuma beri verdict harga dan jurang RM dari median pasaran. Laporan Pembeli (RM12) tambah harga pasaran penuh, anggaran trade-in, maklumat kenderaan JPJ, soalan untuk penjual dan skrip rundingan. Tambah Semakan Accident/Claim Insurans (+RM88) untuk semak rekod claim insurans seperti own damage, banjir atau total loss jika direkodkan — sebelum bayar booking atau deposit.' },
        },
        {
          '@type': 'Question',
          name: 'Apa yang ada dalam Laporan Pembeli RM12 Paqar?',
          acceptedAnswer: { '@type': 'Answer', text: 'Laporan Pembeli RM12 merangkumi: verdict harga pasaran (murah/wajar/mahal), median dan range harga berdasarkan listing semasa, anggaran trade-in, maklumat kenderaan (tahun daftar, enjin, jenis badan, nombor rangka), skrip rundingan harga siap pakai, soalan penting untuk penjual, dan checklist sebelum bayar deposit.' },
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
          acceptedAnswer: { '@type': 'Answer', text: 'Ya. Sesuai guna sebelum pergi tengok kereta atau sebelum bayar booking atau deposit.' },
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
  const checkCount = await getCheckCount().catch(() => 0)
  const countDisplay = checkCount > 20
    ? `${(Math.floor(checkCount / 10) * 10).toLocaleString()}+`
    : null

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
                Percuma · Tanpa daftar akaun
              </span>
            </div>
          </div>

          <h1 className="font-heading font-extrabold text-[30px] md:text-[36px] leading-[1.1] tracking-[-0.03em] text-[#111827] mb-3">
            Penjual tahu harga sebenar.<br />
            <span className="text-[#064E4A]">Sekarang anda pun tahu.</span>
          </h1>

          <p className="font-body text-[14px] text-[#6B7280] mb-7 leading-relaxed">
            Semak harga kereta terpakai sebelum bayar booking atau deposit.
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
                {[
                  'Verdict harga percuma',
                  'Median & range pasaran',
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
                  Guna skrip siap untuk tanya soalan penting dan runding harga sebelum bayar booking atau deposit.
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
        </div>
      </section>

      {/* ── CARA IA BERFUNGSI ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Cara Ia Berfungsi
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-2">
            Tiga langkah. Satu minit.
          </h2>
          <p className="font-body text-[14px] text-[#6B7280] mb-8">
            Tiada pendaftaran diperlukan.
          </p>

          <div className="flex flex-col gap-0">
            {[
              {
                n: '1',
                title: 'Masukkan maklumat kereta',
                desc:  'Jenama, model, tahun, dan harga yang penjual minta.',
              },
              {
                n: '2',
                title: 'Dapat verdict harga — percuma',
                desc:  'Kami semak harga pasaran dan tunjukkan sama ada berpatutan.',
              },
              {
                n: '3',
                title: 'Masuk rundingan dengan data',
                desc:  'Dapat skrip rundingan, maklumat kenderaan JPJ dan harga sebenar — Laporan Pembeli RM12. Tambah Semakan Accident/Claim Insurans untuk RM100 sebelum bayar booking atau deposit.',
              },
            ].map((step, i) => (
              <div key={step.n} className="flex gap-4 pb-6 relative">
                {i < 2 && (
                  <div className="absolute left-5 top-10 w-0.5 h-[calc(100%-16px)] bg-[#E5E7EB]" />
                )}
                <div className="w-10 h-10 bg-[#064E4A] rounded-xl flex items-center justify-center font-heading font-extrabold text-[16px] text-white flex-shrink-0 z-10">
                  {step.n}
                </div>
                <div className="pt-2">
                  <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">{step.title}</p>
                  <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
            <div className="flex gap-3 items-start">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
                <path d="M8 2L14.5 13H1.5L8 2Z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6.5V9" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#F59E0B"/>
              </svg>
              <p className="font-body text-[13px] text-white/65 leading-relaxed">
                Harga yang penjual minta belum tentu mencerminkan harga pasaran sebenar.
              </p>
            </div>
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
                quote: '"Semak dulu sebelum pegi tengok kereta. Penjual minta RM42k tapi verdict cakap overpriced. Lepas tunjuk data, dia turun RM3k."',
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

      {/* ── BELI KERETA TERPAKAI? ── */}
      <section className="bg-[#111827] px-5 py-10">
        <div className="max-w-5xl mx-auto md:flex md:items-center md:justify-between md:gap-8">
          <div className="mb-5 md:mb-0">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-white/50 mb-2">
              Untuk Pembeli
            </p>
            <h2 className="font-heading font-extrabold text-[22px] text-white mb-2">
              Nak beli kereta terpakai? Semak dahulu.
            </h2>
            <p className="font-body text-[14px] text-white/70 leading-relaxed">
              Penjual tidak selalu dedahkan semua risiko. Paqar bantu anda semak harga pasaran, maklumat kenderaan, dan runding dengan yakin — sebelum bayar booking atau deposit.
            </p>
          </div>
          <a
            href="/#semak"
            className="block w-full md:w-auto bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 text-center hover:bg-[#FDE047] transition-colors"
          >
            Semak Kereta Yang Nak Dibeli →
          </a>
        </div>
      </section>

      {/* ── PANDUAN PERCUMA ── */}
      <section className="bg-[#F8FAF7] px-5 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 md:text-center">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
              Panduan Percuma
            </p>
            <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827]">
              Semua yang perlu anda tahu sebelum beli
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { href: '/checklist-beli-kereta-terpakai', title: 'Checklist sebelum bayar deposit',       desc: 'Tandakan semua ini dulu' },
              { href: '/cara-beli-kereta-terpakai',      title: 'Cara beli kereta terpakai',             desc: '6 langkah dari semak hingga deposit' },
              { href: '/risiko-beli-kereta-terpakai',    title: 'Risiko beli kereta terpakai',           desc: '7 risiko dan cara elaknya' },
              { href: '/harga-kereta-terpakai',          title: 'Harga kereta terpakai mengikut model', desc: 'Myvi, Axia, Vios, City, Saga & lebih' },
            ].map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group"
              >
                <div>
                  <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">
                    {guide.title}
                  </p>
                  <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">{guide.desc}</p>
                </div>
                <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-center md:text-left">
            <Link
              href="/panduan"
              className="font-body text-[13px] text-[#064E4A] font-semibold hover:underline underline-offset-2"
            >
              Lihat semua panduan →
            </Link>
          </div>
        </div>
      </section>

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
                a: 'Semakan percuma beri verdict harga dan jurang RM dari median pasaran. Laporan Pembeli (RM12) tambah harga pasaran penuh, anggaran trade-in, maklumat kenderaan JPJ, soalan untuk penjual dan skrip rundingan. Tambah Semakan Accident/Claim Insurans (+RM88) untuk semak rekod claim insurans seperti own damage, banjir atau total loss jika direkodkan — sebelum bayar booking atau deposit.',
              },
              {
                q: 'Adakah saya perlu daftar akaun?',
                a: 'Tidak. Tiada akaun diperlukan.',
              },
              {
                q: 'Boleh guna sebelum tengok kereta?',
                a: 'Ya. Sesuai guna sebelum pergi tengok kereta atau sebelum bayar booking atau deposit.',
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

      {/* ── FINAL CTA ── */}
      <section className="bg-[#14453d] px-5 py-14 text-center md:py-20">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading font-extrabold text-[24px] md:text-[30px] leading-tight tracking-tight text-white mb-3">
            Semak sebelum<br />bayar deposit
          </h2>
          <p className="font-body text-[14px] text-white/70 mb-7">
            Verdict harga percuma.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Laporan Pembeli RM12.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Tanpa daftar akaun.
          </p>
          <Link
            href="/"
            className="inline-block bg-white text-[#064E4A] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 hover:bg-[#F8FAF7] transition-colors"
          >
            Semak Harga Percuma →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#E5E7EB] px-5 py-6 text-center">
        <p className="font-body text-[12px] text-[#D1D5DB] leading-relaxed mb-2">
          © 2026 Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/privasi" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Privasi</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/terma" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Terma</Link>
          <span className="text-[#E5E7EB]">·</span>
          <a href="mailto:hello@paqar.my" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Hubungi Kami</a>
        </div>
      </footer>
    </>
  )
}
