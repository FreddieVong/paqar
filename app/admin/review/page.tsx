import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { isTeamEmail } from '@/lib/team-emails'
import { reviewPriceContext } from '@/lib/review-price-context'
import { listReportsAwaitingReview, listReportsAwaitingRefund, listRecentlyReleased, type ReviewQueueRow } from '@/lib/db/report-review'
import { hoursAwaitingReview, REVIEW_SLA_HOURS } from '@/lib/report-release'
import { ringgit } from '@/lib/pricing'
import { decrypt } from '@/lib/crypto'
import { ReviewerScreenshots } from '@/components/admin/ReviewerScreenshots'
import {
  adminLogin, startReviewAction, releaseReportAction, markUnableAction,
  startRefundAction, completeRefundAction, failRefundAction,
} from './_actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title:  'Admin — Semakan Laporan',
  robots: { index: false, follow: false },
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ms-MY', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function safePlate(plateEncrypted: string | null | undefined): string {
  if (!plateEncrypted) return '(tiada plat)'
  try {
    return decrypt(plateEncrypted).toUpperCase()
  } catch {
    return '(plat tidak dapat dibaca)'
  }
}

/**
 * The reviewer's own SLA readout.
 *
 * Rendered per row rather than only sorted on, because a queue that merely
 * orders by age still lets an overdue report look identical to a fresh one at
 * a glance. The 24-hour promise is made to the buyer before they pay; a broken
 * one has to be visible, not inferable.
 */
function AgeBadge({ hours }: { hours: number | null }) {
  if (hours === null) return null
  const overdue = hours >= REVIEW_SLA_HOURS
  const urgent  = !overdue && hours >= REVIEW_SLA_HOURS * 0.75
  const cls = overdue
    ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
    : urgent
      ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
      : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
  return (
    <span className={`font-heading font-bold text-[11px] px-2 py-1 rounded-full border ${cls}`}>
      {overdue ? 'LEWAT · ' : ''}{hours.toFixed(1)} jam
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-body text-[11px] text-[#9CA3AF]">{label}</p>
      <p className="font-heading font-bold text-[14px] text-[#111827]">{value}</p>
    </div>
  )
}

/** One correctable field. Blank means "no correction" — the draft value stands. */
function Override({ name, label, draft }: { name: string; label: string; draft?: string | number | null }) {
  return (
    <label className="block">
      <span className="font-heading font-bold text-[11px] text-[#6B7280]">{label}</span>
      <input
        name={`override_${name}`}
        defaultValue=""
        placeholder={draft != null && draft !== '' ? String(draft) : '—'}
        className="w-full border border-[#D1D5DB] rounded-[8px] px-2.5 py-2 text-[14px] font-body mt-1"
      />
    </label>
  )
}

async function QueueCard({ row }: { row: ReviewQueueRow }) {
  const { report, check } = row
  // Cache-only, and the same cohort the buyer's report reads. Without it a
  // reviewer had to open the draft in a second tab to learn whether the asking
  // price was high — per report, against a 20-a-day ceiling and a 24-hour
  // promise.
  const prices = check
    ? await reviewPriceContext({ check, askingPriceRm: report.asking_price_rm ?? null })
        .catch(() => null)
    : null
  const hours       = hoursAwaitingReview(report)
  const status      = report.review_status ?? 'pending'
  const refund      = report.refund_status ?? 'not_required'
  const inReview    = status === 'in_review'
  const unable      = status === 'unable_to_complete'

  return (
    <div className={`bg-white border rounded-[16px] p-5 ${unable ? 'border-[#FECACA]' : 'border-[#E5E7EB]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-heading font-extrabold text-[18px] text-[#111827] tracking-wide">
            {safePlate(check?.plate_encrypted) }
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
            {[check?.brand, check?.model, check?.year].filter(Boolean).join(' ') || 'Tiada maklumat kereta'}
            {' · '}Dibayar {formatDateTime(report.paid_at)} · RM{ringgit(report.amount_cents)}
          </p>
          <p className="font-heading font-bold text-[11px] text-[#064E4A] mt-1 uppercase tracking-[.08em]">
            {status}{refund !== 'not_required' && ` · refund: ${refund}`}
          </p>
        </div>
        <AgeBadge hours={hours} />
      </div>

      {/* ── EVIDENCE ─────────────────────────────────────────────────────
          Everything the reviewer needs to judge the draft, in one place. The
          listing link is first and largest because opening it is genuinely
          step one — no scraper here can read Carlist or Facebook. */}
      <div className="bg-[#F8FAF7] border border-[#E5E7EB] rounded-[12px] p-3.5 mb-3">
        <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-1.5">
          Iklan pembeli
        </p>
        {check?.listing_url ? (
          <a href={check.listing_url} target="_blank" rel="noopener noreferrer"
             className="font-body text-[13px] text-[#064E4A] underline underline-offset-2 break-all">
            {check.listing_url}
          </a>
        ) : (
          <p className="font-body text-[13px] text-[#9CA3AF]">Pembeli tidak hantar link.</p>
        )}
      </div>

      {check?.buyer_concern && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px] p-3.5 mb-3">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#B45309] mb-1.5">
            Apa yang pembeli risau
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">
            {check.buyer_concern}
          </p>
        </div>
      )}

      {/* THE NUMBERS, ON THE CARD.
          Placed above the screenshots because it is what decides the verdict,
          and stated as counts rather than percentiles — "11 of 15 ads are
          cheaper than this one" is a sentence that can go straight into the
          note, and it claims no more strength than 15 listings carry. */}
      {prices && (
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-3.5 mb-3">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Harga pasaran — {prices.label}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {/* asking_price_rm is already ringgit — unlike amount_cents above,
                which is why ringgit() is not used here. */}
            <Stat
              label="Seller minta"
              value={report.asking_price_rm != null
                ? `RM${report.asking_price_rm.toLocaleString('en-MY')}` : '—'}
            />
            <Stat label="Harga tengah" value={prices.median != null ? `RM${prices.median.toLocaleString('en-MY')}` : '—'} />
            <Stat
              label="Julat biasa"
              value={prices.min != null && prices.max != null
                ? `RM${prices.min.toLocaleString('en-MY')} – RM${prices.max.toLocaleString('en-MY')}`
                : '—'}
            />
            <Stat label="Iklan setanding" value={String(prices.count)} />
          </div>
          {prices.gapFromMedian != null && (
            <p className={`font-heading font-bold text-[13px] mt-2.5 ${prices.gapFromMedian > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>
              {prices.gapFromMedian > 0
                ? `RM${prices.gapFromMedian.toLocaleString('en-MY')} DI ATAS harga tengah`
                : `RM${Math.abs(prices.gapFromMedian).toLocaleString('en-MY')} di bawah harga tengah`}
              {prices.cheaperThanAsking != null && prices.count > 0 && (
                <span className="font-body font-normal text-[12px] text-[#6B7280]">
                  {' · '}{prices.cheaperThanAsking} daripada {prices.count} iklan lebih murah
                </span>
              )}
            </p>
          )}
          {prices.mixedVariants && (
            <p className="font-body text-[12px] text-[#B45309] mt-1.5">
              Kohort campur varian — jangan guna julat ini terus tanpa semak varian.
            </p>
          )}
        </div>
      )}

      <div className="mb-3">
        <ReviewerScreenshots checkId={report.check_id} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <a href={`/laporan-pembeli/${report.check_id}?claim_token=${check?.claim_token ?? ''}&admin_preview=1`}
           target="_blank" rel="noopener noreferrer"
           className="font-heading font-bold text-[12px] text-[#064E4A] underline underline-offset-2">
          Buka draf laporan →
        </a>
        <span className="font-body text-[12px] text-[#9CA3AF]">
          {report.buyer_email} · {report.buyer_phone ?? 'tiada telefon'}
        </span>
      </div>

      {/* ── ACTIONS, gated by workflow state ───────────────────────────── */}
      {status === 'pending' && (
        <form action={startReviewAction} className="border-t border-[#F3F4F6] pt-4">
          <input type="hidden" name="reportId" value={report.id} />
          <button type="submit"
                  className="w-full bg-[#064E4A] text-white font-heading font-extrabold text-[14px] rounded-[10px] py-3">
            Mula semak →
          </button>
        </form>
      )}

      {inReview && (
        <div className="border-t border-[#F3F4F6] pt-4 space-y-4">
          {/* Corrections rebuild the actual report. A note explaining a wrong
              report is not a fix — the reviewer changes the output itself. */}
          <form action={releaseReportAction} className="space-y-3">
            <input type="hidden" name="reportId" value={report.id} />

            <p className="font-heading font-bold text-[12px] uppercase tracking-[.08em] text-[#6B7280]">
              Betulkan laporan
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Override name="brand"  label="Jenama"  draft={check?.brand} />
              <Override name="model"  label="Model"   draft={check?.model} />
              <Override name="year"   label="Tahun"   draft={check?.year} />
              <Override name="variant" label="Varian" draft="" />
              <Override name="askingPriceRm"    label="Seller minta (RM)" draft={report.asking_price_rm} />
              <Override name="currentMileageKm" label="Mileage iklan (km)" draft={report.claimed_mileage_km} />
            </div>

            {/* These three ARE the product. The draft's own verdict is machine
                output; whatever is typed here replaces it, so a reviewer who
                disagrees with the draft can say so and the buyer reads the
                human's decision instead of two contradictory ones. */}
            <Override name="finalDecision" label="Keputusan akhir — ganti verdict auto" draft="" />
            <Override name="nextAction"    label="Langkah seterusnya" draft="" />

            <label className="block">
              <span className="font-heading font-bold text-[11px] text-[#6B7280]">
                Soalan khas untuk iklan ini — satu per baris
              </span>
              <textarea
                name="override_sellerQuestions"
                rows={3}
                placeholder="Kosongkan kalau soalan standard dah cukup"
                className="w-full border border-[#D1D5DB] rounded-[8px] px-2.5 py-2 text-[14px] font-body mt-1"
              />
              <span className="font-body text-[11px] text-[#9CA3AF]">
                Muncul di atas 5 soalan standard. Ini bahagian yang orang lain tak boleh tiru.
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input type="checkbox" name="suppress_mileage_warning" value="1" className="mt-1" />
              <span className="font-body text-[12px] text-[#374151] leading-snug">
                Sekat amaran mileage — bacaan hanya dakwaan penjual, bukan rekod rasmi bertarikh.
              </span>
            </label>

            <div>
              <label className="block font-heading font-bold text-[12px] text-[#111827] mb-1.5">
                Nota untuk pembeli (wajib)
              </label>
              <textarea
                name="reviewerNote" rows={5} required
                placeholder={'Contoh: Saya dah tengok iklan ini. Seller tulis "V spec" tapi gambar tunjuk rim E spec — beza harga lebih kurang RM4,000.'}
                className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2.5 text-[14px] font-body leading-relaxed"
              />
              <p className="font-body text-[11px] text-[#9CA3AF] mt-1.5">
                Ini yang pembeli bayar untuk. Tanpa nota, laporan tidak boleh dilepaskan.
              </p>
            </div>

            <button type="submit"
                    className="w-full bg-[#064E4A] text-white font-heading font-extrabold text-[14px] rounded-[10px] py-3">
              Lepaskan laporan &amp; hantar →
            </button>
          </form>

          {/* The honest exit when the draft cannot be corrected into something
              truthful. Sets refund_status = required in the same write. */}
          <form action={markUnableAction} className="space-y-2">
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="reasonCode" value="uncorrectable" />
            <input
              name="note" required placeholder="Kenapa tidak dapat disiapkan?"
              className="w-full border border-[#FECACA] rounded-[8px] px-2.5 py-2 text-[13px] font-body"
            />
            <button type="submit"
                    className="w-full border border-[#FECACA] text-[#B91C1C] font-heading font-bold text-[13px] rounded-[10px] py-2.5">
              Tak boleh siapkan — refund
            </button>
          </form>
        </div>
      )}

      {/* ── REFUND, a separate axis with its own states ─────────────────
          No code here moves money: Billplz API v3 has no refund endpoint.
          These actions record what a human did, and 'refunded' requires an
          external reference so it can never mean "someone flipped a flag". */}
      {refund !== 'not_required' && refund !== 'refunded' && (
        <div className="border-t border-[#F3F4F6] pt-4 mt-4 space-y-2">
          <p className="font-heading font-bold text-[13px] text-[#B91C1C]">
            Refund RM{ringgit(report.refund_amount_cents ?? report.amount_cents)} — {refund}
          </p>
          {refund === 'required' && (
            <form action={startRefundAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="w-full bg-[#B91C1C] text-white font-heading font-bold text-[13px] rounded-[10px] py-2.5">
                Saya sedang buat refund di Billplz →
              </button>
            </form>
          )}
          {(refund === 'processing' || refund === 'failed') && (
            <>
              <form action={completeRefundAction} className="flex gap-2">
                <input type="hidden" name="reportId" value={report.id} />
                <input name="reference" required placeholder="Rujukan bank / Billplz"
                       className="flex-1 border border-[#D1D5DB] rounded-[8px] px-2.5 py-2 text-[13px] font-body" />
                <button type="submit" className="bg-[#15803D] text-white font-heading font-bold text-[13px] rounded-[10px] px-4">
                  Sahkan dibayar
                </button>
              </form>
              <form action={failRefundAction} className="flex gap-2">
                <input type="hidden" name="reportId" value={report.id} />
                <input name="note" placeholder="Kenapa gagal?"
                       className="flex-1 border border-[#D1D5DB] rounded-[8px] px-2.5 py-2 text-[13px] font-body" />
                <button type="submit" className="border border-[#FECACA] text-[#B91C1C] font-heading font-bold text-[13px] rounded-[10px] px-4">
                  Gagal
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default async function AdminReviewPage() {
  if (!env.ADMIN_SECRET) notFound()

  if (!isAdminAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-5">
        <form action={adminLogin} className="w-full max-w-xs bg-white border border-[#E5E7EB] rounded-[16px] p-6 space-y-4">
          <p className="font-heading font-bold text-[16px] text-[#111827]">Paqar Admin</p>
          <input
            type="password"
            name="secret"
            placeholder="Admin secret"
            autoFocus
            className="w-full border border-[#D1D5DB] rounded-[10px] px-4 py-3 text-[16px]"
          />
          <button
            type="submit"
            className="w-full bg-[#064E4A] text-white font-heading font-bold text-[15px] rounded-[10px] py-3"
          >
            Log Masuk
          </button>
        </form>
      </div>
    )
  }

  const [pending, owedRefunds, released] = await Promise.all([
    listReportsAwaitingReview(),
    listReportsAwaitingRefund(),
    listRecentlyReleased(),
  ])

  // ── INTERNAL TESTS ARE NOT WORK ──────────────────────────────────────────
  //
  // Every end-to-end test of the paid journey leaves a real paid row behind —
  // 24 of the first 27 payments this product ever took were exactly that. Those
  // rows sat in the queue for ever, counted toward "N menunggu", and aged past
  // the 24-hour promise, so the operator's own SLA readout drifted further from
  // the truth with every test they ran.
  //
  // Shown rather than hidden, because testing the real queue is the point of
  // having one — but badged, sorted last, and excluded from the counts. The
  // classifier is lib/team-emails, never an ad-hoc filter: a second list is how
  // a real customer eventually gets misclassified as a test.
  const isInternal = (r: ReviewQueueRow) => isTeamEmail(r.report.buyer_email)
  const realPending = pending.filter(r => !isInternal(r))
  const testPending = pending.filter(isInternal)
  const overdue = realPending.filter(r => (hoursAwaitingReview(r.report) ?? 0) >= REVIEW_SLA_HOURS).length

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-extrabold text-[24px] text-[#111827]">
            Semakan Laporan
          </h1>
          <p className="font-body text-[13px] text-[#6B7280] mt-1">
            {realPending.length} menunggu
            {overdue > 0 && (
              <span className="text-[#B91C1C] font-bold"> · {overdue} lewat melebihi {REVIEW_SLA_HOURS} jam</span>
            )}
            {owedRefunds.length > 0 && (
              <span className="text-[#B91C1C] font-bold"> · {owedRefunds.length} refund belum selesai</span>
            )}
          </p>
        </div>

        {/* MONEY OWED, ABOVE WORK PENDING.
            Marking a report unable_to_complete moved it out of the review
            queue and out of sight entirely — the card's refund controls were
            unreachable because no query returned a row that could render them.
            A real customer was owed RM29 and the only screen tracking it showed
            nothing. Billplz API v3 has no refund endpoint, so a person moves
            this money by hand and this reminder IS the mechanism. It sits above
            the review queue because a debt outranks a task. */}
        {owedRefunds.length > 0 && (
          <div className="space-y-4">
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] px-4 py-3">
              <p className="font-heading font-bold text-[13px] text-[#B91C1C]">
                Refund belum selesai — duit pembeli masih dengan kami
              </p>
              <p className="font-body text-[12px] text-[#7F1D1D] mt-0.5">
                Billplz tiada API refund. Pindah duit sendiri, kemudian rekod rujukannya di bawah.
              </p>
            </div>
            {owedRefunds.map(row => <QueueCard key={`refund-${row.report.id}`} row={row} />)}
          </div>
        )}

        {realPending.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-6 text-center">
            <p className="font-body text-[14px] text-[#6B7280]">
              Tiada laporan menunggu semakan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {realPending.map(row => <QueueCard key={row.report.id} row={row} />)}
          </div>
        )}

        {testPending.length > 0 && (
          <div className="space-y-4">
            <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-[12px] px-4 py-2.5">
              <p className="font-heading font-bold text-[12px] text-[#6B7280] uppercase tracking-[.08em]">
                Ujian dalaman — {testPending.length}
              </p>
              <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">
                Tidak dikira dalam SLA. Alamat e-mel dalam lib/team-emails.
              </p>
            </div>
            {testPending.map(row => <QueueCard key={row.report.id} row={row} />)}
          </div>
        )}

        {released.length > 0 && (
          <div className="pt-4">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#9CA3AF] mb-3">
              Dilepaskan 7 hari lepas
            </p>
            <div className="space-y-2">
              {released.map(({ report, check }) => (
                <div key={report.id} className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
                  <span className="font-heading font-bold text-[13px] text-[#111827] tracking-wide">
                    {safePlate(check?.plate_encrypted)}
                  </span>
                  <span className="font-body text-[12px] text-[#9CA3AF]">
                    {formatDateTime(report.released_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
