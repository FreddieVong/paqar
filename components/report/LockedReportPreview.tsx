import { BASE_REPORT_LABEL } from '@/lib/pricing'
import { REVIEW_SLA_HOURS } from '@/lib/report-release'
import { TYPICAL_MINUTES } from '@/lib/review-capacity'
import { whatsappUrl } from '@/lib/site'

/**
 * What RM29 buys, ordered by what a buyer cannot get anywhere else.
 *
 * ── THE ORDER IS THE ARGUMENT ──────────────────────────────────────────────
 *
 * This block used to lead with "Soalan untuk Penjual", "Skrip Rundingan" and
 * "Checklist Deposit" — three of its four rows. Every one of those is
 * something a buyer can get from any chat assistant in ten seconds, for
 * nothing. Leading with them invites exactly the objection that killed the
 * RM12 report: why pay for this?
 *
 * Meanwhile the two things that genuinely cannot be got that way — a person
 * who opened THIS advert, and live Malaysian asking prices for THIS model —
 * were a footnote and a single row respectively.
 *
 * So the order is now: the human first, the data a language model does not
 * have second, the official record third, and the advice — still real, still
 * delivered — collapsed into one row at the bottom where it belongs.
 *
 * ── WHY THE FIRST ROW IS NOT LOCKED ────────────────────────────────────────
 *
 * A padlock says "there is content behind this". The human review is not
 * content behind a lock; it is a promise about how the whole report is made,
 * and it is the reason the price is what it is. Rendering it as a locked row
 * would file the one uncopyable thing alongside three copyable ones.
 */

type Row = { title: string; desc: string }

/**
 * Shown only when a plate was supplied. Without one there is no registration
 * to check, and promising it would be the kind of claim this product cannot
 * afford to make on the page where it asks for money.
 */
const REGISTRATION: Row = {
  title: 'Rekod pendaftaran rasmi',
  desc:  'Tahun, enjin dan varian disemak dengan rekod — bukan dengan apa penjual cakap.',
}

const LOCKED_SECTIONS: Row[] = [
  {
    // "Harga sebenar ... yang DIJUAL" was false, and it contradicted this row's
    // own title. Paqar reads ADVERTS: what sellers are asking today, not what
    // anyone paid. The distinction is the whole basis of a negotiation target,
    // and claiming sale prices on the page where money changes hands is the
    // one place it cannot be a loose phrase.
    title: 'Harga iklan setanding',
    desc:  'Harga yang penjual lain minta untuk kereta serupa sekarang — nombor sebenar dari iklan, bukan anggaran.',
  },
  {
    // The three commodity sections, collapsed into one row on purpose. They are
    // still in the report; they are simply no longer the pitch.
    title: 'Apa nak tawar, apa nak tanya, apa nak semak',
    desc:  'Sasaran harga, soalan untuk penjual dan senarai semak sebelum bayar deposit.',
  },
]

/**
 * What Paqar can honestly promise about the evidence it holds.
 *
 * ── WHY THIS IS NOT ONE SENTENCE ───────────────────────────────────────────
 *
 * The row said, unconditionally, "Orang kami baca iklan anda sendiri — kami
 * buka iklan yang anda hantar". A reviewer pasted https://example.com/car/123,
 * typed the car in by hand, and reached a checkout making exactly that
 * promise. There was no iklan to read.
 *
 * The convert route already refuses a check with NO evidence at all — no link
 * and no screenshot is a 422. What it cannot do is tell a real listing it
 * cannot fetch (Carlist, Facebook) from a URL that is not a listing at all,
 * because Paqar deliberately fetches only mudah.my: everything else is opened
 * by a person, and nothing is scraped from a site that declines automation.
 *
 * So the promise is scoped to what is actually known, rather than the checkout
 * being blocked. Blocking would kill the Facebook path — which is the whole
 * reason the screenshot upload exists — to prevent a THIN report rather than
 * an undeliverable one: the price analysis, negotiation target, seller
 * questions and deposit checklist all derive from the car's identity, which
 * the coverage gate has already validated against real comparable adverts.
 *
 * What a missing advert costs is the mileage, the photos, the seller's own
 * words and the dealer-vs-owner signal. That is worth saying out loud, and
 * worth asking for a screenshot to recover — which is what 'link_only' does.
 */
export type ListingEvidence =
  /** A listing Paqar could read. The strongest case, and the original copy. */
  | 'listing_read'
  /** A link stored for a person to open, that Paqar could not read itself. */
  | 'link_only'
  /** No link, but the buyer sent screenshots — a person reads those. */
  | 'screenshot'

const EVIDENCE_COPY: Record<ListingEvidence, { title: string; body: string }> = {
  listing_read: {
    title: 'Orang kami baca iklan anda sendiri',
    body:  'Bukan jawapan auto. Kami buka iklan yang anda hantar, semak varian dan tahun kereta itu, dan hantar keputusan',
  },
  link_only: {
    title: 'Orang kami buka link anda sendiri',
    body:  'Bukan jawapan auto. Kami buka link yang anda hantar, semak varian dan tahun kereta itu, dan hantar keputusan',
  },
  screenshot: {
    title: 'Orang kami baca screenshot anda sendiri',
    body:  'Bukan jawapan auto. Kami baca screenshot yang anda hantar, semak varian dan tahun kereta itu, dan hantar keputusan',
  },
}

export function LockedReportPreview(
  { hasPlate = false, evidence = 'link_only' }:
  { hasPlate?: boolean; evidence?: ListingEvidence },
) {
  // No check id in scope, and deliberately: this is the pre-payment preview, so
  // the buyer has no reference number yet. A generic thread is the right one.
  const supportUrl = whatsappUrl('Hi Paqar, saya nak hantar screenshot iklan kereta.')
  const rows = hasPlate
    ? [LOCKED_SECTIONS[0]!, REGISTRATION, LOCKED_SECTIONS[1]!]
    : LOCKED_SECTIONS

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-1">
          Laporan Pembeli — {BASE_REPORT_LABEL}
        </p>
        <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
          Keputusan untuk kereta yang anda tengah pertimbang ini — bukan nasihat umum.
        </p>
      </div>

      {/* THE HUMAN, FIRST AND UNLOCKED. */}
      <div className="flex items-start gap-3 px-5 py-4 bg-[#F0FDF4] border-b border-[#DCFCE7]">
        <span className="w-[18px] h-[18px] rounded-full bg-[#16A34A] flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="9" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-[13px] text-[#111827]">
            {EVIDENCE_COPY[evidence].title}
          </p>
          <p className="font-body text-[12px] text-[#4B5563] leading-relaxed mt-0.5">
            {EVIDENCE_COPY[evidence].body} &mdash; biasanya dalam{' '}
            {TYPICAL_MINUTES} minit, dijamin dalam {REVIEW_SLA_HOURS} jam.
          </p>
          {evidence === 'link_only' && supportUrl && (
            /* Not a warning — a way to make the report better. A link Paqar
               cannot open itself may still be perfectly readable to a person,
               but if it is not, a screenshot is the difference between a
               report on THIS car and a report on this MODEL. */
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed mt-1.5">
              Kalau link itu perlu login atau tak boleh dibuka dari luar (contohnya
              Facebook), hantar screenshot iklan melalui{' '}
              <a href={supportUrl} target="_blank" rel="noopener noreferrer"
                 className="text-[#3D472F] font-semibold underline underline-offset-2">
                WhatsApp
              </a>{' '}
              supaya kami pasti tengok kereta yang sama.
            </p>
          )}
        </div>
      </div>

      <div className="divide-y divide-[#F3F4F6]">
        {rows.map((section) => (
          <div key={section.title} className="flex items-start gap-3 px-5 py-4 bg-[#F9FAFB]">
            <span className="text-[15px] flex-shrink-0 mt-0.5" aria-hidden="true">🔒</span>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-[13px] text-[#374151]">
                {section.title}
              </p>
              <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed mt-0.5">
                {section.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
