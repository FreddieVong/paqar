/* eslint-disable react/no-unescaped-entities */
import { FaqGetValuationCta } from '@/components/faq/FaqGetValuationCta'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Senarai Semak Penuh: Apa Nak Periksa Sebelum Beli Kereta Terpakai | Paqar',
  description: 'Panduan pemeriksaan langkah demi langkah: luaran, dalaman, enjin, elektrik, test drive dan bawah kereta. Apa nak cari, dan bila patut berundur.',
  alternates: { canonical: 'https://paqar.my/faq/what-to-check-buying-used-car' },
  // These guides previously declared no openGraph at all, so they inherited
  // the ROOT layout's — which named the homepage as og:url, og:title and
  // og:description. Every share of this guide advertised the homepage.
  openGraph: {
    title: 'Senarai Semak Penuh: Apa Nak Periksa Sebelum Beli Kereta Terpakai | Paqar',
    description: 'Panduan pemeriksaan langkah demi langkah: luaran, dalaman, enjin, elektrik, test drive dan bawah kereta. Apa nak cari, dan bila patut berundur.',
    url: 'https://paqar.my/faq/what-to-check-buying-used-car',
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'article',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
}

export default function ChecklistBuyingUsedCar() {
  // Grounded in the pre-viewing, at-the-viewing, red-flags and after-viewing
  // sections rendered below.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Apa patut saya tanya sebelum pergi tengok kereta terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tanya berapa orang pemilik sebelum ini — satu atau dua orang itu bagus — dan tanya sama ada kereta pernah kemalangan atau kena banjir, perhatikan kalau penjual teragak-agak. Semak harga pasaran iklan itu supaya anda tahu harga sebenar, serta minta gambar ruang dalaman, bahagian enjin dan bawah kereta. Kalau gambar nampak mencurigakan, tak payah buang masa pergi tengok.',
        },
      },
      {
        '@type': 'Question',
        name: 'Apa yang perlu diperiksa semasa tengok kereta terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Buat enam pemeriksaan: luaran (lebih kurang 5 minit), dalaman (10 minit), bahagian enjin (5 minit), ujian elektrik (3 minit), test drive (15 minit), dan bawah kereta (5 minit).',
        },
      },
      {
        '@type': 'Question',
        name: 'Apa tanda bahaya paling besar bila beli kereta terpakai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Berundur kalau anda jumpa bau hapak atau berkulat (tanda banjir), minyak enjin berbuih (air dalam enjin), lampu check engine menyala, transmisi berdentum, karat teruk di bawah kereta yang masih muda, penjual yang tak benarkan test drive, harga RM5,000 atau lebih bawah pasaran, atau penjual yang enggan benarkan pemeriksaan bebas.',
        },
      },
      {
        '@type': 'Question',
        name: 'Apa patut saya buat selepas tengok kereta?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kalau anda masih berminat, buat pemeriksaan bebas dan tunggu laporannya sebelum berunding. Guna harga pasaran bersama hasil pemeriksaan sebagai asas rundingan. Jangan buat keputusan ikut perasaan — fikir dulu semalaman, dan berundur kalau anda masih ragu-ragu.',
        },
      },
    ],
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div>
      <h1 className="text-4xl font-bold mb-6">Senarai Semak Penuh: Apa Nak Periksa Bila Beli Kereta Terpakai</h1>
      <p className="text-lg text-[#6B7280] mb-6">Senarai semak pembeli berpengalaman. Print dan bawa setiap kali pergi tengok kereta.</p>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-6 mb-8">
        <p className="font-semibold text-[#3D472F] mb-2">Peraturan Utama</p>
        <p className="text-[#374151]">Kalau ada apa-apa yang rasa tak kena, berundur. Kereta lain sentiasa ada.</p>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Sebelum Pergi Tengok (Melalui Telefon)</h2>
        <div className="space-y-3 text-[#374151]">
          <p>Sebelum anda pergi tengok kereta:</p>
          <div className="bg-[#F9FAFB] p-4 rounded space-y-2">
            <p>☐ Tanya penjual: "Berapa orang pemilik sebelum ni?" (1–2 orang = bagus)</p>
            <p>☐ Tanya: "Pernah accident atau kena banjir?" (perhatikan kalau teragak-agak)</p>
            <p>☐ Hantar link iklan itu → semak harga pasaran (tahu harga sebenar)</p>
            <p>☐ Minta gambar ruang dalaman, bahagian enjin dan bawah kereta</p>
            <p>☐ Kalau gambar nampak mencurigakan → tak payah buang masa</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Semasa Tengok Kereta</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">1. Pemeriksaan Luaran (5 minit)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Kesamaan cat: Raba panel dengan tangan. Kalau tak rata = pernah dicat semula (pernah accident?)</p>
              <p>☐ Karat pada badan: Tengok bawah pintu, ruang tayar, sekitar but</p>
              <p>☐ Bunga tayar: Kalau dah nipis, kena tukar tak lama lagi (RM400–600)</p>
              <p>☐ Lampu: Uji semua lampu depan, belakang dan brek</p>
              <p>☐ Cermin tingkap: Semua boleh naik turun dengan lancar?</p>
              <p>☐ Kemek dan calar: Ambil gambar untuk rundingan nanti</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">2. Pemeriksaan Dalaman (10 minit)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Bau: Hapak atau berkulat = tanda banjir (berundur)</p>
              <p>☐ Kusyen: Koyak, kotor, berbau. Berapa kos nak baiki? (RM1000+)</p>
              <p>☐ Papan pemuka: Ada retak? Pudar sebab matahari itu biasa ikut umur</p>
              <p>☐ Stereng: Patut rasa kukuh, tidak longgar</p>
              <p>☐ Tempat duduk: Boleh laras semua arah? Tempat duduk elektrik berfungsi?</p>
              <p>☐ Pedal: Rasa brek dan klac (jangan terlalu lembik)</p>
              <p>☐ Alas kaki: Basah? (tanda bocor atau tumpahan)</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">3. Pemeriksaan Bahagian Enjin (5 minit)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Dipstick minyak: Patut coklat, bukan hitam atau berbuih (berbuih = air dalam enjin)</p>
              <p>☐ Warna coolant: Patut merah jambu atau hijau, bukan coklat berkarat</p>
              <p>☐ Bateri: Masih asal? Terminal berkarat?</p>
              <p>☐ Tali sawat dan hos: Ada retak yang nampak?</p>
              <p>☐ Kesan karat: Karat permukaan sikit tak mengapa. Karat teruk = kurang dijaga</p>
              <p>☐ Kebocoran minyak: Cari titisan. Kesan kecil biasa; kalau bertakung = teruk</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">4. Ujian Elektrik (3 minit)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Radio: Berfungsi? (kos ganti RM300–1000)</p>
              <p>☐ Aircond: Sejuk? (isi gas: RM150–250)</p>
              <p>☐ Cermin tingkap elektrik: Kesemua 4 berfungsi?</p>
              <p>☐ Kunci pintu: Semua pintu boleh kunci dan buka?</p>
              <p>☐ Wiper: Air tersembur? Bilah masih elok?</p>
              <p>☐ Lampu papan pemuka: Semak lampu ABS, enjin, airbag (patut padam)</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">5. Test Drive (15 minit)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Start enjin sejuk: Patut hidup terus, tiada bunyi kasar</p>
              <p>☐ Transmisi: Tukar gear lancar (tiada bunyi berdentum untuk auto)</p>
              <p>☐ Stereng: Tidak bergegar pada laju highway. Semak alignment (menarik ke kiri/kanan?)</p>
              <p>☐ Brek: Makan secara sekata, tiada bunyi mencicit atau menggeser</p>
              <p>☐ Pecutan: Lancar, tiada tersekat. Uji naik bukit (tak patut termengah)</p>
              <p>☐ Suspensi: Tiada bunyi berdentum bila lalu bonggol. Perjalanan patut lembut</p>
              <p>☐ Dengar bunyi pelik: Tik-tik, menggeser, mengetuk = ada masalah</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">6. Pemeriksaan Bawah Kereta (5 minit)</h3>
            <div className="space-y-2 text-[#374151]">
              <p>☐ Minta izin penjual untuk tengok bawah kereta</p>
              <p>☐ Periksa bolt: Bolt berkarat pada kereta muda = banjir atau kurang dijaga</p>
              <p>☐ Lumpur dan habuk (biasa) berbanding karat (tak elok)</p>
              <p>☐ Paip ekzos: Patut elok, tidak tergantung atau bergesel</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-6">
        <h3 className="font-semibold text-[#991B1B] mb-4">🚩 TANDA BAHAYA: BERUNDUR</h3>
        <ul className="space-y-2 text-[#374151]">
          <li>❌ Bau hapak atau berkulat (tanda banjir)</li>
          <li>❌ Minyak enjin berbuih (air dalam enjin)</li>
          <li>❌ Lampu check engine menyala (masalah yang diabaikan)</li>
          <li>❌ Transmisi berdentum (masalah CVT/auto yang mahal)</li>
          <li>❌ Karat teruk di bawah kereta yang masih muda (banjir/accident)</li>
          <li>❌ Penjual tak benarkan test drive (ada yang disembunyikan)</li>
          <li>❌ Harga RM5k+ bawah pasaran (selalunya ada kerosakan tersembunyi)</li>
          <li>❌ Penjual enggan benarkan pemeriksaan bebas (tanda bahaya paling besar)</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Selepas Tengok Kereta</h2>
        <div className="space-y-3 text-[#374151]">
          <p>☐ Kalau berminat, buat semakan rekod accident &amp; claim insurans</p>
          <p>☐ Tunggu keputusan semakan sebelum mula berunding</p>
          <p>☐ Guna harga pasaran + hasil semakan sebagai asas rundingan</p>
          <p>☐ Jangan putuskan ikut perasaan. Fikir semalaman. Berundur kalau ragu-ragu.</p>
        </div>
      </section>

        <FaqGetValuationCta faqSlug="what-to-check-buying-used-car" />
    </div>
    </>
  )
}
