import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/page-metadata'
import { Nav } from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'
import { InsuranceCTA } from '@/components/report/InsuranceCTA'

// Built by the shared helper, which is the only way to get a complete and
// self-consistent openGraph. These three pages declared none at all, so they
// inherited the root layout's — and the root deliberately sets no url, title or
// description, because a url there became og:url on every page that forgot.
// The result was pages with NO og:url whatsoever: scripts/seo-check.mjs has
// been reporting all three since that root change landed.
export const metadata: Metadata = pageMetadata({
  path:        '/banding-insurans',
  title:       'Bandingkan Insurans Kereta — Paqar',
  description: 'Bandingkan harga insurans kereta dari semua syarikat dalam satu tempat. Disediakan oleh Bjak; Paqar menerima komisen rujukan.',
})

/**
 * Insurance comparison, on its own page.
 *
 * The comparison itself is free to the buyer and Paqar earns a referral fee.
 * Both facts are stated, because "percuma" alone invites the reader to assume
 * nobody is paid — and discovering otherwise later would undermine the one
 * claim the RM29 product rests on.
 */
export default function InsurancePage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="py-6 space-y-5">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#3D472F] mb-2">
              Rakan Bjak
            </p>
            <h1 className="font-heading font-extrabold text-[26px] leading-tight tracking-tight text-[#111827] mb-3">
              Bandingkan insurans sebelum tukar nama
            </h1>
            <p className="font-body text-[15px] text-[#374151] leading-relaxed">
              Harga insurans untuk kereta yang sama boleh berbeza beribu ringgit
              antara syarikat. Bandingkan semua dalam satu tempat sebelum anda
              perbaharui atau tukar nama.
            </p>
          </div>

          <InsuranceCTA surface="home" />

          <p className="font-body text-[11px] text-[#9CA3AF] leading-relaxed">
            Perbandingan disediakan oleh Bjak, bukan oleh Paqar. Percuma untuk
            anda; Paqar menerima komisen rujukan daripada Bjak. Paqar tidak
            menjual insurans dan tidak menerima bayaran daripada penjual kereta.
          </p>
        </div>
      </Shell>
    </>
  )
}
