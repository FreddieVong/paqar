import { z } from 'zod'
import type { ReviewDraftFacts } from './facts'

/**
 * The gate between the model's words and the reviewer's screen.
 *
 * ── WHY THE DRAFT IS REJECTED, NOT REPAIRED ────────────────────────────────
 *
 * A draft that names a figure the order does not contain, or a year it does
 * not carry, is not "mostly right" — it is the kind of confident, specific
 * error a tired reviewer at twenty orders a day will wave through. Editing it
 * into shape here would be a second model with no test. So the whole draft is
 * dropped, the box stays empty, and the reviewer writes it as they always did.
 *
 * The copy rules are the ones the rest of the product enforces by test:
 * "seller" not "penjual", "deposit" not "booking", never a claim that a meter
 * was tampered with or that Paqar verified anything, nothing "percuma" or
 * "dijamin". A note is short — six sentences at most — because the buyer
 * reads it on a phone, before the report, and the reviewer has to read every
 * word of it before sending.
 */

export const DraftOutputSchema = z.object({
  /** Nota untuk pembeli — 3–5 short sentences. */
  note:            z.string(),
  /** Keputusan akhir — one line. */
  finalDecision:   z.string(),
  /** Langkah seterusnya — one line, the first thing to do. */
  nextAction:      z.string(),
  /** Soalan khas untuk iklan ini — 0–3, each one specific to this ad. */
  sellerQuestions: z.array(z.string()).max(3),
})
export type DraftOutput = z.infer<typeof DraftOutputSchema>

export type ValidationResult =
  | { ok: true;  value: DraftOutput }
  | { ok: false; reasons: string[] }

const MAX_NOTE_CHARS     = 700
const MAX_NOTE_SENTENCES = 6
const MAX_LINE_CHARS     = 160

/**
 * Forbidden regardless of context. Lower-cased match. Each entry is a phrase
 * the copy tests elsewhere already forbid, or a verification claim Paqar
 * cannot make.
 */
const FORBIDDEN: RegExp[] = [
  /\bpenjual\b/,
  /\bbooking\b/,
  /\bdiputar\b/, /\bdipusing\b/, /\btamper/,
  /\bpercuma\b/,
  /\bdijamin\b/, /\bjaminan\b/,
  /\bkami (telah |dah |sudah )?(sahkan|mengesahkan)\b/,
  /\bdisahkan oleh paqar\b/,
]

const rmFigures   = (s: string) => [...s.matchAll(/RM\s?([\d][\d,\.]*)/gi)].map(m => m[1]!.replace(/[,\.]/g, ''))
const yearFigures = (s: string) => [...s.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => m[1]!)
const sentences   = (s: string) => s.split(/[.!?]+(?:\s|$)/).map(x => x.trim()).filter(Boolean)

export function validateDraftOutput(raw: unknown, facts: ReviewDraftFacts): ValidationResult {
  const parsed = DraftOutputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reasons: ['schema: ' + parsed.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; ')] }
  const v = parsed.data
  const reasons: string[] = []

  if (v.note.trim() === '')          reasons.push('empty_note')
  if (v.note.length > MAX_NOTE_CHARS) reasons.push(`too_long: note ${v.note.length} chars`)
  if (sentences(v.note).length > MAX_NOTE_SENTENCES) reasons.push(`too_long: note ${sentences(v.note).length} sentences`)
  for (const [k, s] of [['finalDecision', v.finalDecision], ['nextAction', v.nextAction]] as const) {
    if (s.length > MAX_LINE_CHARS) reasons.push(`too_long: ${k}`)
  }
  for (const q of v.sellerQuestions) if (q.length > MAX_LINE_CHARS) reasons.push('too_long: sellerQuestion')

  const everything = [v.note, v.finalDecision, v.nextAction, ...v.sellerQuestions].join('\n')
  const lower = everything.toLowerCase()
  for (const re of FORBIDDEN) {
    const m = lower.match(re)
    if (m) reasons.push(`forbidden_phrase: ${m[0]}`)
  }

  // Figures: every ringgit amount must be one the order carries. The years are
  // the two the order knows about — the advert's and the registration's.
  const allowedRm = new Set(
    [facts.price.askingRm, facts.price.medianRm, facts.price.minRm, facts.price.maxRm,
     facts.price.targetLowRm, facts.price.targetHighRm, facts.price.gapFromMedianRm]
      .filter((n): n is number => n != null)
      .map(n => String(Math.round(Math.abs(n)))),
  )
  for (const fig of rmFigures(everything)) {
    if (!allowedRm.has(fig)) reasons.push(`invented_figure: RM${Number(fig).toLocaleString('en-MY')}`)
  }
  const allowedYears = new Set([facts.car.adYear, facts.car.regYear].filter((y): y is string => !!y))
  for (const y of yearFigures(everything)) {
    if (!allowedYears.has(y)) reasons.push(`invented_year: ${y}`)
  }

  return reasons.length ? { ok: false, reasons } : { ok: true, value: v }
}
