import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Cara Beli Kereta Terpakai Malaysia 2025 — Panduan Lengkap | Paqar',
  description: 'Panduan lengkap cara beli kereta terpakai Malaysia. Dari semak saman, geran, pinjaman, hingga bayar deposit dengan selamat. Elak tertipu.',
}

export default function CaraBelihKeretaTerpakaiPage() {
  return (
    <>
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
              Beli kereta terpakai boleh jimat puluhan ribu ringgit — tapi risiko tersembunyi boleh membuatkan anda rugi lebih banyak. Ikut panduan ini untuk lindungi diri anda.
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
          <div className="bg-[#064E4A] rounded-[16px] p-5 text-center">
            <p className="font-heading font-extrabold text-[18px] text-white mb-2">
              Nak beli kereta terpakai?
            </p>
            <p className="font-body text-[13px] text-white/70 mb-4 leading-relaxed">
              Masukkan nombor plat, dapatkan panduan saman rasmi dan laporan pembeli lengkap — anggaran harga, soalan penjual, dan skrip rundingan.
            </p>
            <Link
              href="/"
              className="block bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 hover:bg-yellow-300 transition-colors"
            >
              Semak Kereta — RM29 →
            </Link>
            <p className="font-body text-[11px] text-white/40 mt-2">Panduan saman percuma · Laporan penuh RM29</p>
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
