import 'server-only'
import { env } from '@/lib/env'

// Owner ops alerts (e.g. a new JomCheck order to fulfil). Gated on env — with
// no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID set, this is a silent no-op, so the
// app behaves identically until the owner wires up a bot. Best-effort only:
// a failed ping must never break the payment webhook, so callers should not
// await-throw — this function swallows its own errors and returns a boolean.
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token  = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:                  chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      console.error('[telegram] send failed:', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] send error:', err)
    return false
  }
}
