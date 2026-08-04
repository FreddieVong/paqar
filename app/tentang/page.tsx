import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { organizationSchema, whatsappUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Tentang Paqar — Semak Harga Kereta Terpakai Malaysia',
  description: 'Paqar membantu pembeli kereta terpakai Malaysia semak harga pasaran, dapatkan laporan pembeli, dan semak rekod claim insurans sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/tentang' },
  openGraph: {
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
              Paqar adalah alat untuk pembeli kereta terpakai Malaysia — untuk semak harga pasaran, dapatkan laporan pembeli, dan semak rekod claim insurans sebelum bayar deposit.
            </p>
          </div>

          {/* What Paqar does */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-4">
            <h2 className="font-heading font-bold text-[16px] text-[#111827]">Apa yang Paqar buat</h2>

            <div>
              <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">Semak harga pasaran — percuma</p>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Masukkan model, tahun, dan harga penjual. Paqar semak data listing semasa dan bagi keputusan: murah, wajar, atau mahal — dengan jurang RM dari harga tengah pasaran.
              </p>
            </div>

            <div>
              <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">Laporan Pembeli — RM12</p>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Laporan satu bayaran yang merangkumi keputusan harga, julat pasaran penuh, anggaran trade-in, maklumat kenderaan, skrip rundingan, soalan untuk penjual, dan checklist deposit.
              </p>
            </div>

            <div>
              <p className="font-heading font-bold text-[13px] text-[#064E4A] mb-1">Semakan Accident/Claim Insurans — RM100</p>
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
                { label: 'Maklumat kenderaan', detail: 'Maklumat pendaftaran kenderaan berdasarkan nombor plat — termasuk tahun daftar, kapasiti enjin, jenis badan, dan nombor rangka.' },
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
                className="inline-block font-heading font-bold text-[14px] text-[#064E4A] underline underline-offset-2"
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
            <Link href="/" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semak harga kereta terpakai — percuma →</Link>
            <Link href="/laporan-pembeli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Laporan Pembeli RM12 →</Link>
            <Link href="/semak-accident-claim-insurans-kereta" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semakan Accident/Claim Insurans RM100 →</Link>
            <Link href="/contoh-laporan" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Contoh laporan →</Link>
            <Link href="/privasi" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Dasar privasi →</Link>
            <Link href="/terma" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Terma penggunaan →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
