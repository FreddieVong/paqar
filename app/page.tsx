import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* ── HERO ── */}
      <section id="semak" className="bg-white px-5 pt-10 pb-12 md:pt-16 md:pb-20">
        <div className="max-w-5xl mx-auto md:grid md:grid-cols-2 md:gap-14 md:items-center">

          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5 mb-5">
              <span className="w-2 h-2 bg-[#16A34A] rounded-full" />
              <span className="font-heading font-bold text-[12px] text-[#15803D]">
                Percuma · Tanpa daftar akaun
              </span>
            </div>

            <h1 className="font-heading font-extrabold text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.03em] text-[#111827] mb-3">
              Semak Sebelum<br />
              <span className="text-[#064E4A]">Bayar Deposit</span>
            </h1>

            <p className="font-body text-[15px] md:text-[16px] text-[#6B7280] leading-relaxed mb-8 md:mb-0">
              Paqar bantu anda faham risiko kereta sebelum beli — panduan saman rasmi, anggaran harga, soalan penjual, dan skrip rundingan.
            </p>

            <p className="hidden md:block font-body text-[13px] text-[#6B7280] mt-6">
              Panduan saman percuma · Laporan penuh RM12 · Tanpa daftar akaun
            </p>
          </div>

          {/* Checking card */}
          <div className="space-y-3">
            <DualCheckForm />
            {/* Free vs RM12 split */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-4">
                <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#15803D] mb-2">
                  Percuma
                </p>
                <ul className="space-y-1.5">
                  {['Panduan semak saman PDRM/JPJ', 'Cara minta penjual buktikan'].map(t => (
                    <li key={t} className="flex gap-2 font-body text-[12px] text-[#374151]">
                      <span className="text-[#15803D] flex-shrink-0">✓</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-[14px] p-4">
                <p className="font-heading font-bold text-[10px] uppercase tracking-[.08em] text-[#B45309] mb-2">
                  Laporan RM12
                </p>
                <ul className="space-y-1.5">
                  {['Data kenderaan rasmi JPJ', 'Status insurans semasa', 'Soalan & skrip rundingan'].map(t => (
                    <li key={t} className="flex gap-2 font-body text-[12px] text-[#374151]">
                      <span className="text-[#B45309] flex-shrink-0">✓</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APA YANG BOLEH DISEMAK ── */}
      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 md:text-center">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
              Apa Yang Anda Boleh Semak
            </p>
            <h2 className="font-heading font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#111827]">
              Semua yang anda perlu tahu sebelum beli
            </h2>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-3 gap-3">
            {[
              { title: 'Panduan Semak Saman', desc: 'Cara semak PDRM & JPJ secara rasmi, step by step', badge: 'Percuma',     badgeStyle: 'bg-[#DCFCE7] text-[#15803D]' },
              { title: 'Laporan Pembeli',    desc: 'Harga pasaran, soalan penjual, skrip rundingan',    badge: 'RM12',        badgeStyle: 'bg-[#FEF9C3] text-[#B45309]' },
              { title: 'Sejarah Kemalangan', desc: 'Rekod kemalangan & tuntutan insurans',              badge: 'Akan Datang', badgeStyle: 'bg-[#F3F4F6] text-[#6B7280]' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 md:p-5">
                <p className="font-heading font-bold text-[15px] text-[#111827] mb-0.5">{item.title}</p>
                <p className="font-body text-[13px] text-[#6B7280] mb-2">{item.desc}</p>
                <span className={`inline-block font-heading font-bold text-[11px] px-2.5 py-1 rounded-full ${item.badgeStyle}`}>
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CARA IA BERFUNGSI ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Cara Ia Berfungsi
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-2">
            Tiga langkah. Satu minit.
          </h2>
          <p className="font-body text-[14px] text-[#6B7280] mb-8">
            Tiada pendaftaran diperlukan untuk semakan pertama anda.
          </p>

          <div className="flex flex-col gap-0">
            {[
              {
                n: '1',
                title: 'Masukkan nombor plat',
                desc:  'Tiada IC diperlukan. Masukkan plat kereta yang anda nak beli.',
              },
              {
                n: '2',
                title: 'Dapatkan panduan saman',
                desc:  'Kami tunjukkan cara semak saman PDRM & JPJ secara rasmi, plus apa yang perlu buat.',
              },
              {
                n: '3',
                title: 'Buat keputusan dengan yakin',
                desc:  'Dapatkan laporan lengkap — harga pasaran, soalan untuk penjual, skrip rundingan.',
              },
            ].map((step, i) => (
              <div key={step.n} className="flex gap-4 pb-6 relative">
                {i < 2 && (
                  <div className="absolute left-5 top-10 w-0.5 h-[calc(100%-16px)] bg-[#E5E7EB]" />
                )}
                <div className="w-10 h-10 bg-[#064E4A] rounded-xl flex items-center justify-center font-heading font-extrabold text-[16px] text-white flex-shrink-0 z-10">
                  {step.n}
                </div>
                <div className="pt-2">
                  <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">{step.title}</p>
                  <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KENAPA PAQAR ── */}
      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Kenapa Paqar
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-8">
            Dibina untuk pengguna Malaysia
          </h2>

          <div className="flex flex-col md:grid md:grid-cols-3 gap-3">
            {[
              { title: 'Mudah',   desc: 'Masukkan plat, ikut panduan, buat keputusan. Tiada jargon teknikal.' },
              { title: 'Jujur',   desc: 'Kami cakap terus apa yang boleh dan tidak boleh disemak secara automatik.' },
              { title: 'Selamat', desc: 'Data anda disulitkan dengan AES-256. Kami tidak simpan tanpa izin.' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E5E7EB] rounded-[16px] p-5">
                <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">{item.title}</p>
                <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BELI KERETA TERPAKAI? ── */}
      <section className="bg-[#111827] px-5 py-10">
        <div className="max-w-5xl mx-auto md:flex md:items-center md:justify-between md:gap-8">
          <div className="mb-5 md:mb-0">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-white/50 mb-2">
              Untuk Pembeli
            </p>
            <h2 className="font-heading font-extrabold text-[22px] text-white mb-2">
              Nak beli kereta terpakai? Semak dahulu.
            </h2>
            <p className="font-body text-[14px] text-white/70 leading-relaxed">
              Penjual tidak selalu dedahkan semua risiko. Laporan Pembeli Paqar bantu anda semak saman, nilai harga pasaran, dan sedia soalan sebelum bayar deposit.
            </p>
          </div>
          <a
            href="/#semak"
            className="block w-full md:w-auto bg-[#DC2626] text-white font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 text-center hover:bg-[#B91C1C] transition-colors whitespace-nowrap"
          >
            Semak Kereta Yang Nak Dibeli →
          </a>
        </div>
      </section>

      {/* ── PANDUAN PERCUMA ── */}
      <section className="bg-[#F8FAF7] px-5 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 md:text-center">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
              Panduan Percuma
            </p>
            <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827]">
              Semua yang perlu anda tahu sebelum beli
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { href: '/panduan-semak-saman',         title: 'Cara semak saman kereta',          desc: 'PDRM & JPJ step by step' },
              { href: '/cara-beli-kereta-terpakai',   title: 'Cara beli kereta terpakai',        desc: '6 langkah dari semak hingga deposit' },
              { href: '/checklist-beli-kereta-terpakai', title: 'Checklist sebelum bayar deposit', desc: 'Tandakan semua ini dulu' },
              { href: '/risiko-beli-kereta-terpakai', title: 'Risiko beli kereta terpakai',      desc: '7 risiko dan cara elaknya' },
              { href: '/cara-semak-geran-kereta',     title: 'Cara semak geran kereta',          desc: 'Apa perlu disemak dalam VOC' },
            ].map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group"
              >
                <div>
                  <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">
                    {guide.title}
                  </p>
                  <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">{guide.desc}</p>
                </div>
                <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOALAN LAZIM ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Soalan Lazim
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-6">
            Ada soalan?
          </h2>

          <div className="flex flex-col gap-2">
            {[
              {
                q: 'Adakah Paqar platform rasmi?',
                a: 'Paqar bukan platform rasmi kerajaan. Kami adalah perkhidmatan pihak ketiga yang menyemak maklumat daripada sumber-sumber yang boleh diakses awam.',
              },
              {
                q: 'Adakah semakan ini percuma?',
                a: 'Ya, panduan semak saman adalah percuma. Laporan pembeli lengkap (harga pasaran, soalan penjual, skrip rundingan) tersedia pada RM12.',
              },
              {
                q: 'Berapa lama keputusan mengambil masa?',
                a: 'Semakan asas selesai dalam beberapa saat. Laporan pembeli boleh diakses terus selepas bayar.',
              },
              {
                q: 'Adakah data saya selamat?',
                a: 'Nombor plat disulitkan menggunakan AES-256-GCM. Kami tidak menyimpan dalam teks biasa dan mematuhi PDPA Malaysia.',
              },
            ].map((faq) => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{faq.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-[#064E4A] px-5 py-14 text-center md:py-20">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading font-extrabold text-[24px] md:text-[30px] leading-tight tracking-tight text-white mb-3">
            Semak sebelum<br />bayar deposit
          </h2>
          <p className="font-body text-[14px] text-white/70 mb-7">
            Tiada pendaftaran.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Tiada bayaran.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Panduan saman + laporan pembeli.
          </p>
          <Link
            href="/"
            className="inline-block bg-white text-[#064E4A] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 hover:bg-[#F8FAF7] transition-colors"
          >
            Semak Sekarang →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#E5E7EB] px-5 py-6 text-center">
        <p className="font-body text-[12px] text-[#D1D5DB] leading-relaxed mb-2">
          © 2026 Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/privasi" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Privasi</Link>
          <span className="text-[#E5E7EB]">·</span>
          <Link href="/terma" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Terma</Link>
          <span className="text-[#E5E7EB]">·</span>
          <a href="mailto:hello@paqar.my" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] transition-colors">Hubungi Kami</a>
        </div>
      </footer>
    </>
  )
}
