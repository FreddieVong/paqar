import Link           from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { HomeCheckerTabs } from '@/components/check/HomeCheckerTabs'
import { getCheckCount } from '@/lib/db/checks'

export default async function HomePage() {
  const checkCount = await getCheckCount().catch(() => 0)
  const countDisplay = checkCount > 20
    ? `${(Math.floor(checkCount / 10) * 10).toLocaleString()}+`
    : null

  return (
    <>
      <Nav />

      {/* ── HERO ── */}
      <section id="semak" className="bg-white px-5 pt-10 pb-12 md:pt-14 md:pb-16 overflow-x-hidden">
        <div className="max-w-xl mx-auto">

          {/* Single trust badge */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-[#16A34A] rounded-full" />
              <span className="font-heading font-bold text-[12px] text-[#15803D]">
                Percuma · Tanpa daftar akaun
              </span>
            </div>
          </div>

          <h1 className="font-heading font-extrabold text-[30px] md:text-[36px] leading-[1.1] tracking-[-0.03em] text-[#111827] mb-7">
            Semak sebelum beli<br />
            <span className="text-[#064E4A]">kereta terpakai.</span>
          </h1>

          <HomeCheckerTabs countDisplay={countDisplay} />

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

          <div className="flex flex-col md:grid md:grid-cols-2 gap-3">
            {[
              { title: 'Semak Harga Pasaran', desc: 'Verdict harga — mahal, wajar, atau berbaloi untuk kereta tu', badge: 'Percuma', badgeStyle: 'bg-[#DCFCE7] text-[#15803D]' },
              { title: 'Laporan Pembeli',   desc: 'Harga sebenar, data JPJ, soalan penjual, skrip rundingan',  badge: 'RM12',     badgeStyle: 'bg-[#FEF9C3] text-[#B45309]' },
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
                title: 'Masukkan maklumat kereta',
                desc:  'Jenama, model, tahun, dan harga yang penjual minta.',
              },
              {
                n: '2',
                title: 'Dapat verdict harga',
                desc:  'Kami semak harga pasaran dan tunjukkan sama ada berpatutan.',
              },
              {
                n: '3',
                title: 'Unlock laporan penuh',
                desc:  'Data JPJ, harga sebenar, soalan penjual dan skrip rundingan — RM12.',
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
              Penjual tidak selalu dedahkan semua risiko. Paqar bantu anda tahu sama ada harga berpatutan, semak data JPJ, dan sedia skrip tawar sebelum bayar deposit.
            </p>
          </div>
          <a
            href="/#semak"
            className="block w-full md:w-auto bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 text-center hover:bg-[#FDE047] transition-colors"
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
              { href: '/cara-beli-kereta-terpakai',      title: 'Cara beli kereta terpakai',        desc: '6 langkah dari semak hingga deposit' },
              { href: '/checklist-beli-kereta-terpakai', title: 'Checklist sebelum bayar deposit',  desc: 'Tandakan semua ini dulu' },
              { href: '/risiko-beli-kereta-terpakai',    title: 'Risiko beli kereta terpakai',      desc: '7 risiko dan cara elaknya' },
              { href: '/panduan-semak-saman',            title: 'Cara semak saman kereta',          desc: 'PDRM & JPJ step by step' },
              { href: '/cara-semak-geran-kereta',        title: 'Cara semak geran kereta',          desc: 'Apa perlu disemak dalam VOC' },
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
                a: 'Ya, semakan harga pasaran adalah percuma — masukkan kereta dan dapat verdict terus. Laporan pembeli lengkap (harga sebenar, data JPJ, skrip rundingan) tersedia pada RM12.',
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
            Verdict harga percuma.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Laporan penuh RM12.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Tanpa daftar akaun.
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
