import { isValidWhatsappNumber } from '@/lib/site'

/**
 * The operator's one-tap WhatsApp to a buyer whose report was just released.
 *
 * ── WHY A HAND-OFF, NOT A SENDER ───────────────────────────────────────────
 *
 * E-mail is the delivery channel and it is not enough: a real buyer paid at
 * 05:46, the "laporan siap" e-mail was delivered at 09:36, and by 13:38 they
 * had returned to the site twice without opening it — Hotmail's junk folder,
 * most likely. In Malaysia a WhatsApp gets read; an e-mail from a new domain
 * often does not.
 *
 * WhatsApp's business API costs money, needs Meta's approval, and a message
 * from a business number lands colder than one from the person who read the
 * advert. At a few orders a day the operator tapping send is better and free.
 * So this builds the link and the words; a human presses the button.
 *
 * Returns null rather than a broken link when the number is not one wa.me
 * accepts, or when the report URL carries no credential — a "dah siap"
 * message whose link 404s is worse than none.
 */
export function buildReportReadyWhatsapp(input: {
  phone:     string | null | undefined
  plate:     string | null
  reportUrl: string
}): { url: string; message: string } | null {
  const phone = input.phone ?? ''
  if (!isValidWhatsappNumber(phone)) return null
  if (!/[?&]claim_token=[^&]+/.test(input.reportUrl)) return null

  const car = input.plate ? `kereta ${input.plate}` : 'kereta anda'
  const message = [
    `Hai, ini Paqar. Laporan ${car} dah siap.`,
    `Buka di sini: ${input.reportUrl}`,
    '',
    'Ada soalan, reply je di sini.',
  ].join('\n')

  return { url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`, message }
}
