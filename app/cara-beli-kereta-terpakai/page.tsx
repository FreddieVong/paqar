import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'

const YEAR = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Cara Beli Kereta Terpakai Malaysia ${YEAR} — Panduan Lengkap | Paqar`,
  description: 'Panduan lengkap cara beli kereta terpakai Malaysia. Dari semak saman, geran, pinjaman, hingga bayar deposit dengan selamat. Elak tertipu.',
  alternates: { canonical: 'https://paqar.my/cara-beli-kereta-terpakai' },
  openGraph: {
    title: `Cara Beli Kereta Terpakai Malaysia ${YEAR} — Panduan Lengkap`,
    description: 'Panduan lengkap cara beli kereta terpakai Malaysia. Dari semak saman, geran, pinjaman, hingga bayar deposit dengan selamat. Elak tertipu.',
    url: 'https://paqar.my/cara-beli-kereta-terpakai',
    images: [{ url: '/api/og?title=Cara%20Beli%20Kereta%20Terpakai&subtitle=6%20langkah%20beli%20dengan%20selamat', width: 1200, height: 630 }],
  },
}

export default function CaraBelihKeretaTerpakaiPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Panduan', item: 'https://paqar.my/panduan' },
          { '@type': 'ListItem', position: 3, name: 'Cara Beli Kereta Terpakai', item: 'https://paqar.my/cara-beli-kereta-terpakai' },
        ],
      },
      {
        '@type': 'Article',
        headline: 'Cara Beli Kereta Terpakai Malaysia dengan Selamat',
        description: 'Panduan lengkap cara beli kereta terpakai Malaysia. Dari semak saman, geran, pinjaman, hingga bayar deposit dengan selamat.',
        author: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        publisher: { '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' },
        datePublished: '2025-05-01',
        url: 'https://paqar.my/cara-beli-kereta-terpakai',
      },
      {
        '@type': 'HowTo',
        name: 'Cara Beli Kereta Terpakai Malaysia',
        description: '6 langkah untuk beli kereta terpakai dengan selamat di Malaysia — dari semak saman hingga tukar milik.',
        step: [
          { '@type': 'HowToStep', position: 1, name: 'Semak saman kenderaan', text: 'Minta nombor plat dari penjual. Semak saman PDRM di mybayar.rmp.gov.my dan saman JPJ di public.jpj.gov.my.' },
          { '@type': 'HowToStep', position: 2, name: 'Semak geran dan hak milik', text: 'Pastikan nama dalam geran sama dengan IC penjual. Semak nombor enjin dan casis sama dengan geran. Pastikan tiada catatan cagaran bank.' },
          { '@type': 'HowToStep', position: 3, name: 'Semak pinjaman bank aktif', text: 'Minta penjual tunjukkan surat penyelesaian pinjaman atau kelulusan bank untuk jual sebelum bayar apa-apa.' },
          { '@type': 'HowToStep', position: 4, name: 'Semak kondisi fizikal', text: 'Semak cat, bonet, dan bawah kereta. Buat test drive dan bawa ke bengkel untuk inspection profesional.' },
          { '@type': 'HowToStep', position: 5, name: 'Semak harga pasaran', text: 'Guna Paqar untuk dapat keputusan harga percuma atau Laporan Pembeli RM12 dengan skrip rundingan. Tambah Semakan Accident/Claim Insurans RM100 untuk semak rekod claim.' },
          { '@type': 'HowToStep', position: 6, name: 'Bayar deposit dengan betul', text: 'Bayar deposit hanya selepas semua semakan selesai. Pastikan perjanjian jual beli bertulis dengan syarat refund yang jelas.' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Berapa langkah untuk beli kereta terpakai dengan selamat di Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: 'Ada 6 langkah utama: (1) semak saman, (2) semak geran dan hak milik, (3) semak pinjaman bank, (4) inspection fizikal di bengkel, (5) semak insurans dan roadtax, (6) tukar milik di JPJ.' },
          },
          {
            '@type': 'Question',
            name: 'Boleh bayar deposit sebelum semak saman kereta?',
            acceptedAnswer: { '@type': 'Answer', text: 'Tidak disyorkan. Semak saman dahulu — kalau ada saman, penjual perlu selesaikan sebelum tukar milik, atau anda boleh tolak jumlahnya dari harga. Bayar deposit dulu memberikan kuasa tawar menawar kepada penjual.' },
          },
          {
            '@type': 'Question',
            name: 'Berapa lama proses tukar milik kereta di Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: 'Biasanya 1-3 hari bekerja di pejabat JPJ jika semua dokumen lengkap dan tiada isu saman atau pinjaman aktif.' },
          },
          {
            '@type': 'Question',
            name: 'Apa dokumen diperlukan untuk beli kereta terpakai Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: 'Geran asal kenderaan, IC penjual dan pembeli, surat perjanjian jual beli, surat penyelesaian pinjaman (jika ada), dan resit bayaran.' },
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
              Panduan Pembeli
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Cara beli kereta terpakai Malaysia dengan selamat
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Paqar membantu pembeli kereta terpakai semak harga pasaran dan dapatkan laporan pembeli sebelum bayar deposit. Panduan ini merangkumi 6 langkah penting dari semak saman hingga tukar milik dengan selamat.
            </p>
          </div>

          {/* Step 1 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[14px] text-white flex-shrink-0">1</div>
              <h2 className="font-heading font-bold text-[16px] text-[#111827]">Semak saman kenderaan</h2>
            </div>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Sebelum buat apa-apa, minta nombor plat kereta dari penjual dan semak status saman. Kalau ada saman, penjual perlu selesaikan sebelum tukar milik — atau tolak dari harga.
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-2">
              <p className="font-heading font-bold text-[12px] text-[#111827]">Cara semak:</p>
              <p className="font-body text-[12px] text-[#6B7280]">• Saman PDRM: mybayar.rmp.gov.my (perlukan log masuk)</p>
              <p className="font-body text-[12px] text-[#6B7280]">• Saman JPJ: public.jpj.gov.my (perlukan log masuk)</p>
              <p className="font-body text-[12px] text-[#6B7280]">• Minta penjual semak dan tunjukkan bukti</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[14px] text-white flex-shrink-0">2</div>
              <h2 className="font-heading font-bold text-[16px] text-[#111827]">Semak geran dan hak milik</h2>
            </div>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Pastikan nama dalam geran adalah nama penjual. Kalau nama lain, tanya kenapa — mungkin ada isu pindah milik yang belum selesai.
            </p>
            <ul className="space-y-1.5">
              {[
                'Minta tengok geran asal (bukan salinan)',
                'Nama dalam geran kena sama dengan IC penjual',
                'Semak nombor enjin dan nombor casis sama dengan geran',
                'Pastikan tiada catatan "cagaran bank" dalam geran',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#064E4A] flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Step 3 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[14px] text-white flex-shrink-0">3</div>
              <h2 className="font-heading font-bold text-[16px] text-[#111827]">Semak pinjaman bank aktif</h2>
            </div>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Kalau penjual masih ada pinjaman aktif untuk kereta ini, proses tukar milik akan lebih rumit dan lambat. Pastikan isu ini selesai sebelum bayar apa-apa.
            </p>
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3">
              <p className="font-heading font-bold text-[12px] text-[#B45309] mb-1">Amaran penting</p>
              <p className="font-body text-[12px] text-[#374151]">Jangan bayar deposit kalau penjual tidak boleh tunjukkan surat penyelesaian pinjaman atau surat kelulusan bank untuk jual.</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[14px] text-white flex-shrink-0">4</div>
              <h2 className="font-heading font-bold text-[16px] text-[#111827]">Semak kondisi fizikal dan sejarah kemalangan</h2>
            </div>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Kereta yang pernah terlibat kemalangan serius mungkin ada kerosakan tersembunyi. Bawa ke bengkel untuk pemeriksaan sebelum commit.
            </p>
            <ul className="space-y-1.5">
              {[
                'Semak cat — warna tak sekata tanda tampalan',
                'Buka bonet — cari tanda karat atau kimpalan baharu',
                'Test drive — dengar bunyi pelik dari enjin atau gear',
                'Bawa ke bengkel untuk inspection profesional',
                'Tanya rekod servis atau buku servis',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#064E4A] flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Step 5 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[14px] text-white flex-shrink-0">5</div>
              <h2 className="font-heading font-bold text-[16px] text-[#111827]">Semak harga pasaran</h2>
            </div>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Sebelum setuju harga, semak berapa kereta model sama dijual di Mudah, Carlist, dan MyTukar. Kalau harga penjual jauh lebih tinggi, ada ruang untuk berunding.
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-1">
              <p className="font-body text-[12px] text-[#6B7280]">• mudah.my — listing paling banyak</p>
              <p className="font-body text-[12px] text-[#6B7280]">• carlist.my — harga dealer dan individu</p>
              <p className="font-body text-[12px] text-[#6B7280]">• mytukar.com — harga guaranteed buyback</p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[14px] text-white flex-shrink-0">6</div>
              <h2 className="font-heading font-bold text-[16px] text-[#111827]">Bayar deposit dengan betul</h2>
            </div>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Deposit bukan sekadar tanda serius — ia tanda anda sudah commit. Pastikan semua syarat ditulis dalam surat perjanjian sebelum bayar.
            </p>
            <ul className="space-y-1.5">
              {[
                'Bayar deposit hanya selepas SEMUA semakan selesai',
                'Minta resit bertulis untuk setiap pembayaran',
                'Tulis dalam perjanjian: syarat refund jika urusan gagal',
                'Jangan bayar cash tanpa saksi',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#DC2626] flex-shrink-0">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Dah jumpa kereta? Semak plat sekarang:
            </p>
            <DualCheckForm />
          </div>

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
            <Link href="/risiko-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
            <Link href="/panduan-semak-saman" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak saman kereta →</Link>
            <Link href="/cara-semak-geran-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak geran kereta →</Link>
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Harga model popular</p>
            <Link href="/harga-kereta-terpakai/perodua-myvi" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua Myvi terpakai →</Link>
            <Link href="/harga-kereta-terpakai/perodua-axia" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Perodua Axia terpakai →</Link>
            <Link href="/harga-kereta-terpakai/proton-saga" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Harga Proton Saga terpakai →</Link>
            <Link href="/bandingkan" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Bandingkan model →</Link>
          </div>

          <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            Paqar adalah perkhidmatan pihak ketiga. Kami bukan ejen kereta atau peguam.
            Maklumat ini adalah panduan sahaja.
          </p>

        </div>
      </Shell>
    </>
  )
}
