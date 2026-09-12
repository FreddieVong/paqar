/**
 * Is this request a person navigating to a page?
 *
 * A link preview is not a buyer. The operator's WhatsApp message carries the
 * report URL; WhatsApp fetches it to draw the preview card, and so do e-mail
 * security scanners and social crawlers. Counting those as "dibuka" would
 * silence the morning digest for a buyer who never opened anything.
 *
 * Two signals, both cheap: the user-agent is not a known fetcher, and — when
 * the browser sends Sec-Fetch headers, which every current one does — the
 * fetch is a top-level document navigation, not a prefetch, iframe or XHR.
 * Old browsers without Sec-Fetch pass on user-agent alone.
 */
const FETCHER = /whatsapp|facebookexternalhit|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|skypeuripreview|bot\b|crawler|spider|preview|headless|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp|java\//i

export function isHumanNavigation(headers: Headers): boolean {
  const ua = headers.get('user-agent') ?? ''
  if (!ua || FETCHER.test(ua)) return false
  const dest = headers.get('sec-fetch-dest')
  if (dest && dest !== 'document') return false
  if (headers.get('sec-purpose')?.includes('prefetch') || headers.get('purpose') === 'prefetch') return false
  return true
}
