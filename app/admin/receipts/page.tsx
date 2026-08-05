import type { Metadata } from 'next'
import { isAdminAuthenticated }   from '@/lib/admin-auth'
import { getUndeliveredReceipts } from '@/lib/db/buyer-reports'
import { RetryButton }            from './RetryButton'

export const metadata: Metadata = { robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * The operational queue for the one thing a paying customer cannot do without:
 * the link to what they bought. A receipt that never landed used to be
 * invisible — this makes it a row someone can act on.
 */
export default async function AdminReceiptsPage() {
  if (!isAdminAuthenticated()) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <p className="font-body text-[14px] text-[#6B7280]">
          Unauthorized. Sign in via /admin/jomcheck first.
        </p>
      </main>
    )
  }

  const rows = await getUndeliveredReceipts(50).catch(() => [])

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="font-heading font-extrabold text-[22px] text-[#111827]">Receipt delivery</h1>
        <p className="font-body text-[13px] text-[#6B7280] mt-1">
          Paid purchases whose receipt is unsent, failed, or predates delivery tracking.
          The receipt carries the only durable copy of an anonymous buyer&apos;s report link.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="font-body text-[14px] text-[#15803D]">
          Nothing outstanding — every paid report has a delivered receipt.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="border border-[#E5E7EB] rounded-[12px] p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-[13px] text-[#111827] truncate">
                    {r.check_id} · RM{(r.amount_cents / 100).toFixed(2)}
                  </p>
                  <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                    status: <strong>{r.receipt_status ?? 'unknown (pre-tracking)'}</strong>
                    {' · '}attempts: {r.receipt_attempts ?? 0}
                    {r.paid_at ? ` · paid ${new Date(r.paid_at).toISOString().slice(0, 16).replace('T', ' ')}` : ''}
                  </p>
                  {r.receipt_last_error && (
                    <p className="font-body text-[11px] text-[#B45309] mt-1 break-words">
                      {r.receipt_last_error}
                    </p>
                  )}
                </div>
                <RetryButton buyerReportId={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
