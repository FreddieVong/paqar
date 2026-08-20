import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { InspectionCTA } from '@/components/report/InspectionCTA'

export const metadata: Metadata = {
  title: 'Pemeriksaan Fizikal Kereta Terpakai — Paqar',
  description:
    'Bengkel bebas periksa kereta sebelum anda bayar deposit. Dari RM336. Disediakan oleh rakan bengkel; Paqar menerima komisen rujukan.',
  alternates: { canonical: 'https://paqar.my/pemeriksaan-fizikal' },
}

/**
 * The inspection service, on its own page.
 *
 * ── WHY IT SAYS PLAINLY THAT PAQAR IS PAID ─────────────────────────────────
 *
 * The booking link carries a referral code. A buyer weighing whether to trust a
 * recommendation is entitled to know the recommender earns from it — and Paqar
 * asks strangers for RM29 on the strength of being buyer-side. Disclosing a
 * referral fee costs a little; being found out having hidden one would cost the
 * whole claim.
 *
 * ── WHY IT DOES NOT PRETEND TO REPLACE THE REPORT ──────────────────────────
 *
 * A physical inspection and a listing decision answer different questions. The
 * report says whether a car is worth pursuing and what to pay; the inspection
 * says what is mechanically wrong with it. Sending someone to spend RM336
 * before they know whether the car is worth RM336 of attention is the wrong
 * order, and the page says so.
 */
export default function InspectionPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="py-6 space-y-5">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
              Rakan bengkel
            </p>
            <h1 className="font-heading font-extrabold text-[26px] leading-tight tracking-tight text-[#111827] mb-3">
              Periksa kereta sebelum bayar deposit
            </h1>
            <p className="font-body text-[15px] text-[#374151] leading-relaxed">
              Bengkel bebas &mdash; bukan bengkel penjual &mdash; periksa keadaan
              sebenar kereta dan beri anda laporan bertulis sebelum anda komited.
            </p>
          </div>

          <InspectionCTA surface="home" />

          {/* Order matters, and saying so is more useful than upselling. */}
          <div className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[14px] text-[#111827] mb-2">
              Semak dulu, periksa kemudian
            </p>
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mb-3">
              Pemeriksaan fizikal beritahu apa yang rosak. Ia tidak beritahu sama
              ada harga berpatutan atau sama ada unit itu berbaloi dikejar. Kalau
              anda belum pasti kereta ini patut diteruskan, semak dulu &mdash;
              lebih murah daripada memeriksa kereta yang anda takkan beli.
            </p>
            <Link
              href="/#semak"
              className="inline-block font-heading font-bold text-[13px] text-[#064E4A] underline underline-offset-2 min-h-[44px] leading-[44px]"
            >
              Semak kereta ini dulu &rarr;
            </Link>
          </div>

          <p className="font-body text-[11px] text-[#9CA3AF] leading-relaxed">
            Perkhidmatan ini disediakan oleh rakan bengkel bebas, bukan oleh
            Paqar. Paqar menerima komisen rujukan. Harga dan ketersediaan
            disahkan terus dengan bengkel.
          </p>
        </div>
      </Shell>
    </>
  )
}
