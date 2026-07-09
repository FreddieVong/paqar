// Variant decision guides — opinionated buyer guidance, NOT spec sheets.
// Hard rules: max 3 differentiators per variant (only what separates it from
// the tier below), every variant gets a verdict, price bands use "biasanya"
// hedging. Facts are stable launch specs; researched once, they don't rot.
// Shared by /varian/[model] pages (Discovery) and the paid report's
// Semakan Varian card (Verification).

export type VariantVerdict = 'best-value' | 'ok' | 'avoid' | 'worth-it-if'

export interface VariantInfo {
  name:            string
  verdict:         VariantVerdict
  verdictNote:     string
  differentiators: string[]   // max 3
  usedPriceBand:   string
  spotChecks:      string[]
}

export interface VariantGeneration {
  label:    string
  years:    string
  variants: VariantInfo[]
}

export interface VariantGuide {
  modelSlug:  string   // matches model-hub slugs (perodua-myvi)
  make:       string
  model:      string
  brand:      string
  question:   string
  answerLine: string   // the one-line answer under the H1
  bestValue:  string
  avoid:      string | null
  generations: VariantGeneration[]
  redFlags:   string[]
  reconNote?: string
  hubHref?:   string   // price-hub link override when no /harga-kereta-terpakai/[modelSlug] page exists
  faq:        { q: string; a: string }[]
}

export const VARIANT_GUIDES: Record<string, VariantGuide> = {
  'perodua-myvi': {
    modelSlug: 'perodua-myvi',
    make: 'Perodua', model: 'Myvi', brand: 'Perodua',
    question: 'Myvi varian mana patut anda beli?',
    answerLine: 'Untuk kebanyakan pembeli: 1.5 H — kit hampir penuh tanpa bayar harga AV. Bajet ketat? 1.3 X pun cukup.',
    bestValue: '1.5 H',
    avoid: '1.3 G (Standard) lama — tiada kit keselamatan penting',
    generations: [
      {
        label: 'Generasi 3',
        years: '2018–kini',
        variants: [
          {
            name: '1.3 G (Standard)',
            verdict: 'avoid',
            verdictNote: 'Elak jika ada pilihan — beza harga dengan X terlalu kecil untuk apa yang anda hilang.',
            differentiators: [
              'Rim besi dengan penutup (bukan sports rim)',
              'Tiada sistem ASA (brek kecemasan automatik)',
              'Lampu halogen, bukan LED',
            ],
            usedPriceBand: 'Termurah — tapi biasanya hanya RM1–2k bawah X',
            spotChecks: [
              'Rim besi berpenutup plastik',
              'Tiada butang ASA berhampiran stereng',
            ],
          },
          {
            name: '1.3 X',
            verdict: 'ok',
            verdictNote: 'Pilihan bajet yang okay — dapat ASA pada kebanyakan tahun.',
            differentiators: [
              'ASA pada unit 2020 ke atas (sahkan!)',
              'Sports rim 14 inci',
              'Skrin audio asas',
            ],
            usedPriceBand: 'Biasanya RM1–2k atas G, RM2–3k bawah H',
            spotChecks: [
              'Sahkan ASA: ada butang OFF ASA di kanan stereng',
              'Rim sport 14 inci (bukan penutup plastik)',
            ],
          },
          {
            name: '1.5 H',
            verdict: 'best-value',
            verdictNote: 'Nilai terbaik — enjin 1.5, kit hampir penuh, tanpa harga AV.',
            differentiators: [
              'Enjin 1.5L — lebih bertenaga untuk lebuh raya',
              'ASA + lampu LED',
              'Skrin sentuh + kamera undur',
            ],
            usedPriceBand: 'Biasanya RM2–4k atas X, RM2–3k bawah AV',
            spotChecks: [
              'Emblem "1.5" di belakang',
              'Lampu depan LED (bukan halogen kekuningan)',
              'Kamera undur pada skrin bila masuk gear R',
            ],
          },
          {
            name: '1.5 AV',
            verdict: 'worth-it-if',
            verdictNote: 'Berbaloi jika anda mahu kit penuh dan bezanya dengan H kurang dari RM3k.',
            differentiators: [
              'Kerusi separa kulit',
              'ASA penuh + lampu LED auto',
              'Skrin lebih besar dengan navigasi',
            ],
            usedPriceBand: 'Varian termahal — biasanya RM2–3k atas H',
            spotChecks: [
              'Kerusi separa kulit (bukan fabrik penuh)',
              'Emblem "AV" di belakang',
              'Sensor auto-lampu berfungsi',
            ],
          },
        ],
      },
    ],
    redFlags: [
      'Iklan kata "H" atau "AV" tapi kereta ada rim penutup plastik atau kerusi fabrik penuh — kemungkinan varian bawah yang di-badge semula',
      'Emblem varian boleh dibeli dan ditampal — sahkan dengan ciri sebenar, bukan emblem',
      'Harga AV tapi tiada geran/rekod menunjukkan varian — minta penjual tunjukkan surat asal',
    ],
    faq: [
      {
        q: 'Apa beza Myvi H dengan AV?',
        a: 'Kedua-duanya guna enjin 1.5L dengan ASA. AV tambah kerusi separa kulit, lampu auto, dan skrin dengan navigasi. Beza harga terpakai biasanya RM2–3k — berbaloi hanya jika anda mahu kit penuh.',
      },
      {
        q: 'Myvi varian mana paling berbaloi untuk dibeli terpakai?',
        a: '1.5 H — anda dapat enjin 1.5, ASA, LED dan kamera undur tanpa bayar premium AV. Untuk bajet ketat, 1.3 X (2020 ke atas, dengan ASA) adalah pilihan kedua yang baik.',
      },
      {
        q: 'Macam mana nak tahu Myvi tu betul-betul varian AV?',
        a: 'Jangan percaya emblem sahaja — emblem boleh ditampal. Sahkan ciri sebenar: kerusi separa kulit, lampu auto, dan skrin navigasi. Laporan Paqar juga menunjukkan varian rasmi berdasarkan rekod kenderaan.',
      },
      {
        q: 'Myvi 1.3 ke 1.5 — mana patut pilih?',
        a: '1.3 cukup untuk guna bandar dan lebih jimat minyak sedikit. 1.5 lebih selesa untuk lebuh raya dan membawa penumpang penuh. Jika kerap ke luar bandar, pilih 1.5.',
      },
    ],
  },

  'toyota-alphard': {
    modelSlug: 'toyota-alphard',
    make: 'Toyota', model: 'Alphard', brand: 'Toyota',
    question: 'Alphard varian mana patut anda beli?',
    answerLine: 'Untuk kebanyakan pembeli: 2.5 G — kerusi kapten dan kit cukup. SC berbaloi untuk rupa; Executive Lounge hanya jika bajet bukan isu.',
    bestValue: '2.5 G',
    avoid: null,
    generations: [
      {
        label: 'AH30',
        years: '2015–2023',
        variants: [
          {
            name: '2.5 X',
            verdict: 'ok',
            verdictNote: 'Varian asas 8 tempat duduk — okay untuk kegunaan keluarga besar, tapi jangan bayar harga G.',
            differentiators: [
              '8 tempat duduk (bangku baris kedua, bukan kerusi kapten)',
              'Kerusi fabrik, kit paling asas',
              'Rim 16/17 inci lebih kecil',
            ],
            usedPriceBand: 'Termurah — biasanya RM15–25k bawah G tahun sama',
            spotChecks: [
              'Baris kedua: bangku 3 tempat duduk (bukan 2 kerusi kapten)',
              'Kerusi fabrik, bukan kulit',
            ],
          },
          {
            name: '2.5 G',
            verdict: 'best-value',
            verdictNote: 'Nilai terbaik — kerusi kapten baris kedua dan kit selesa, tanpa premium SC/EL.',
            differentiators: [
              '7 tempat duduk dengan kerusi kapten baris kedua',
              'Kerusi kulit + pintu elektrik dua belah',
              'Kit dalaman jauh lebih lengkap dari X',
            ],
            usedPriceBand: 'Pertengahan — biasanya RM15–25k atas X, RM10–20k bawah SC',
            spotChecks: [
              '2 kerusi kapten di baris kedua dengan penyandar kaki',
              'Pintu gelangsar elektrik kiri DAN kanan',
            ],
          },
          {
            name: '2.5 SC',
            verdict: 'worth-it-if',
            verdictNote: 'Berbaloi jika anda mahu rupa sporty — mekanikalnya sama dengan G.',
            differentiators: [
              'Lampu depan 3-mata LED (ciri paling mudah dicam)',
              'Bodykit aero + rim 18 inci',
              'Dalaman hitam dengan siling suede',
            ],
            usedPriceBand: 'Biasanya RM10–20k atas G tahun sama',
            spotChecks: [
              'Lampu depan 3-mata LED ASLI (bukan retrofit)',
              'Rim 18 inci asal',
              'Siling gelap/suede (G siling cerah)',
            ],
          },
          {
            name: '3.5 Executive Lounge',
            verdict: 'worth-it-if',
            verdictNote: 'Flagship 3.5L — hanya jika bajet bukan isu. Kos penyelenggaraan dan minyak jauh lebih tinggi.',
            differentiators: [
              'Enjin 3.5L V6 (bukan 2.5L)',
              'Kerusi Executive Lounge dengan konsol belakang',
              'Kit tertinggi dalam semua aspek',
            ],
            usedPriceBand: 'Jauh melebihi SC — pastikan rekod mengesahkan ia benar-benar EL',
            spotChecks: [
              'Emblem "3.5" / "Executive Lounge"',
              'Konsol tengah penuh di antara kerusi belakang',
              'Bunyi enjin V6 6-silinder',
            ],
          },
        ],
      },
    ],
    redFlags: [
      'PALING BIASA: bodykit SC dan lampu 3-mata retrofit dipasang pada varian X/G, dijual pada harga SC — sahkan dengan rekod, bukan rupa',
      'Alphard kebanyakannya import recon — sesetengah unit tiada rekod varian tempatan yang lengkap',
      'Beza harga antara varian besar (boleh cecah RM20k+) — silap varian bermakna terlebih bayar besar',
      '8 tempat duduk dijual sebagai "7-seater kerusi kapten" — kira kerusi baris kedua sendiri',
    ],
    reconNote: 'Kebanyakan Alphard di Malaysia adalah import recon. Rekod varian rasmi tempatan mungkin tidak lengkap untuk unit recon — sahkan varian dengan ciri fizikal, bukan emblem atau iklan.',
    hubHref: '/harga-toyota-terpakai',
    faq: [
      {
        q: 'Apa beza Alphard SC dengan G?',
        a: 'Mekanikalnya sama (2.5L). SC tambah rupa: lampu 3-mata LED, bodykit aero, rim 18 inci, dan dalaman gelap. Beza harga terpakai biasanya RM10–20k. Awas: bodykit SC boleh dipasang pada varian lain — sahkan lampu 3-mata asli.',
      },
      {
        q: 'Alphard varian mana paling berbaloi?',
        a: '2.5 G — anda dapat kerusi kapten, kulit, dan pintu elektrik dua belah tanpa premium SC. Varian X lebih murah tapi bangku fabrik 8 tempat duduk terasa jauh lebih asas.',
      },
      {
        q: 'Macam mana nak tahu Alphard tu betul-betul SC?',
        a: 'Jangan percaya bodykit — ia boleh dipasang kemudian. SC asli ada lampu depan 3-mata LED dari kilang, rim 18 inci asal, dan siling suede gelap. Semak juga rekod kenderaan jika tersedia.',
      },
      {
        q: 'Alphard 2.5 ke 3.5 — apa bezanya?',
        a: '3.5L V6 lebih bertenaga tapi cukai jalan, minyak, dan penyelenggaraan jauh lebih mahal. Untuk kegunaan keluarga biasa, 2.5L sudah memadai — kebanyakan unit di Malaysia adalah 2.5L.',
      },
    ],
  },
}

export function findGuideByMakeModel(make?: string | null, model?: string | null): VariantGuide | null {
  if (!make || !model) return null
  const m = make.toLowerCase().trim()
  const mo = model.toLowerCase().trim()
  for (const guide of Object.values(VARIANT_GUIDES)) {
    if (guide.make.toLowerCase() === m && (mo.includes(guide.model.toLowerCase()) || guide.model.toLowerCase().includes(mo))) {
      return guide
    }
  }
  return null
}
