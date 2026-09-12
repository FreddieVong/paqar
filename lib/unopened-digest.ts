/**
 * The morning Telegram: released reports nobody has opened.
 *
 * The queue says "Belum dibuka" under each released row, but the owner has
 * to open the queue to see it. The daily cron runs at 10:00 MYT; this is the
 * message it sends when there is something to chase — and null when there is
 * not, because a daily "all clear" is swiped away by the third day and takes
 * the real alerts with it.
 *
 * A report gets a day before it is listed: the e-mail deserves that long.
 * Each line says how to reach the buyer, so the owner can act from the
 * phone without opening anything: WhatsApp them, or — with no number — only
 * wait. No address, no token: this lands in a chat app.
 */
export interface UnopenedRow {
  id:                 string
  check_id:           string
  plate:              string | null
  released_at:        string | null
  first_opened_at:    string | null
  buyer_phone:        string | null
  whatsapp_sent_at:   string | null
  ready_email_status: string | null
}

const DAY_MS = 86_400_000

export function buildUnopenedDigest(rows: UnopenedRow[], now: Date): string | null {
  const stale = rows
    .filter(r => !r.first_opened_at && r.released_at && now.getTime() - new Date(r.released_at).getTime() >= DAY_MS)
    .sort((a, b) => new Date(a.released_at!).getTime() - new Date(b.released_at!).getTime())
  if (stale.length === 0) return null

  const lines = stale.map(r => {
    const days  = Math.floor((now.getTime() - new Date(r.released_at!).getTime()) / DAY_MS)
    const reach =
      r.ready_email_status === 'failed' ? 'e-mel GAGAL'
      : r.whatsapp_sent_at              ? 'WhatsApp dah dihantar'
      : r.buyer_phone                   ? 'ada nombor — WhatsApp dari senarai'
      : 'tiada nombor — e-mel sahaja'
    return `• ${r.plate ?? r.check_id} — dilepaskan ${days} hari lepas, ${reach}`
  })

  return [
    `${stale.length} laporan belum dibuka oleh pembeli:`,
    ...lines,
    '',
    'https://paqar.my/admin/review',
  ].join('\n')
}
