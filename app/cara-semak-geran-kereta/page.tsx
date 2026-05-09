import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Cara Semak Geran Kereta Malaysia 2025 — Panduan Lengkap | Paqar',
  description: 'Cara semak geran kereta Malaysia — apa yang perlu disemak, cara baca geran, tanda-tanda geran palsu, dan cara lindungi diri semasa beli kereta terpakai.',
}

export default function CaraSemakGeranKeretaPage() {
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
              Cara semak geran kereta Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Geran (VOC — Vehicle Ownership Certificate) adalah dokumen paling penting dalam urusan jual beli kereta. Ketahui cara membaca dan menyemak geran dengan betul.
            </p>
          </div>

          {/* What is geran */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">Apa itu geran kereta?</h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Geran atau VOC (Vehicle Ownership Certificate) adalah dokumen rasmi JPJ yang membuktikan siapa pemilik sah sesebuah kenderaan. Ia mengandungi maklumat lengkap tentang kenderaan dan pemiliknya.
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-1">
              <p className="font-heading font-bold text-[12px] text-[#111827] mb-2">Maklumat dalam geran:</p>
              {[
                'Nama dan nombor IC pemilik',
                'Nombor plat pendaftaran',
                'Jenis dan model kenderaan',
                'Warna kenderaan',
                'Nombor enjin',
                'Nombor casis (VIN)',
                'Tarikh pendaftaran pertama',
                'Catatan cagaran bank (jika ada)',
              ].map((item, i) => (
                <p key={i} className="font-body text-[12px] text-[#6B7280]">• {item}</p>
              ))}
            </div>
          </div>

          {/* How to check */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-4">Cara semak geran dengan betul</h2>
            <div className="space-y-4">
              {[
                {
                  n: '1',
                  title: 'Minta tengok geran ASAL',
                  desc: 'Jangan terima salinan sahaja. Penjual perlu tunjukkan geran asal. Geran asal ada teks emboss, watermark, dan mempunyai tekstur kertas khas.',
                },
                {
                  n: '2',
                  title: 'Semak nama pemilik',
                  desc: 'Nama dalam geran mesti sama dengan nama dalam IC penjual. Kalau nama lain, tanya kenapa dan minta dokumen sokongan (surat kuasa, surat pusaka, dll).',
                },
                {
                  n: '3',
                  title: 'Padankan nombor enjin dan casis',
                  desc: 'Cari nombor enjin (biasanya pada blok enjin) dan nombor casis (biasanya pada dashboard atau bawah bonet). Bandingkan dengan nombor dalam geran — mesti sama persis.',
                },
                {
                  n: '4',
                  title: 'Semak catatan cagaran',
                  desc: 'Kalau ada nama bank dalam bahagian "Cagaran" atau "Encumbrance", bermakna kereta masih ada pinjaman aktif. Penjual perlu selesaikan dahulu atau dapatkan surat kelulusan bank.',
                },
                {
                  n: '5',
                  title: 'Semak tarikh geran',
                  desc: 'Geran yang terlalu lama mungkin sudah ada pindah milik yang tidak dicatatkan. Pastikan geran mencerminkan keadaan terkini kenderaan.',
                },
              ].map((step) => (
                <div key={step.n} className="flex gap-3">
                  <div className="w-7 h-7 bg-[#064E4A] rounded-lg flex items-center justify-center font-heading font-extrabold text-[12px] text-white flex-shrink-0 mt-0.5">
                    {step.n}
                  </div>
                  <div>
                    <p className="font-heading font-bold text-[14px] text-[#111827] mb-0.5">{step.title}</p>
                    <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warning signs */}
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#B91C1C] mb-3">
              Tanda-tanda geran bermasalah
            </h2>
            <ul className="space-y-2.5">
              {[
                { sign: 'Penjual tidak mahu tunjukkan geran asal', action: 'Jangan teruskan.' },
                { sign: 'Nama dalam geran bukan nama penjual', action: 'Tanya sebab. Minta dokumen sokongan.' },
                { sign: 'Nombor enjin/casis tidak sama dengan geran', action: 'Mungkin kereta curi atau enjin ditukar haram. Jangan beli.' },
                { sign: 'Ada nama bank dalam bahagian cagaran', action: 'Pastikan pinjaman diselesaikan sebelum bayar apa-apa.' },
                { sign: 'Geran kelihatan lusuh, teks pudar, atau ada tanda penyuntingan', action: 'Geran mungkin dipalsukan. Semak dengan JPJ.' },
              ].map((item, i) => (
                <li key={i} className="space-y-0.5">
                  <p className="font-heading font-bold text-[13px] text-[#111827]">✕ {item.sign}</p>
                  <p className="font-body text-[12px] text-[#6B7280]">→ {item.action}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Verify with JPJ */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[17px] text-[#111827] mb-3">
              Sahkan dengan JPJ secara rasmi
            </h2>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-3">
              Kalau anda syak tentang kesahihan geran, anda boleh semak terus dengan JPJ sebelum membuat apa-apa pembayaran.
            </p>
            <div className="space-y-2">
              <div className="bg-[#F9FAFB] rounded-lg p-3">
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-1">Portal JPJ</p>
                <a href="https://public.jpj.gov.my" target="_blank" rel="noopener noreferrer" className="font-body text-[12px] text-[#1D4ED8] underline underline-offset-2">
                  public.jpj.gov.my →
                </a>
              </div>
              <div className="bg-[#F9FAFB] rounded-lg p-3">
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-1">Pergi terus ke pejabat JPJ</p>
                <p className="font-body text-[12px] text-[#6B7280]">Bawa geran asal dan IC anda. Kakitangan JPJ boleh sahkan kesahihan dokumen.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-[#064E4A] rounded-[16px] p-5 text-center">
            <p className="font-heading font-extrabold text-[18px] text-white mb-2">
              Dah semak geran?
            </p>
            <p className="font-body text-[13px] text-white/70 mb-4 leading-relaxed">
              Langkah seterusnya: semak saman dan dapatkan laporan pembeli lengkap sebelum bayar deposit.
            </p>
            <Link
              href="/"
              className="block bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-[12px] py-4 hover:bg-yellow-300 transition-colors"
            >
              Semak Kereta — RM29 →
            </Link>
          </div>

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/panduan-semak-saman" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara semak saman PDRM dan JPJ →</Link>
            <Link href="/risiko-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
