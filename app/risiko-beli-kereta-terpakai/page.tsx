import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Risiko Beli Kereta Terpakai Malaysia — Cara Elak Tertipu | Paqar',
  description: 'Risiko utama beli kereta terpakai di Malaysia — saman tersembunyi, odometer diputar, banjir, kemalangan, dan pinjaman aktif. Cara lindungi diri anda.',
}

const RISKS = [
  {
    title: 'Saman tersembunyi',
    severity: 'Tinggi',
    severityColor: 'bg-[#FEE2E2] text-[#B91C1C]',
    desc: 'Penjual tidak dedahkan ada saman PDRM atau JPJ yang belum dibayar. Saman yang tidak selesai boleh menyukarkan proses tukar milik dan jadi tanggungan pembeli.',
    protect: 'Semak saman di mybayar.rmp.gov.my dan public.jpj.gov.my. Minta penjual tunjukkan bukti tiada saman sebelum bayar deposit.',
  },
  {
    title: 'Odometer diputar (clocking)',
    severity: 'Tinggi',
    severityColor: 'bg-[#FEE2E2] text-[#B91C1C]',
    desc: 'Bacaan kilometer dipalsukan supaya kelihatan lebih rendah. Kereta dengan jarak tempuh sebenar 200,000 km dijual seolah-olah 80,000 km — nilai lebih tinggi, masalah tersembunyi.',
    protect: 'Bandingkan bacaan odometer dengan rekod servis. Tanda: servis stamp tidak konsisten dengan bacaan semasa. Bawa ke bengkel untuk semak.',
  },
  {
    title: 'Kereta banjir (flood car)',
    severity: 'Tinggi',
    severityColor: 'bg-[#FEE2E2] text-[#B91C1C]',
    desc: 'Kereta yang pernah dilanda banjir boleh kelihatan baik selepas dibersihkan, tapi kerosakan elektrikal dan karat dalaman akan muncul kemudian — kos baik pulih sangat tinggi.',
    protect: 'Cium bau kereta — bau busuk atau lembap tanda banjir. Semak bawah carpet, dalam boot, dan bahagian bawah dashboard untuk tanda karat atau kelembapan.',
  },
  {
    title: 'Kemalangan teruk dan tampalan',
    severity: 'Sederhana',
    severityColor: 'bg-[#FFFBEB] text-[#B45309]',
    desc: 'Kereta yang pernah terlibat kemalangan serius mungkin ada kerosakan struktur tersembunyi walaupun kelihatan baik selepas dibaiki. Panel yang ditampal boleh berkarat lebih cepat.',
    protect: 'Semak cat — warna tak sekata atau kulit orange peel lebih tebal tanda tampalan. Gunakan magnet — tidak melekat tanda ada filler. Bawa ke bengkel untuk alignment check.',
  },
  {
    title: 'Pinjaman bank aktif',
    severity: 'Sederhana',
    severityColor: 'bg-[#FFFBEB] text-[#B45309]',
    desc: 'Kalau penjual masih ada pinjaman aktif untuk kereta ini, proses tukar milik memerlukan penyelesaian pinjaman dahulu. Kalau penjual lari, pembeli dan bank dalam masalah.',
    protect: 'Minta penjual tunjukkan surat penyelesaian pinjaman atau surat kelulusan bank untuk jual. Jangan bayar deposit sebelum ini diselesaikan.',
  },
  {
    title: 'Geran atas nama orang lain',
    severity: 'Sederhana',
    severityColor: 'bg-[#FFFBEB] text-[#B45309]',
    desc: 'Penjual bukan pemilik sah kereta — mungkin jual kereta atas nama saudara, bekas pasangan, atau orang yang sudah meninggal. Proses tukar milik jadi rumit atau gagal.',
    protect: 'Pastikan nama dalam geran sama dengan IC penjual. Kalau nama lain, tanya kenapa dan minta dokumen sokongan. Kalau tidak memuaskan, jangan teruskan.',
  },
  {
    title: 'Harga tidak adil',
    severity: 'Rendah',
    severityColor: 'bg-[#DCFCE7] text-[#15803D]',
    desc: 'Membayar lebih daripada nilai pasaran kerana tidak tahu harga semasa. Penjual mungkin tambah "nilai sentimen" atau tidak fleksibel kerana tidak tahu harga pasaran juga.',
    protect: 'Semak harga model sama di Mudah, Carlist, dan MyTukar sebelum jumpa penjual. Ada data bermakna ada kuasa untuk berunding.',
  },
]

export default function RisikoBelihKeretaTerpakaiPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Panduan', item: 'https://paqar.my/panduan' },
          { '@type': 'ListItem', position: 3, name: 'Risiko Beli Kereta Terpakai', item: 'https://paqar.my/risiko-beli-kereta-terpakai' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa risiko utama beli kereta terpakai di Malaysia?',
            acceptedAnswer: { '@type': 'Answer', text: '7 risiko utama: saman tersembunyi, odometer diputar (clocking), kereta banjir, kemalangan teruk dan tampalan, pinjaman bank aktif, geran atas nama orang lain, dan harga yang tidak adil.' },
          },
          {
            '@type': 'Question',
            name: 'Bagaimana nak tahu kereta pernah banjir?',
            acceptedAnswer: { '@type': 'Answer', text: 'Cium bau kereta — ada bau busuk atau lembap menandakan banjir. Semak bawah carpet, dalam boot, dan bahagian bawah dashboard untuk tanda karat atau kelembapan. Bawa ke bengkel untuk semak lebih teliti.' },
          },
          {
            '@type': 'Question',
            name: 'Bagaimana elak beli kereta odometer diputar?',
            acceptedAnswer: { '@type': 'Answer', text: 'Bandingkan bacaan odometer dengan rekod servis — stamp tidak konsisten adalah tanda amaran. Bawa ke bengkel untuk pemeriksaan mekanikal menyeluruh sebelum bayar deposit.' },
          },
          {
            '@type': 'Question',
            name: 'Boleh beli kereta kalau penjual masih ada pinjaman aktif?',
            acceptedAnswer: { '@type': 'Answer', text: 'Boleh, tetapi pinjaman perlu diselesaikan dahulu sebelum tukar milik. Minta surat penyelesaian pinjaman atau surat kelulusan bank. Jangan bayar deposit sebelum mendapat dokumen ini.' },
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
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-5">

          {/* Hero */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Pembeli
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Risiko beli kereta terpakai — dan cara elaknya
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Kereta terpakai boleh jimat duit — tapi tanpa semakan yang betul, anda boleh rugi lebih banyak. Kenali risiko ini sebelum buat keputusan.
            </p>
          </div>

          {/* Risk cards */}
          {RISKS.map((risk) => (
            <div key={risk.title} className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="font-heading font-bold text-[16px] text-[#111827]">{risk.title}</h2>
                <span className={`font-heading font-bold text-[10px] px-2 py-1 rounded-full flex-shrink-0 ${risk.severityColor}`}>
                  {risk.severity}
                </span>
              </div>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
                {risk.desc}
              </p>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2.5">
                <p className="font-heading font-bold text-[11px] text-[#15803D] mb-1 uppercase tracking-[.05em]">Cara lindungi diri</p>
                <p className="font-body text-[12px] text-[#374151] leading-relaxed">{risk.protect}</p>
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-3">
              Ingat satu peraturan mudah:
            </p>
            <p className="font-body text-[14px] text-[#374151] leading-relaxed italic">
              &ldquo;Jangan bayar deposit sebelum semua semakan selesai dan anda berpuas hati dengan jawapan penjual.&rdquo;
            </p>
          </div>

          {/* CTA */}
          <div className="bg-[#064E4A] rounded-[16px] p-5 text-center">
            <p className="font-heading font-extrabold text-[18px] text-white mb-2">
              Dah jumpa kereta?
            </p>
            <p className="font-body text-[13px] text-white/70 mb-4 leading-relaxed">
              Semak nombor plat, dapatkan panduan saman rasmi dan laporan pembeli lengkap sebelum bayar deposit.
            </p>
            <Link
              href="/"
              className="block bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 hover:bg-yellow-300 transition-colors"
            >
              Semak Kereta — RM12 →
            </Link>
          </div>

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
            <Link href="/panduan-semak-saman" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak saman kereta →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
