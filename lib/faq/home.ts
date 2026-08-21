/**
 * The homepage FAQ — one source for the accordion AND the FAQPage JSON-LD.
 *
 * WHY THIS IS SHARED
 *
 * The two had drifted: the page rendered four questions while the structured
 * data emitted seven. Three answers existed only for Google — including the
 * limitations answer, which is the most important thing Paqar tells a buyer:
 * that odometer readings are not verified, that not every accident produces a
 * claim record, and that no record found is not proof of a clean car.
 *
 * That is a policy problem as well as a trust one. Google's FAQPage guidance
 * requires the question and answer content to be visible on the page; content
 * present only in the markup does not qualify. So the fix is not to trim the
 * JSON-LD, it is to SHOW the answers — and then to make it impossible for the
 * two lists to disagree again.
 *
 * Same discipline as lib/verdict-copy: when one string has two homes, it
 * eventually has two meanings.
 */

export type FaqEntry = {
  readonly q: string
  readonly a: string
}

export const HOME_FAQ: readonly FaqEntry[] = [
  {
    q: 'Apakah beza semakan percuma dan Laporan Pembeli RM29?',
    // THE BOUNDARY MOVED, and this answer moved with it.
    //
    // It used to say the free check returns a verdict — murah, wajar, mahal —
    // and RM29 adds the figures behind it. That was the RM12 product, and
    // giving away the answer while charging for the footnotes is what a tester
    // objected to. The free surface now answers COVERAGE and nothing else.
    //
    // The add-on exclusion still has to be said rather than implied: a buyer
    // reading this has a locked claim-history row a few centimetres above it.
    a: 'Semakan percuma beritahu sama ada Paqar ada cukup iklan setanding untuk buat keputusan tentang kereta itu — tiada harga, tiada keputusan. Laporan Pembeli (RM29) ialah keputusan itu sendiri: orang kami baca iklan yang anda hantar, banding dengan harga iklan setanding, dan beritahu sama ada patut diteruskan, berapa patut ditawarkan, apa yang perlu ditanya penjual, dan apa yang perlu disemak sebelum bayar deposit. Ia tidak termasuk rekod tuntutan kemalangan atau bacaan odometer — itu semakan berasingan (+RM88).',
  },
  {
    q: 'Adakah saya perlu daftar akaun?',
    a: 'Tidak. Tiada akaun diperlukan.',
  },
  {
    q: 'Boleh guna sebelum tengok kereta?',
    a: 'Ya. Sesuai guna sebelum pergi tengok kereta atau sebelum bayar deposit.',
  },
  {
    q: 'Adakah Paqar dari JPJ atau PDRM?',
    a: 'Paqar adalah perkhidmatan pihak ketiga — bukan afiliasi JPJ atau PDRM.',
  },
  {
    // Previously structured-data only. It is the answer a buyer most needs
    // before they trust a report enough to skip a physical inspection.
    q: 'Apakah had atau limitasi Paqar?',
    a: 'Paqar tidak mengesahkan bacaan odometer sebenar. Tidak semua kemalangan mempunyai rekod tuntutan insurans. Tiada rekod tuntutan bukan bukti bahawa kereta bebas kemalangan. Buat pemeriksaan fizikal sebelum bayar deposit.',
  },
]

/**
 * FAQPage.mainEntity, built from the same array the accordion renders — so
 * every structured question is one a visitor can actually read on the page.
 */
export function faqMainEntity(entries: readonly FaqEntry[] = HOME_FAQ) {
  return entries.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  }))
}
