import Link from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { DualCheckForm } from '@/components/check/DualCheckForm'

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* ── HERO ── */}
      <section className="bg-white px-5 pt-10 pb-12 md:pt-16 md:pb-20">
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
              Semak <span className="text-[#064E4A]">Saman</span> &amp; Blacklist<br />
              Dengan Mudah
            </h1>

            <p className="font-body text-[15px] md:text-[16px] text-[#6B7280] leading-relaxed mb-8 md:mb-0">
              Paqar bantu anda semak status penting kenderaan dengan cepat, jelas dan mudah faham.
            </p>

            <div className="hidden md:flex gap-5 mt-6">
              {[['🔒', 'Data disulitkan'], ['⚡', 'Keputusan dalam 60 saat'], ['✓', 'Percuma sepenuhnya']].map(([icon, text]) => (
                <span key={text} className="flex items-center gap-1.5 font-body text-[13px] text-[#6B7280]">
                  <span>{icon}</span>{text}
                </span>
              ))}
            </div>
          </div>

          {/* Checking card */}
          <div>
            <DualCheckForm />
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
              Semua status penting, dalam satu tempat
            </h2>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-3 gap-3">
            {[
              { icon: '🚗', title: 'Saman Kenderaan', desc: 'PDRM, JPJ, AES & Majlis Tempatan', badge: 'Tersedia', badgeStyle: 'bg-[#DCFCE7] text-[#15803D]' },
              { icon: '🚫', title: 'Status Blacklist',  desc: 'Imigresen, LHDN & PTPTN',           badge: 'Tersedia', badgeStyle: 'bg-[#DCFCE7] text-[#15803D]' },
              { icon: '📄', title: 'Dokumen Kenderaan', desc: 'Cukai jalan, insurans & lesen',      badge: 'Akan Datang', badgeStyle: 'bg-[#F3F4F6] text-[#6B7280]' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 flex items-center gap-3 md:flex-col md:items-start md:p-5">
                <div className="w-11 h-11 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-xl flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-[15px] text-[#111827] mb-0.5">{item.title}</p>
                  <p className="font-body text-[13px] text-[#6B7280]">{item.desc}</p>
                  <span className={`inline-block mt-2 font-heading font-bold text-[11px] px-2.5 py-1 rounded-full ${item.badgeStyle}`}>
                    {item.badge}
                  </span>
                </div>
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
                title: 'Masukkan maklumat',
                desc:  'Nombor plat dan No. IC anda. Data disulitkan — tidak disimpan dalam teks biasa.',
              },
              {
                n: '2',
                title: 'Paqar semak status',
                desc:  'Sistem kami semak 7 sumber serentak — PDRM, JPJ, AES, Imigresen dan lain-lain.',
              },
              {
                n: '3',
                title: 'Lihat keputusan dengan jelas',
                desc:  'Hijau bermakna selamat. Merah bermakna perlu tindakan. Tiada istilah teknikal.',
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
              { icon: '⚡', title: 'Pantas', desc: 'Keputusan dalam 60 saat. Tiada menunggu, tiada keliru.' },
              { icon: '🎯', title: 'Jelas',  desc: 'Hijau atau merah. Anda tahu apa yang perlu dilakukan serta-merta.' },
              { icon: '🔒', title: 'Selamat', desc: 'IC disulitkan dengan AES-256. Kami tidak simpan data anda tanpa izin.' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E5E7EB] rounded-[16px] p-5">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">{item.title}</p>
                <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── JUAL KERETA? ── */}
      <section className="bg-[#064E4A] px-5 py-10">
        <div className="max-w-5xl mx-auto md:flex md:items-center md:justify-between md:gap-8">
          <div className="mb-5 md:mb-0">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-white/60 mb-2">
              Untuk Penjual
            </p>
            <h2 className="font-heading font-extrabold text-[22px] text-white mb-2">
              Jual lebih cepat dengan Trust Card
            </h2>
            <p className="font-body text-[14px] text-white/70 leading-relaxed">
              Buktikan kepada pembeli bahawa kereta anda tiada saman tersembunyi. Kongsi link atau kad imej terus ke Mudah, WhatsApp &amp; Facebook.
            </p>
          </div>
          <Link
            href="/buat-trust-card"
            className="block w-full md:w-auto bg-[#FACC15] text-[#111827] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 text-center hover:bg-yellow-300 transition-colors whitespace-nowrap"
          >
            Buat Trust Card — RM29 →
          </Link>
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
                a: 'Ya, semakan asas saman dan blacklist adalah percuma sepenuhnya. Tiada kad kredit diperlukan.',
              },
              {
                q: 'Berapa lama keputusan mengambil masa?',
                a: 'Biasanya dalam 60 saat. Masa mungkin berbeza bergantung kepada kesediaan sumber luar.',
              },
              {
                q: 'Adakah No. IC saya selamat?',
                a: 'No. IC anda disulitkan menggunakan AES-256-GCM sebelum disimpan. Kami tidak menyimpan dalam teks biasa dan mematuhi PDPA Malaysia.',
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
            Semak kenderaan anda<br />sekarang — percuma
          </h2>
          <p className="font-body text-[14px] text-white/70 mb-7">
            Tiada pendaftaran.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Tiada bayaran.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Hasil dalam 60 saat.
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
        <p className="font-body text-[12px] text-[#D1D5DB] leading-relaxed">
          © 2026 Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
          <br />
          <span className="text-[#9CA3AF]">Privasi · Terma · Hubungi Kami</span>
        </p>
      </footer>
    </>
  )
}
