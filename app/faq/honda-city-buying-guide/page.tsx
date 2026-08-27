/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import Link from 'next/link'
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { VARIANT_GUIDES, VERDICT_LABELS } from '@/lib/variant-guides'

/**
 * The SAME data /varian/honda-city renders. Never a second hand-written copy.
 *
 * Non-null asserted deliberately: this page is ABOUT the Honda City, so a
 * missing guide is a build-time contradiction, not a runtime branch to render
 * an empty section for. The test in guide-truthfulness pins the key.
 */
const CITY = VARIANT_GUIDES['honda-city']!

export const metadata: Metadata = {
  title: 'Panduan Beli Honda City Terpakai 2026 — Tahun & Varian Mana | Paqar',
  description: 'Panduan penuh Honda City terpakai: tahun mana paling berbaloi, varian S, E atau V, harga iklan setanding, susut nilai, dan apa perlu disemak sebelum beli.',
  alternates: { canonical: 'https://paqar.my/faq/honda-city-buying-guide' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Panduan Beli Honda City Terpakai 2026 — Tahun & Varian Mana | Paqar',
    description: 'Panduan penuh Honda City terpakai: tahun mana paling berbaloi, varian S, E atau V, harga iklan setanding, susut nilai, dan apa perlu disemak sebelum beli.',
    url: 'https://paqar.my/faq/honda-city-buying-guide',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function HondaCityGuide() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Honda City tahun mana paling berbaloi dibeli terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Honda City generasi GM6 (2014–2019), varian E, adalah pilihan yang paling kerap berbaloi: kelengkapan harian cukup tanpa premium varian V, dan data iklan setanding untuk tahun-tahun itu paling tebal. Model sebelum 2014 (GM2) lebih murah tetapi lebih lama. Model 2020 ke atas (GN2) masih mahal dan iklan setandingnya masih sedikit, jadi harga pasaran lebih sukar dianggarkan dengan yakin.',
        },
      },
      {
        '@type': 'Question',
        name: 'Patut beli Honda City S, E atau V?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Honda Malaysia menjual City sebagai S, E dan V — tiada varian bernama H. Untuk kebanyakan pembeli, E adalah nilai terbaik: sports rim, skrin sentuh dan kunci pintar tanpa harga varian V. S berbaloi hanya jika harganya jelas lebih murah. V berbaloi jika bezanya dengan E kurang daripada RM4k. Sahkan varian yang diiklankan dengan rekod pendaftaran rasmi — varian yang tersilap label adalah perkara biasa dalam iklan.',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        <h1 className="text-4xl font-bold mb-6">Panduan Beli Honda City Terpakai: Tahun &amp; Varian Terbaik</h1>
        <p className="text-lg text-[#6B7280] mb-6">Panduan penuh beli Honda City terpakai: generasi mana, varian mana, harga iklan setanding, dan apa perlu disemak.</p>

        <div className="bg-[#F4F6F0] border border-[#CBD4BB] rounded-lg p-6 mb-8">
          <p className="font-semibold text-[#3D472F] mb-2">Jawapan ringkas</p>
          <p className="text-[#374151]">
            Untuk kebanyakan pembeli: <strong>City GM6 (2014–2019), varian E</strong>. Kelengkapan
            harian cukup tanpa premium varian V, dan iklan setanding untuk tahun-tahun itu
            paling banyak — jadi harga pasarannya paling boleh dipercayai. Angka di bawah
            adalah titik permulaan, bukan harga untuk unit tertentu.
          </p>
        </div>

        {/*
            ── GENERATIONS AND VARIANTS COME FROM lib/variant-guides.ts ───────
            This section used to be written by hand, and it disagreed with
            Paqar's own variant guide about the same cars. It called the
            2008–2014 City "Generasi 1", the 2014–2020 City "Generasi 2" and
            the 2020+ City "Generasi 3"; /varian/honda-city correctly calls
            them Generasi 5 (GM2), 6 (GM6) and 7 (GN2). Two Paqar pages, one
            car, different answers — on a site that sells knowing which car
            you are actually looking at.

            It also compared variants "1.5 S vs 1.5 H". Honda Malaysia never
            sold a City H; the line is S, E and V. And it claimed the base
            2008–2014 variant had no power steering, which no Malaysian City
            ever lacked.

            Rendering from VARIANT_GUIDES makes the two pages agree by
            construction rather than by anyone remembering to sync them. */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Generasi dan varian Honda City</h2>
          <p className="text-[#374151] mb-6">
            Kod generasi (GM2, GM6, GN2) adalah cara paling tepat untuk tahu kereta mana
            yang anda tengok — nama "City" sahaja merangkumi lebih 15 tahun kereta yang
            sangat berbeza.
          </p>

          <div className="space-y-8">
            {CITY.generations.map(gen => (
              <div key={gen.label} className="border-l-4 border-[#3D472F] pl-4">
                <h3 className="text-lg font-semibold mb-1">{gen.label}</h3>
                <p className="text-sm text-[#6B7280] mb-3">{gen.years}</p>
                <div className="space-y-4">
                  {gen.variants.map(v => (
                    <div key={v.name}>
                      <p className="font-semibold text-[#111827]">
                        {v.name}
                        <span className="ml-2 text-xs font-normal text-[#6B7280]">
                          {VERDICT_LABELS[v.verdict]}
                        </span>
                      </p>
                      <p className="text-[#374151] text-sm mt-1">{v.verdictNote}</p>
                      {v.usedPriceBand && (
                        <p className="text-sm text-[#6B7280] mt-1">Harga terpakai: {v.usedPriceBand}</p>
                      )}
                      {v.spotChecks?.length > 0 && (
                        <p className="text-sm text-[#6B7280] mt-1">
                          Cara kenal: {v.spotChecks.join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-[#6B7280] mt-6">
            Panduan varian penuh, dengan setiap perbezaan kelengkapan:{' '}
            <Link href="/varian/honda-city" className="text-[#3D472F] underline underline-offset-2">
              /varian/honda-city →
            </Link>
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Anggaran harga City terpakai</h2>
        <p className="text-[#374151] mb-4">
          Anggaran panduan untuk beri anda titik permulaan, bukan harga pasaran yang
          dikira untuk kereta tertentu. Harga sebenar bergantung kepada varian, jarak
          tempuh dan kondisi — semak harga sebenar City yang anda minat sebelum buat tawaran.
        </p>
                    <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F3F4F6]">
                <th className="border p-3 text-left">Model</th>
                <th className="border p-3 text-left">Tahun</th>
                <th className="border p-3 text-left">Jarak tempuh</th>
                <th className="border p-3 text-left">Harga biasa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3">City 1.5 S</td>
                <td className="border p-3">2017</td>
                <td className="border p-3">90k km</td>
                <td className="border p-3">RM24–26k</td>
              </tr>
              <tr className="bg-[#F9FAFB]">
                <td className="border p-3">City 1.5 E</td>
                <td className="border p-3">2017</td>
                <td className="border p-3">90k km</td>
                <td className="border p-3">RM26–28k</td>
              </tr>
              <tr>
                <td className="border p-3">City 1.5 S</td>
                <td className="border p-3">2019</td>
                <td className="border p-3">60k km</td>
                <td className="border p-3">RM28–30k</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Senarai Semak Sebelum Beli</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Buat semakan rekod accident &amp; claim insurans</p>
                <p className="text-sm text-[#6B7280]">Dedahkan sejarah yang penjual mungkin tak beritahu.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Semak harga pasaran iklan itu</p>
                <p className="text-sm text-[#6B7280]">Tahu harga sebenar sebelum mula berunding.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Sahkan varian sebenar sama dengan apa yang penjual kata</p>
                <p className="text-sm text-[#6B7280]">S, E dan V beza harga. Jangan ambil cakap penjual bulat-bulat — sahkan varian dengan geran.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Test drive di highway dan dalam bandar</p>
                <p className="text-sm text-[#6B7280]">Dengar bunyi berdentum transmisi (masalah CVT biasa pada unit lama).</p>
              </div>
            </div>
            <div className="flex gap-4">
              <input type="checkbox" className="flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Rundingkan RM2–4k bawah harga minta</p>
                <p className="text-sm text-[#6B7280]">Guna harga pasaran dan hasil semakan rekod sebagai asas rundingan.</p>
              </div>
            </div>
          </div>
        </section>

        <FaqGetValuationCta faqSlug="honda-city-buying-guide" />
      </div>
    </>
  )
}
