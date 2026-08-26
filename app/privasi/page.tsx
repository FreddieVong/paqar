import type { Metadata } from 'next'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { whatsappUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Dasar Privasi | Paqar',
  description: 'Dasar privasi Paqar — bagaimana kami mengumpul, menggunakan, dan melindungi data anda di bawah PDPA Malaysia.',
  alternates: { canonical: 'https://paqar.my/privasi' },
  openGraph: {
      images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
      locale: 'ms_MY',
    title: 'Dasar Privasi | Paqar',
    description: 'Dasar privasi Paqar — bagaimana kami mengumpul, menggunakan, dan melindungi data anda di bawah PDPA Malaysia.',
    url: 'https://paqar.my/privasi',
  },
}

export default function PrivasiPage() {
  // PDPA gives users a right to request access, correction and deletion, so
  // this page must name a channel that works. hello@paqar.my does not receive
  // mail, which made the stated right unexercisable in practice.
  const contactHref = whatsappUrl('Hai Paqar, saya ada pertanyaan berkaitan privasi / PDPA.')
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-8 pb-16 max-w-xl mx-auto space-y-8">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
              Dasar Privasi
            </p>
            <h1 className="font-heading font-extrabold text-[26px] tracking-tight text-[#111827] mb-2">
              Privasi Anda
            </h1>
            <p className="font-body text-[13px] text-[#9CA3AF]">
              Dikemaskini: Ogos 2026
            </p>
          </div>

          {[
            {
              title: 'Siapa Kami',
              body: 'Paqar adalah perkhidmatan semakan status kenderaan pihak ketiga yang beroperasi di Malaysia. Kami bukan platform rasmi kerajaan dan tidak berafiliasi dengan PDRM, JPJ, AES, atau mana-mana agensi kerajaan.',
            },
            {
              title: 'Data Yang Kami Kumpul',
              body: 'Bergantung kepada apa yang anda hantar: link iklan kereta, screenshot iklan, butiran kenderaan yang kami baca daripadanya (jenama, model, tahun, harga yang penjual minta, jarak tempuh), nombor plat jika anda beri (pilihan), apa yang anda risaukan tentang kereta itu, alamat e-mel dan nombor telefon untuk menghantar laporan, status pembayaran dan laporan, serta maklum balas anda. Nombor plat disulitkan menggunakan AES-256-GCM sebelum disimpan — kami tidak menyimpannya dalam teks biasa.',
            },
            {
              title: 'Laporan Anda Dibaca Oleh Manusia',
              body: 'Setiap laporan disemak oleh seorang pekerja Paqar sebelum dihantar kepada anda. Untuk berbuat demikian, mereka membuka link iklan dan screenshot yang anda hantar, dan melihat butiran kenderaan serta apa yang anda tulis. Ini adalah sebahagian daripada perkhidmatan yang anda bayar, bukan pemprosesan tambahan.',
            },
            {
              title: 'Cara Kami Menggunakan Data Anda',
              // "menghantar notifikasi tamat tempoh dokumen" described the
              // roadtax/insurance reminder product, which Paqar no longer
              // sells. A privacy notice naming a purpose the service does not
              // have is not a harmless leftover: it is the document that says
              // what the data may be used for.
              body: 'Data yang dikumpul digunakan semata-mata untuk menyiapkan laporan yang anda beli, menghantar laporan dan resit pembayaran kepada anda, dan menghubungi anda berkaitan laporan itu. Kami tidak menggunakan data anda untuk tujuan lain tanpa memberitahu anda terlebih dahulu.',
            },
            {
              title: 'Siapa Menerima Data Anda',
              body: 'Kami tidak menjual atau menyewakan data peribadi anda. Pembekal yang memproses data bagi pihak kami: Supabase (pangkalan data dan storan screenshot), Vercel (pengehosan), Resend (e-mel), Billplz (pembayaran — mereka mengendalikan butiran kad atau bank anda, bukan kami), Anthropic (membaca screenshot iklan secara automatik untuk mengeluarkan butiran kereta), pembekal data pihak ketiga untuk maklumat pendaftaran kenderaan apabila anda beri nombor plat, dan — hanya jika anda membeli Semakan Accident/Claim Insurans — JomCheck (eAuto Asia), yang mencari rekod tuntutan insurans mengikut nombor pendaftaran kenderaan itu. Nombor plat dihantar kepada pembekal berkenaan hanya untuk membuat semakan tersebut. Nombor telefon, jika anda beri, digunakan hanya supaya kami boleh hubungi anda tentang laporan anda apabila perlu — laporan itu sendiri dihantar melalui e-mel dan pautan laporan anda.',
            },
            {
              title: 'Pengukuran & Pengiklanan',
              body: 'Laman ini memuatkan Google Analytics, Google Ads, Meta Pixel dan PostHog untuk memahami cara orang menggunakan Paqar dan keberkesanan iklan kami. Halaman laporan, checkout dan admin dikecualikan: Meta Pixel tidak dimuatkan langsung di situ, dan kod token laporan anda dibuang daripada setiap alamat sebelum dihantar kepada mana-mana alat pengukuran. PostHog boleh merakam sesi pelayaran; semua medan input ditutup (masked) dan tidak dirakam. Anda boleh menyekat semua ini dengan tetapan penyekat penjejakan pada pelayar anda.',
            },
            {
              title: 'Perkhidmatan Rakan Kongsi',
              body: 'Kami memaut kepada perkhidmatan pihak ketiga untuk pemeriksaan fizikal dan perbandingan insurans. Apabila anda klik pautan itu, anda meninggalkan Paqar dan tertakluk kepada dasar privasi mereka. Kami mungkin menerima komisen rujukan. Kami tidak menghantar data anda kepada mereka — anda yang mengisi maklumat di laman mereka.',
            },
            {
              title: 'Berapa Lama Kami Simpan',
              body: 'Screenshot yang anda hantar tetapi tidak bayar dipadam selepas 24 jam. Screenshot bagi laporan yang dibayar dipadam selepas 30 hari — ia adalah bukti yang menyokong keputusan yang anda bayar. Pemadaman ini dijalankan secara automatik setiap hari, fail dahulu kemudian rekod, supaya tiada fail tertinggal. Butiran laporan dan rekod pembayaran disimpan lebih lama untuk perakaunan. Anda boleh meminta penghapusan data anda pada bila-bila masa dengan menghubungi kami.',
            },
            {
              title: 'Keselamatan',
              body: 'Kami menggunakan penyulitan AES-256-GCM untuk data sensitif, HTTPS untuk semua komunikasi, dan kawalan akses berasaskan peranan untuk pangkalan data. Walaupun demikian, tiada sistem yang 100% selamat — kami menggalakkan anda untuk tidak berkongsi maklumat log masuk anda.',
            },
            {
              title: 'Hak Anda di Bawah PDPA',
              body: `Di bawah Akta Perlindungan Data Peribadi 2010 (PDPA), anda berhak untuk mengakses data peribadi anda, meminta pembetulan data yang tidak tepat, dan meminta penghapusan data anda. ${
                contactHref
                  ? 'Hubungi kami melalui WhatsApp untuk membuat permintaan ini.'
                  : 'Hubungi kami melalui saluran media sosial rasmi Paqar yang disenaraikan di bahagian bawah laman web ini untuk membuat permintaan ini.'
              }`,
            },
            {
              title: 'Hubungi Kami',
              body: contactHref
                ? 'Untuk sebarang pertanyaan berkaitan privasi, hubungi kami melalui WhatsApp.'
                : 'Untuk sebarang pertanyaan berkaitan privasi, hubungi kami melalui saluran media sosial rasmi Paqar yang disenaraikan di bahagian bawah laman web ini.',
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
