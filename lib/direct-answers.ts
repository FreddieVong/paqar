/**
 * Direct answers for the pages that measurably rank.
 *
 * ── WHY THESE PAGES, AND NOT THE YEAR PAGES ────────────────────────────────
 *
 * Search Console, 56 days to 2026-08-13, measured directly:
 *
 *   /varian/perodua-bezza      364 impressions   3 clicks   avg position  8.9
 *   /bandingkan/alza-vs-x50    168 impressions   1 click    avg position  8.4
 *   /varian/honda-city         142 impressions   3 clicks   avg position 12.4
 *   ── every /harga-{model}-{year} page combined ──
 *                               ~46 impressions  0 clicks   avg position 41
 *
 * An earlier version of this work put its effort into twelve year pages. That
 * was wrong and the data says so plainly: five of the 58 year pages registered
 * a single impression in 28 days. No conversion treatment earns anything from
 * traffic that does not arrive.
 *
 * These three pages already rank between positions 8 and 13 for questions
 * buyers actually type, and take almost no clicks. That is a snippet-and-answer
 * problem on pages Google has already decided to show, which is the one kind of
 * SEO problem where a content change has a short, visible feedback loop.
 *
 * ── WHAT EACH ENTRY IS FOR ─────────────────────────────────────────────────
 *
 * The searcher's question, answered in the first screen, before anything is
 * asked of them. The conversion bridge comes AFTER the answer is complete —
 * holding the answer hostage behind a CTA is how a page earns a bounce and
 * teaches Google the result was unsatisfying.
 *
 * Every fact here is already stated in lib/variant-guides.ts or in the
 * comparison config, and is drawn from launch specifications rather than
 * inferred from market data. Nothing here is derived from a price distribution,
 * so nothing here touches the free/paid boundary — see lib/market-teaser.ts.
 */

export interface AnswerRow {
  /** Row label, e.g. "Enjin". */
  label: string
  /** Left column — the first option named in the query. */
  a:     string
  /** Right column. */
  b:     string
}

export interface DirectAnswer {
  /**
   * The dominant query this page already ranks for, verbatim from Search
   * Console, with its measured position. Recorded so a later reader can tell
   * whether the copy still serves the query that justified it.
   */
  query:        string
  measuredPos:  number
  /** Heading, phrased as the searcher phrases it. */
  heading:      string
  /** One or two sentences. The answer, before anything else on the page. */
  answer:       string
  /** Column headers for the table. */
  columnA:      string
  columnB:      string
  rows:         AnswerRow[]
  /** Who each option suits — the judgement a spec table cannot make. */
  suitsA:       string
  suitsB:       string
  /** The single most important thing to check on a used unit. */
  caveat:       string
  /** Conversion bridge, AFTER the answer. Page-specific, natural Malay. */
  bridge:       string
}

/**
 * Keyed by public path. A page without an entry renders exactly as before —
 * this is additive, and deliberately covers three pages rather than every page
 * that might one day want one.
 */
export const DIRECT_ANSWERS: Record<string, DirectAnswer> = {
  '/varian/perodua-bezza': {
    // 19 impressions at position 7.2; the 1.0-versus-1.3 intent accounts for
    // 8 of the page's top 12 attributed queries, including "bezza berapa
    // silinder" — which is the same question asked about the engine.
    query:       'beza bezza 1.0 dan 1.3',
    measuredPos: 7.2,
    heading:     'Apa beza Bezza 1.0 dan 1.3?',
    answer:
      'Bezza 1.0 guna enjin tiga silinder; Bezza 1.3 guna empat silinder. Itu perbezaan yang paling ' +
      'anda rasa: 1.3 lebih lancar dan lebih senyap, terutama di lebuh raya dan bila kereta penuh ' +
      'penumpang. 1.0 lebih jimat minyak dan lebih murah untuk dibeli.',
    columnA: 'Bezza 1.0',
    columnB: 'Bezza 1.3',
    rows: [
      { label: 'Enjin',            a: '1.0L, 3 silinder',                 b: '1.3L, 4 silinder' },
      { label: 'Rasa pemanduan',   a: 'Cukup untuk bandar; bekerja keras bila penuh', b: 'Lebih lancar dan senyap, lebih selesa di lebuh raya' },
      { label: 'Bunyi enjin',      a: 'Lebih kasar semasa idle',          b: 'Lebih halus' },
      { label: 'Minyak',           a: 'Paling jimat',                     b: 'Kurang jimat sedikit' },
      { label: 'Kit',              a: 'Paling asas — skrin dan rim ringkas', b: 'Kit harian lengkap pada varian X' },
      { label: 'Pilihan terpakai', a: 'Lebih sedikit; banyak manual',     b: 'Paling banyak pilihan di pasaran' },
      { label: 'Cara cam',         a: 'Emblem "1.0" di belakang',         b: 'Emblem "1.3" di belakang' },
    ],
    suitsA: 'Sesuai jika anda guna dalam bandar sahaja dan bajet betul-betul ketat.',
    suitsB: 'Sesuai untuk kebanyakan pembeli — terutama jika anda kerap ke lebuh raya atau bawa penumpang penuh. Varian 1.3 X biasanya pilihan paling berbaloi.',
    caveat:
      'Bezza adalah antara kereta e-hailing paling popular di Malaysia, jadi banyak unit terpakai ' +
      'pernah digunakan untuk Grab dengan jarak tempuh sangat tinggi. Semak kehausan kerusi pemandu, ' +
      'kesan pemegang telefon di dashboard, dan pastikan jarak tempuh munasabah dengan keadaan pedal ' +
      'dan stereng. Emblem "Advance" juga boleh ditampal pada varian X — sahkan dengan butang ' +
      'push-start, bukan emblem.',
    bridge:
      'Dah jumpa Bezza yang anda sedang pertimbangkan? Semak sama ada harga unit itu berpatutan ' +
      'sebelum bayar deposit.',
  },

  '/varian/honda-city': {
    // "beza honda city e dan v" at 9.6, "honda city e vs v" at 10.0,
    // "beza honda city s dan e" at 7.0 — one intent, three phrasings.
    query:       'beza honda city e dan v',
    measuredPos: 9.6,
    heading:     'Apa beza Honda City E dan V?',
    answer:
      'Enjin dan gearbox sama. Yang V tambah ialah keselesaan dan kit keselamatan — kerusi separa ' +
      'kulit, lampu LED penuh dan skrin lebih besar. Untuk kebanyakan pembeli, varian E sudah cukup ' +
      'lengkap untuk kegunaan harian.',
    columnA: 'Honda City E',
    columnB: 'Honda City V',
    rows: [
      { label: 'Enjin dan gearbox', a: 'Sama dengan V',                    b: 'Sama dengan E' },
      { label: 'Kerusi',            a: 'Fabrik',                           b: 'Separa kulit' },
      { label: 'Lampu depan',       a: 'Halogen',                          b: 'LED penuh' },
      { label: 'Skrin',             a: 'Skrin sentuh',                     b: 'Skrin lebih besar dengan sambungan telefon' },
      { label: 'Kit keselamatan',   a: 'Asas generasi berkenaan',          b: 'Lebih lengkap — sahkan Honda Sensing ikut tahun' },
      { label: 'Cara cam',          a: 'Kerusi fabrik, lampu halogen',     b: 'Kerusi separa kulit, lampu LED' },
    ],
    suitsA: 'Sesuai untuk kebanyakan pembeli — kit harian cukup tanpa bayar premium varian atas.',
    suitsB: 'Berbaloi jika anda mahu kit penuh dan beza harga dengan E tidak besar.',
    caveat:
      'Honda City adalah antara model paling terjejas banjir Disember 2021 di Lembah Klang, dan unit ' +
      'tersebut masih beredar di pasaran. Semak bau lembap atau pewangi yang terlalu kuat, karat pada ' +
      'rel kerusi dan bawah karpet, wap air dalam lampu, dan elektronik yang tidak konsisten. Iklan ' +
      'yang kata "V" tetapi kerusinya fabrik dan lampunya halogen berkemungkinan varian bawah.',
    bridge:
      'Dah jumpa Honda City yang berkenan? Semak sama ada harga yang diminta berpatutan sebelum ' +
      'anda bayar deposit.',
  },

  '/bandingkan/alza-vs-x50': {
    // 168 impressions at average position 8.4 over 56 days, 1 click. Only two
    // queries are attributed ("alza vs x50" at position 5.0); the rest sit in
    // Search Console's anonymised bucket, which is where 68% of Paqar's
    // impressions live.
    query:       'alza vs x50',
    measuredPos: 5.0,
    heading:     'Alza atau X50 — mana satu patut anda beli?',
    answer:
      'Kedua-duanya buat kerja yang berbeza. Alza ialah MPV tujuh tempat duduk: pilih jika anda ' +
      'memang perlu baris ketiga. X50 ialah SUV kompak lima tempat duduk dengan enjin turbo dan kit ' +
      'teknologi yang lebih lengkap. Kalau anda tidak perlu tujuh tempat duduk, soalan sebenarnya ' +
      'bukan Alza atau X50 — tetapi berapa banyak teknologi yang anda mahu bayar.',
    columnA: 'Perodua Alza',
    columnB: 'Proton X50',
    rows: [
      { label: 'Bentuk',        a: 'MPV 7 tempat duduk',                b: 'SUV kompak 5 tempat duduk' },
      { label: 'Enjin',         a: 'Aspirasi asli',                     b: 'Turbo 1.5L' },
      { label: 'Kekuatan',      a: 'Praktikal, murah diselenggara',     b: 'Kit teknologi dan ADAS lebih lengkap' },
      { label: 'Baris ketiga',  a: 'Ada',                               b: 'Tiada' },
      { label: 'Sesuai untuk',  a: 'Keluarga besar, jarak jauh',        b: 'Keluarga kecil, pemandu bandar' },
    ],
    suitsA: 'Pilih Alza jika baris ketiga adalah keperluan sebenar, bukan pilihan tambahan.',
    suitsB: 'Pilih X50 jika lima tempat duduk memadai dan anda mahu kit keselamatan serta teknologi yang lebih moden.',
    caveat:
      'Untuk Alza terpakai, periksa keadaan tempat duduk baris ketiga dan mekanisme lipatannya — ' +
      'bahagian ini paling kerap diabaikan. Untuk X50, sahkan sistem ADAS berfungsi dan semak rekod ' +
      'servis minyak enjin dengan teliti; komponen turbo dan ADAS mahal jika rosak.',
    bridge:
      'Dah pilih antara Alza dan X50? Semak sama ada harga unit yang anda jumpa berpatutan sebelum ' +
      'bayar deposit.',
  },
}

export function directAnswerFor(path: string): DirectAnswer | null {
  return DIRECT_ANSWERS[path] ?? null
}

/** Paths carrying the treatment — the measurement cohort. */
export const DIRECT_ANSWER_PATHS = Object.keys(DIRECT_ANSWERS)
