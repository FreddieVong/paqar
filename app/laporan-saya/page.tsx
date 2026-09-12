import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/page-metadata'
import Link from 'next/link'
import { Nav } from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { whatsappUrl } from '@/lib/site'
import { REVIEW_SLA_HOURS } from '@/lib/pricing'
import { cookies } from 'next/headers'
import { REMEMBERED_COOKIE, decodeRemembered } from '@/lib/remembered-reports'
import { resolveRememberedReports, type RememberedState } from '@/lib/server/remembered-reports'
import { formatMalayDate } from '@/lib/format-date-my'

// Reads the buyer's cookie, so it renders per request. It is noindex anyway.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  path:        '/laporan-saya',
  title:       'Laporan Saya — Paqar',
  description: 'Cari semula laporan pembeli Paqar anda.',
  // noindex, but still shared in WhatsApp by buyers looking for their report,
  // so it still needs a card that is about this page.
  robots:      { index: false, follow: true },
})

/**
 * Where a buyer goes when they cannot find their report.
 *
 * ── WHY THIS IS NOT /dashboard ─────────────────────────────────────────────
 *
 * /dashboard redirects anonymous visitors to /auth. Paqar's entire promise is
 * "tanpa akaun" — almost nobody who buys a report has an account, so a nav item
 * pointing there would send the overwhelming majority of buyers into a login
 * wall for a product they deliberately bought without logging in.
 *
 * ── WHY THERE IS NO LOOKUP FORM ────────────────────────────────────────────
 *
 * The honest answer is that the link IS the credential. A form taking an email
 * and returning a report would be a way for anyone holding a buyer's email
 * address to read their report — the access model is a claim token precisely so
 * that no such lookup exists. Re-sending to the address on file would be
 * defensible, but it is a real feature with real abuse questions, not something
 * to bolt on beside a nav change.
 *
 * So this page does the one useful thing it honestly can: tell the buyer
 * exactly where the link is, and give them a human if it is not there.
 *
 * ── AND NOW, ONE MORE ──────────────────────────────────────────────────────
 *
 * A buyer who paid at 05:46 tapped this page at 21:18 the same day, read
 * "your link is in the e-mail", and left twelve seconds later for the free
 * guides. The e-mail was in their junk folder. The phone in their hand had
 * been shown the link three times.
 *
 * So the phone now remembers (lib/remembered-reports): a cookie holding the
 * links this browser has already been shown, validated here exactly as a URL
 * token is. On the device that paid, the report is the first thing on this
 * page. On any other device, the e-mail copy below is still the truth.
 */
const STATE_COPY: Record<RememberedState, { badge: string; cls: string; cta: string }> = {
  released:      { badge: 'Dah siap',              cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', cta: 'Buka laporan →' },
  under_review:  { badge: 'Sedang disemak',        cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]', cta: 'Lihat status →' },
  undeliverable: { badge: 'Tidak dapat disiapkan', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]', cta: 'Lihat butiran →' },
  free_result:   { badge: 'Semakan percuma',       cls: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]', cta: 'Lihat keputusan →' },
}

export default async function MyReportPage() {
  const support = whatsappUrl('Hai Paqar, saya tak jumpa laporan saya.')
  const remembered = await resolveRememberedReports(
    decodeRemembered(cookies().get(REMEMBERED_COOKIE)?.value),
  ).catch(() => [])

  return (
    <>
      <Nav />
      <Shell>
        <div className="py-6 space-y-5">
          <h1 className="font-heading font-extrabold text-[26px] leading-tight tracking-tight text-[#111827]">
            Laporan saya
          </h1>

          {remembered.length > 0 && (
            <div className="space-y-2">
              {remembered.map(r => {
                const c = STATE_COPY[r.state]
                return (
                  <Link key={r.checkId} href={r.url}
                        className="block bg-white border border-[#E5E7EB] rounded-[14px] p-4 hover:border-[#3D472F] transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading font-extrabold text-[16px] text-[#111827] tracking-wide truncate">{r.label}</p>
                        <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">
                          {r.createdAt ? `Semakan ${formatMalayDate(r.createdAt)}` : 'Semakan anda'}
                        </p>
                      </div>
                      <span className={`shrink-0 font-heading font-bold text-[11px] border rounded-full px-2.5 py-1 ${c.cls}`}>{c.badge}</span>
                    </div>
                    <p className="font-heading font-bold text-[13px] text-[#3D472F] mt-3">{c.cta}</p>
                  </Link>
                )
              })}
              <p className="font-body text-[11px] text-[#9CA3AF] leading-relaxed px-1">
                Diingati pada telefon ini sahaja. Pada peranti lain, guna pautan dalam e-mel.
              </p>
            </div>
          )}

          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#15803D] mb-2">
              Pautan laporan anda ada dalam e-mel
            </p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">
              Paqar tidak memerlukan akaun, jadi laporan anda dibuka melalui
              pautan peribadi yang kami hantar ke e-mel anda selepas bayaran.
              Cari e-mel daripada <strong>Paqar</strong> &mdash; semak folder
              spam kalau tiada dalam peti masuk.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">
              Baru bayar dan belum terima?
            </p>
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
              Setiap laporan dibaca oleh manusia sebelum dihantar. Keputusan
              sampai dalam {REVIEW_SLA_HOURS} jam &mdash; anda akan terima
              mesej sebaik ia siap. Tidak perlu buat apa-apa sementara menunggu.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">
              Masih tak jumpa?
            </p>
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-3">
              WhatsApp kami dengan e-mel yang anda guna semasa bayar, dan kami
              hantar semula pautan itu.
            </p>
            {support && (
              <a
                href={support}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block min-h-[44px] leading-[44px] font-heading font-bold text-[13px] text-[#3D472F] underline underline-offset-2"
              >
                WhatsApp Paqar &rarr;
              </a>
            )}
          </div>

          {/* The reminders product is retired. This line survived because it
              is scoped and technically true — the accounts still exist — but a
              page about retrieving your report is not the place to advertise a
              feature nobody can sign up for any more. Kept as a way back in
              for people who DO have an account, described as exactly that. */}
          <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed">
            Pernah daftar akaun Paqar dahulu?{' '}
            <Link href="/dashboard" className="text-[#3D472F] underline underline-offset-2">
              Buka dashboard lama anda
            </Link>
            . Laporan Pembeli tidak memerlukan akaun.
          </p>
        </div>
      </Shell>
    </>
  )
}
