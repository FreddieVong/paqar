import { historyAddOnStatusLine } from '@/lib/history-addon-copy'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { organizationSchema, whatsappUrl } from '@/lib/site'
import { BRAND_OG_ALT } from '@/lib/seo/page-metadata'

export const metadata: Metadata = {
  title: 'Tentang Paqar — Semak Harga Kereta Terpakai Malaysia',
  description: 'Paqar membantu pembeli kereta terpakai Malaysia semak harga pasaran, dapatkan laporan pembeli, dan semak rekod claim insurans sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/tentang' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: BRAND_OG_ALT }],
      locale: 'ms_MY',
    title: 'Tentang Paqar — Semak Harga Kereta Terpakai Malaysia',
    description: 'Paqar membantu pembeli kereta terpakai Malaysia semak harga pasaran, dapatkan laporan pembeli, dan semak rekod claim insurans sebelum bayar deposit.',
    url: 'https://paqar.my/tentang',
  },
}

export default function TentangPage() {
  const contactHref = whatsappUrl('Hai Paqar, saya ada soalan.')
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Tentang Paqar',
    url: 'https://paqar.my/tentang',
    description: 'Paqar membantu pembeli kereta terpakai Malaysia semak harga pasaran, dapatkan laporan pembeli, dan semak rekod claim insurans sebelum bayar deposit.',
    mainEntity: {
      ...organizationSchema(),
      areaServed: { '@type': 'Country', name: 'Malaysia' },
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Tentang Paqar
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Apa itu Paqar?
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Paqar dikendalikan oleh TENTEC SDN BHD. Kami menyemak satu iklan kereta terpakai untuk anda, dan beritahu apa patut anda buat sebelum bayar deposit — harga pasaran, sasaran rundingan, soalan untuk penjual dan apa yang perlu disahkan. Setiap laporan dibaca oleh manusia sebelum dihantar.
            </p>
          </div>

          {/* What Paqar does */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-4">
            <h2 className="font-heading font-bold text-[16px] text-[#111827]">Apa yang Paqar buat</h2>

            <div>
              <p className="font-heading font-bold text-[13px] text-[#3D472F] mb-1">Semakan awal — sebelum bayar</p>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Masukkan jenama, model, tahun dan harga penjual. Paqar beritahu sama ada kami ada cukup iklan setanding untuk membuat keputusan tentang kereta itu. Kalau tidak ada, kami tidak jual laporan.
              </p>
            </div>

            <div>
              <p className="font-heading font-bold text-[13px] text-[#3D472F] mb-1">Laporan Pembeli — RM29</p>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Satu bayaran, satu kereta. Kami beritahu sama ada patut diteruskan, berapa patut anda tawar, apa yang perlu ditanya penjual, dan apa yang perlu disemak sebelum bayar deposit. Setiap laporan dibaca oleh orang kami sebelum dihantar — biasanya dalam 30 minit.
              </p>
            </div>

            <div>
              <p className="font-heading font-bold text-[13px] text-[#3D472F] mb-1">{historyAddOnStatusLine()}</p>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Semakan rekod claim insurans untuk kereta yang anda minat — own damage, banjir, windscreen atau total loss jika direkodkan. Sesuai digunakan sebelum bayar deposit.
              </p>
            </div>
          </div>

          {/* Data sources */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[16px] text-[#111827] mb-3">Sumber data</h2>
            <ul className="space-y-2.5">
              {[
                { label: 'Harga pasaran', detail: 'Berdasarkan data listing kereta terpakai semasa dari platform listing Malaysia. Dikira berdasarkan model, tahun, dan varian yang serupa.' },
                { label: 'Maklumat kenderaan', detail: 'Jika anda beri nombor plat, Paqar semak maklumat pendaftaran — tahun daftar, kapasiti enjin, jenis badan dan nombor rangka — dan bandingkan dengan apa yang penjual iklankan. Tanpa plat, semakan ini tidak dijalankan.' },
                { label: 'Rekod claim insurans', detail: 'Data tuntutan insurans dari pangkalan data pihak ketiga. Hanya rekod yang dihantar kepada sistem insurans yang direkodkan.' },
              ].map(item => (
                <li key={item.label}>
                  <p className="font-heading font-bold text-[13px] text-[#111827]">{item.label}</p>
                  <p className="font-body text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* What Paqar does NOT do */}
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#B91C1C] mb-3">
              Apa yang Paqar tidak buat
            </h2>
            <ul className="space-y-2">
              {[
                'Paqar bukan platform kerajaan — tidak berkaitan dengan JPJ, PDRM, atau mana-mana agensi rasmi.',
                'Paqar tidak mengesahkan bacaan odometer atau mileage sebenar.',
                'Tidak semua kemalangan ada rekod claim insurans — pemilik yang baiki sendiri tidak meninggalkan rekod.',
                'Rekod claim bersih tidak menjamin kereta tiada isu — inspection fizikal tetap diperlukan.',
                'Harga pasaran adalah anggaran berdasarkan data semasa — bukan harga tetap atau jaminan.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 font-body text-[13px] text-[#374151]">
                  <span className="text-[#DC2626] flex-shrink-0 font-bold">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact — rendered only when a channel actually receives messages.
              The previous mailto pointed at hello@paqar.my, which has no MX
              record, so every "contact us" here silently failed. */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[16px] text-[#111827] mb-3">Hubungi kami</h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Ada soalan, maklum balas, atau isu dengan laporan anda?
            </p>
            {contactHref ? (
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-heading font-bold text-[14px] text-[#3D472F] underline underline-offset-2"
              >
                WhatsApp Paqar →
              </a>
            ) : (
              // Points at the social row in the footer, which is real and on
              // every page. Naming a channel we do not have would repeat the
              // hello@paqar.my mistake in a new form.
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                Hubungi kami melalui saluran media sosial rasmi Paqar yang disenaraikan di bahagian bawah laman web ini.
              </p>
            )}
          </div>

          {/* Links */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Laman utama</p>
            <Link href="/" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Hantar iklan kereta untuk disemak →</Link>
            <Link href="/laporan-pembeli-kereta-terpakai" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Laporan Pembeli RM29 →</Link>
                        <Link href="/contoh-laporan" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Contoh laporan →</Link>
            <Link href="/privasi" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Dasar privasi →</Link>
            <Link href="/terma" className="block font-body text-[13px] text-[#3D472F] underline underline-offset-2">Terma penggunaan →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
