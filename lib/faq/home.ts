import { historyAddOnLimitLine, competitorComparisonAnswer } from '@/lib/history-addon-copy'
import { BASE_REPORT_LABEL, REVIEW_SLA_HOURS } from '@/lib/pricing'
import { TYPICAL_MINUTES } from '@/lib/review-capacity'

/**
 * The homepage FAQ and limits — ONE source for the accordion AND the JSON-LD.
 *
 * ── WHY THIS EXISTS, AND WHY IT EXISTS TWICE ───────────────────────────────
 *
 * This file was written once before, to fix the drift where the page rendered
 * four questions while the structured data emitted seven. Three answers existed
 * only for Google — including the limitations answer, which is the most
 * important thing Paqar tells a buyer.
 *
 * It worked, and then a later rewrite of the homepage inlined the FAQ again and
 * left this file importing nothing and imported by nothing. The bug came back
 * exactly as before: eight questions in the JSON-LD, six in the accordion, two
 * answers Google could attribute to Paqar that no visitor could read. A test
 * went on guarding THIS file the whole time, reporting green about copy nobody
 * rendered, while the live FAQ had no guard at all.
 *
 * That is the argument for the file, made twice. A string with two homes
 * eventually has two meanings, and a fix that lives in a comment rather than in
 * the type system gets undone by the next person who reformats the page.
 *
 * ── GOOGLE REQUIRES THE ANSWER TO BE VISIBLE ───────────────────────────────
 *
 * FAQPage guidance is explicit that the question and answer content must be
 * visible to the user on the source page; markup-only content does not
 * qualify. So the fix is never to trim the JSON-LD down to what the accordion
 * happens to show — it is to render everything the JSON-LD claims.
 *
 * Deriving both from `homeFaq()` is what makes that structural: you cannot add
 * a question for Google without also adding it to the page.
 *
 * ── ORDER IS THE BUYER'S, NOT PAQAR'S ──────────────────────────────────────
 *
 * Value first, because "what do I get for the money" is the question someone
 * at a paywall actually has. Then the objection, the wait, the competitor, the
 * limits, the guarantee, and last the two that only need a one-line answer.
 */

export type FaqEntry = {
  readonly q: string
  readonly a: string
}

/**
 * The limits, in one place.
 *
 * They were written out twice — as the bullet list in the "Had & jaminan"
 * section and as a sentence inside the limitations answer — and they had
 * already drifted: the list said "harga yang seller minta" while the answer
 * still said "harga yang diminta", and the answer was missing the variant
 * caveat entirely. The section renders these as bullets, the FAQ joins them
 * into a paragraph, and neither can now say something the other does not.
 *
 * A function, not a const: `historyAddOnLimitLine()` reads the sale gate, and
 * evaluating it once at module load would freeze the add-on's availability
 * into the page for the lifetime of the process.
 */
export function homeLimits(): readonly string[] {
  return [
    'Harga iklan ialah harga yang seller minta, bukan harga jual sebenar.',
    'Model, varian dan tahun perlu disahkan sebelum harga bermakna.',
    'Mileage dan keadaan fizikal boleh mengubah nilai dengan ketara.',
    historyAddOnLimitLine(),
    'Pemeriksaan fizikal masih perlu sebelum anda bayar deposit.',
  ]
}

export function homeFaq(): readonly FaqEntry[] {
  return [
    {
      // THE MONEY QUESTION LEADS. It was structured-data only, so the one
      // question a buyer at the paywall actually has was answered for Google
      // and withheld from the page. The five items match the "Apa yang anda
      // dapat" bullets exactly, because they are the same five things.
      q: `Apa yang saya dapat untuk ${BASE_REPORT_LABEL}?`,
      a: 'Keputusan untuk satu kereta: patut teruskan atau tidak, skrip rundingan siap pakai, soalan penting untuk seller, semakan varian supaya harga dibanding varian yang sama, dan checklist sebelum bayar deposit. Setiap laporan dibaca oleh manusia sebelum dihantar.',
    },
    {
      q: 'Kenapa tak semak sendiri di Mudah atau Carlist?',
      a: 'Portal iklan tunjuk kereta yang ada untuk dijual dan harga yang seller minta. Paqar guna maklumat itu untuk cadangkan langkah seterusnya untuk kereta yang anda nak beli — patut teruskan atau tidak, berapa patut ditawarkan, apa yang perlu disahkan dengan seller, dan bila lebih baik cari kereta lain.',
    },
    {
      // Both numbers, derived. It quoted the 24-hour ceiling alone — the
      // pessimistic half of the truth, and a figure the hero contradicts four
      // screens above with "30 minit".
      q: 'Berapa lama untuk dapat laporan?',
      a: `Biasanya ${TYPICAL_MINUTES} minit, dijamin dalam ${REVIEW_SLA_HOURS} jam. Laporan ini bukan auto — seorang manusia baca iklan anda dan semak keputusan sebelum kami hantar.`,
    },
    {
      q: 'Adakah Paqar sama seperti laporan SCRUT atau MyEG?',
      a: competitorComparisonAnswer(BASE_REPORT_LABEL),
    },
    {
      // Previously structured-data only, and the answer a buyer most needs
      // before they trust a report enough to skip a physical inspection.
      q: 'Apakah had atau limitasi Paqar?',
      a: homeLimits().join(' '),
    },
    {
      q: 'Bagaimana jika Paqar tidak dapat siapkan laporan saya?',
      a: 'Duit anda dikembalikan sepenuhnya. Kalau kami tak jumpa cukup iklan setanding untuk kereta itu, kami tak jual keputusan itu.',
    },
    {
      q: 'Adakah saya perlu daftar akaun?',
      a: 'Tidak. Tiada akaun diperlukan.',
    },
    {
      q: 'Adakah Paqar dari JPJ atau PDRM?',
      a: 'Paqar adalah perkhidmatan pihak ketiga — bukan afiliasi JPJ atau PDRM.',
    },
  ]
}

/**
 * FAQPage.mainEntity, built from the same array the accordion renders — so
 * every structured question is one a visitor can actually read on the page.
 */
export function faqMainEntity(entries: readonly FaqEntry[] = homeFaq()) {
  return entries.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  }))
}
