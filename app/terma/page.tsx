import type { Metadata } from 'next'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { whatsappUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terma & Syarat | Paqar',
  description: 'Terma dan syarat penggunaan perkhidmatan Paqar — semakan status kenderaan pihak ketiga di Malaysia.',
  alternates: { canonical: 'https://paqar.my/terma' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: 'Terma & Syarat | Paqar',
    description: 'Terma dan syarat penggunaan perkhidmatan Paqar — semakan status kenderaan pihak ketiga di Malaysia.',
    url: 'https://paqar.my/terma',
  },
}

export default function TermaPage() {
  // The clause must still tell users how to reach us, but it named
  // hello@paqar.my — an address the domain cannot receive mail on. Pointing a
  // legal contact clause at a dead inbox is worse than describing the channel
  // generically, so the address is gone and the live channel is linked only
  // when one exists.
  const contactHref = whatsappUrl('Hai Paqar, saya ada pertanyaan berkaitan Terma & Syarat.')
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-8 pb-16 max-w-xl mx-auto space-y-8">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
              Terma Penggunaan
            </p>
            <h1 className="font-heading font-extrabold text-[26px] tracking-tight text-[#111827] mb-2">
              Terma &amp; Syarat
            </h1>
            <p className="font-body text-[13px] text-[#9CA3AF]">
              Dikemaskini: Mei 2026
            </p>
          </div>

          {[
            {
              title: 'Perkhidmatan Pihak Ketiga',
              body: 'Paqar adalah perkhidmatan semakan status kenderaan pihak ketiga yang tidak berafiliasi dengan mana-mana agensi kerajaan Malaysia. Maklumat yang dipaparkan bersumber daripada pangkalan data yang boleh diakses awam dan mungkin tidak mencerminkan status terkini pada setiap masa.',
            },
            {
              title: 'Ketepatan Maklumat',
              body: 'Kami berusaha untuk menyediakan maklumat yang tepat, tetapi kami tidak menjamin kesempurnaan atau ketepatan sepenuhnya hasil semakan. Gunakan maklumat ini sebagai panduan sahaja, bukan sebagai keputusan muktamad. Sila sahkan dengan pihak berkuasa berkaitan untuk urusan rasmi.',
            },
            {
              title: 'Penggunaan yang Dibenarkan',
              body: 'Perkhidmatan ini boleh digunakan untuk semakan peribadi status kenderaan anda sendiri atau kenderaan yang anda pertimbangkan untuk dibeli. Penggunaan untuk tujuan komersial secara besar-besaran, pengikisan data automatik, atau sebarang tujuan yang melanggar undang-undang adalah dilarang.',
            },
            {
              title: 'Pembayaran dan Bayaran Balik',
              body: 'Laporan Pembeli (RM29) dikembalikan sepenuhnya jika Paqar tidak dapat menyiapkan laporan untuk kenderaan anda — contohnya apabila tiada cukup iklan setanding untuk membuat keputusan. Setelah laporan disemak dan dilepaskan kepada anda, bayaran adalah muktamad. Jika anda menghadapi masalah teknikal yang menghalang akses kepada laporan anda, hubungi kami dalam masa 7 hari.',
            },
            {
              title: 'Had Liabiliti',
              body: 'Paqar tidak bertanggungjawab atas sebarang kerugian langsung, tidak langsung, atau berbangkit yang timbul daripada penggunaan perkhidmatan ini, termasuk keputusan kewangan yang dibuat berdasarkan hasil semakan kami.',
            },
            {
              title: 'Pengubahsuaian Terma',
              body: 'Kami berhak untuk mengubah terma ini pada bila-bila masa. Perubahan akan dikuatkuasakan setelah disiarkan di halaman ini. Penggunaan berterusan perkhidmatan kami selepas perubahan dianggap sebagai penerimaan terma baharu.',
            },
            {
              title: 'Undang-undang yang Terpakai',
              body: 'Terma ini tertakluk kepada undang-undang Malaysia. Sebarang pertikaian akan diselesaikan di bawah bidang kuasa mahkamah Malaysia.',
            },
            {
              title: 'Hubungi Kami',
              body: contactHref
                ? 'Untuk sebarang pertanyaan berkaitan terma ini, hubungi kami melalui WhatsApp.'
                : 'Untuk sebarang pertanyaan berkaitan terma ini, hubungi kami melalui saluran media sosial rasmi Paqar yang disenaraikan di bahagian bawah laman web ini.',
              href: contactHref,
            },
          ].map(({ title, body, href }) => (
            <div key={title} className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">{title}</p>
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{body}</p>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 font-body text-[13px] text-[#3D472F] font-semibold underline underline-offset-2"
                >
                  WhatsApp Paqar →
                </a>
              )}
            </div>
          ))}

        </div>
      </Shell>
    </>
  )
}
