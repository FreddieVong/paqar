import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export default function PrivasiPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-8 pb-16 max-w-xl mx-auto space-y-8">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
              Dasar Privasi
            </p>
            <h1 className="font-heading font-extrabold text-[26px] tracking-tight text-[#111827] mb-2">
              Privasi Anda
            </h1>
            <p className="font-body text-[13px] text-[#9CA3AF]">
              Dikemaskini: Mei 2026
            </p>
          </div>

          {[
            {
              title: 'Siapa Kami',
              body: 'Paqar adalah perkhidmatan semakan status kenderaan pihak ketiga yang beroperasi di Malaysia. Kami bukan platform rasmi kerajaan dan tidak berafiliasi dengan PDRM, JPJ, AES, atau mana-mana agensi kerajaan.',
            },
            {
              title: 'Data Yang Kami Kumpul',
              body: 'Kami mengumpul nombor plat kenderaan untuk menjalankan semakan. Nombor plat disulitkan menggunakan AES-256-GCM sebelum disimpan — kami tidak menyimpan data dalam teks biasa. Kami juga mengumpul alamat e-mel apabila anda membuat akaun atau membuat pembayaran.',
            },
            {
              title: 'Cara Kami Menggunakan Data Anda',
              body: 'Data yang dikumpul digunakan semata-mata untuk menjalankan semakan status kenderaan, menghantar notifikasi tamat tempoh dokumen, menghantar resit pembayaran, dan menghubungi anda berkaitan perkhidmatan kami.',
            },
            {
              title: 'Perkongsian Data',
              body: 'Kami tidak menjual, menyewakan, atau berkongsi data peribadi anda kepada pihak ketiga untuk tujuan pemasaran. Data anda hanya diakses oleh sistem kami dan pembekal perkhidmatan infrastruktur (Supabase untuk pangkalan data, Vercel untuk pengehosan, Resend untuk e-mel).',
            },
            {
              title: 'Penyimpanan Data',
              body: 'Data semakan disimpan selama 30 hari selepas semakan dibuat. Data akaun disimpan selagi akaun anda aktif. Anda boleh meminta penghapusan data anda pada bila-bila masa dengan menghubungi kami.',
            },
            {
              title: 'Keselamatan',
              body: 'Kami menggunakan penyulitan AES-256-GCM untuk data sensitif, HTTPS untuk semua komunikasi, dan kawalan akses berasaskan peranan untuk pangkalan data. Walaupun demikian, tiada sistem yang 100% selamat — kami menggalakkan anda untuk tidak berkongsi maklumat log masuk anda.',
            },
            {
              title: 'Hak Anda di Bawah PDPA',
              body: 'Di bawah Akta Perlindungan Data Peribadi 2010 (PDPA), anda berhak untuk mengakses data peribadi anda, meminta pembetulan data yang tidak tepat, dan meminta penghapusan data anda. Hubungi kami melalui e-mel untuk membuat permintaan ini.',
            },
            {
              title: 'Hubungi Kami',
              body: 'Untuk sebarang pertanyaan berkaitan privasi, hubungi kami di hello@paqar.my.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">{title}</p>
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{body}</p>
            </div>
          ))}

        </div>
      </Shell>
    </>
  )
}
