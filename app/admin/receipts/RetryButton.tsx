'use client'

import { useState, useTransition } from 'react'
import { retryReceipt } from './_actions'

export function RetryButton({ buyerReportId }: { buyerReportId: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg]    = useState<string | null>(null)

  // `force` is a separate, deliberate click. Without it a row already marked
  // sent is skipped, so an impatient double-click cannot mail the buyer twice.
  function run(force: boolean) {
    start(async () => {
      const r = await retryReceipt(buyerReportId, { force })
      setMsg(r.message)
    })
  }

  return (
    <div className="flex-shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(false)}
        className="bg-[#064E4A] text-white font-heading font-bold text-[12px] rounded-[8px] px-3 py-2 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Retry'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => { if (confirm('Force resend? This mails the buyer again even if already delivered.')) run(true) }}
        className="block mt-1 font-body text-[11px] text-[#9CA3AF] underline disabled:opacity-50"
      >
        Force
      </button>
      {msg && <p className="font-body text-[11px] text-[#374151] mt-1 max-w-[160px]">{msg}</p>}
    </div>
  )
}
