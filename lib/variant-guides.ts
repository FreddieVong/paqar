// Variant decision guides — opinionated buyer guidance, NOT spec sheets.
// Hard rules: max 3 differentiators per variant (only what separates it from
// the tier below), every variant gets a verdict, price bands use "biasanya"
// hedging. Facts are stable launch specs; researched once, they don't rot.
// Shared by /varian/[model] pages (Discovery) and the paid report's
// Semakan Varian card (Verification).

export type VariantVerdict = 'best-value' | 'ok' | 'avoid' | 'worth-it-if'

export interface VariantInfo {
  name:            string
  years?:          string     // only when availability differs from the generation span
  matchTokens?:    string[]   // uppercase whole tokens that identify this variant in
                              // official record strings; fallback derives from name
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
    bestValue: '1.5 H (2018–kini)',
    avoid: '1.3 G tanpa ASA · 1.0 EZ lama — enjin lemah',
    generations: [
      {
        label: 'Generasi 1',
        years: '2005–2011',
        variants: [
          {
            name: '1.0 EZ',
            matchTokens: ['1.0'],
            verdict: 'avoid',
            verdictNote: 'Elak — enjin 1.0 tiga silinder tak larat bila penuh penumpang, dan harga terpakai hampir sama dengan 1.3.',
            differentiators: [
              'Enjin 1.0 (bukan 1.3) — lemah untuk lebuh raya',
              'Kit paling asas — biasanya tiada ABS dan airbag',
            ],
            usedPriceBand: 'Termurah — tapi biasanya cuma RM1–2k bawah 1.3',
            spotChecks: [
              'Semak cc pada geran: bawah 1,000cc bermakna 1.0',
            ],
          },
          {
            name: '1.3 EZ (auto) / SX (manual)',
            matchTokens: ['1.3', 'EZ'],
            verdict: 'ok',
            verdictNote: 'Pilihan bajet yang okay — enjin 1.3 yang sama dengan EZi, tapi kit keselamatan asas.',
            differentiators: [
              'Enjin 1.3 sama dengan EZi/SXi',
              'Biasanya tiada ABS dan airbag — sahkan ikut unit',
              'Rim besi dengan penutup',
            ],
            usedPriceBand: 'Biasanya RM1–2k bawah EZi/SXi',
            spotChecks: [
              'Rim besi berpenutup plastik',
              'Tiada tanda SRS AIRBAG pada dashboard penumpang',
            ],
          },
          {
            name: '1.3 EZi (auto) / SXi (manual)',
            matchTokens: ['EZI'],
            verdict: 'best-value',
            verdictNote: 'Nilai terbaik generasi ini — dual airbag dan ABS dengan beza harga yang kecil.',
            differentiators: [
              'Dual airbag + ABS (varian bawah biasanya tiada)',
              'Rim aloi asal kilang',
              'Kit dalaman lebih lengkap',
            ],
            usedPriceBand: 'Biasanya RM1–2k atas EZ/SX',
            spotChecks: [
              'Tanda SRS AIRBAG di dashboard sisi penumpang',
              'Rim aloi (bukan penutup plastik)',
            ],
          },
          {
            name: '1.3 SE',
            matchTokens: ['SE'],
            verdict: 'worth-it-if',
            verdictNote: 'Berbaloi jika anda suka rupa sport dan bezanya dengan EZi tak lebih RM1–2k — mekanikalnya sama.',
            differentiators: [
              'Bodykit + spoiler asal kilang',
              'Rim aloi lebih sport',
            ],
            usedPriceBand: 'Biasanya paling mahal dalam generasi ini',
            spotChecks: [
              'Bodykit dan spoiler nampak asal, bukan tampal aftermarket',
              'Sahkan varian pada geran — badge SE senang ditiru',
            ],
          },
        ],
      },
      {
        label: 'Generasi 2 (Lagi Best)',
        years: '2011–2017',
        variants: [
          {
            name: '1.3 Standard (G)',
            matchTokens: ['G'],
            verdict: 'ok',
            verdictNote: 'Okay untuk bajet — tapi kit keselamatan berbeza ikut tahun, sahkan sebelum beli.',
            differentiators: [
              'Kit paling asas dalam generasi ini',
              'ABS tiada pada sesetengah tahun — sahkan',
            ],
            usedPriceBand: 'Termurah — biasanya RM1–2k bawah Premium',
            spotChecks: [
              'Tanya penjual sahkan ABS dan bilangan airbag',
              'Rim besi berpenutup = Standard',
            ],
          },
          {
            name: '1.3 Premium (X)',
            matchTokens: ['X'],
            verdict: 'best-value',
            verdictNote: 'Nilai terbaik generasi ini — kit cukup, harga tak jauh dari Standard.',
            differentiators: [
              'Rim aloi + kit luaran lebih kemas',
              'Audio dan dalaman lebih lengkap',
            ],
            usedPriceBand: 'Biasanya RM1–2k atas Standard',
            spotChecks: [
              'Rim aloi asal kilang',
              'Padankan varian pada geran atau rekod — bukan emblem',
            ],
          },
          {
            name: '1.5 SE',
            matchTokens: ['SE'],
            verdict: 'worth-it-if',
            verdictNote: 'Berbaloi jika anda nak enjin 1.5 dan beza dengan 1.3 Premium bawah RM2k.',
            differentiators: [
              'Enjin 1.5 — lebih selesa untuk lebuh raya',
              'Bodykit SE + rim lebih besar',
            ],
            usedPriceBand: 'Biasanya RM2–3k atas 1.3 Premium',
            spotChecks: [
              'Sahkan 1.5 dengan cc pada geran — bukan emblem sahaja',
              'Bodykit SE asal kilang',
            ],
          },
          {
            name: '1.5 Advance',
            years: '2015–2017 (sebelum facelift dipanggil Extreme)',
            matchTokens: ['ADVANCE'],
            verdict: 'worth-it-if',
            verdictNote: 'Trim tertinggi — berbaloi jika nak kit penuh dan bezanya dengan SE kecil.',
            differentiators: [
              'Kerusi kulit + skrin sentuh dengan navigasi',
              'Kit paling lengkap dalam generasi ini',
            ],
            usedPriceBand: 'Termahal — biasanya RM1–2k atas SE',
            spotChecks: [
              'Kerusi kulit asal, bukan sarung aftermarket',
              'Skrin sentuh dengan navigasi berfungsi',
            ],
          },
        ],
      },
      {
        label: 'Generasi 3',
        years: '2018–kini',
        variants: [
          {
            name: '1.3 G (Standard)',
          matchTokens: ['G'],
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
          matchTokens: ['X'],
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
          matchTokens: ['H'],
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
          matchTokens: ['AV'],
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
      {
        q: 'Myvi lama (2005–2017) masih berbaloi beli?',
        a: 'Boleh — Myvi pegang nilai dan alat ganti murah. Untuk 2005–2011, pilih 1.3 EZi/SXi yang ada airbag dan ABS. Untuk 2011–2017, 1.3 Premium cukup untuk kebanyakan orang. Pada umur ini, kondisi dan rekod servis lebih penting dari varian.',
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
          matchTokens: ['X'],
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
          matchTokens: ['G'],
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
          matchTokens: ['SC'],
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
          matchTokens: ['EXECUTIVE', 'LOUNGE', '3.5'],
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

const BEZZA_GUIDE: VariantGuide = {
  modelSlug: 'perodua-bezza',
  make: 'Perodua', model: 'Bezza', brand: 'Perodua',
  question: 'Bezza varian mana patut anda beli?',
  answerLine: 'Untuk kebanyakan pembeli: 1.3 X — enjin 4 silinder yang lebih lancar dengan kit cukup. 1.0 G hanya jika bajet sangat ketat dan guna bandar sahaja.',
  bestValue: '1.3 X',
  avoid: null,
  generations: [
    {
      label: 'Generasi 1',
      years: '2016–kini',
      variants: [
        {
          name: '1.0 G',
          matchTokens: ['G', '1.0'],
          verdict: 'worth-it-if',
          verdictNote: 'Berbaloi jika bajet sangat ketat dan kegunaan bandar sahaja — enjin 3 silinder terasa mengah di lebuh raya dengan muatan penuh.',
          differentiators: [
            'Enjin 1.0L 3 silinder — paling jimat minyak, tapi kurang bertenaga',
            'Kit paling asas — skrin dan rim lebih ringkas',
            'Pilihan manual masih banyak di pasaran',
          ],
          usedPriceBand: 'Termurah — biasanya RM2–4k bawah 1.3 X tahun sama',
          spotChecks: [
            'Emblem "1.0" di belakang',
            'Bunyi enjin 3 silinder lebih kasar semasa idle',
          ],
        },
        {
          name: '1.3 X',
          matchTokens: ['X'],
          verdict: 'best-value',
          verdictNote: 'Nilai terbaik — enjin 1.3 4 silinder lebih lancar dan senyap, kit harian cukup, dan paling mudah dijual semula.',
          differentiators: [
            'Enjin 1.3L 4 silinder — lebih selesa untuk lebuh raya',
            'Kit harian lengkap tanpa premium varian atas',
            'Paling banyak pilihan di pasaran terpakai',
          ],
          usedPriceBand: 'Biasanya RM2–4k atas 1.0 G, RM2–3k bawah Advance/AV',
          spotChecks: [
            'Emblem "1.3" di belakang',
            'Sahkan butang VSC jika iklan kata ada (bukan semua tahun)',
          ],
        },
        {
          name: '1.3 Advance / AV',
          matchTokens: ['ADVANCE', 'AV'],
          years: 'Advance: 2016–2019 · AV: 2020+',
          verdict: 'worth-it-if',
          verdictNote: 'Berbaloi jika beza dengan X kurang dari RM3k — anda dapat push-start dan kit keselamatan tambahan.',
          differentiators: [
            'Butang push-start + kunci pintar',
            'VSC (dan ASA pada AV 2020 ke atas)',
            'Kerusi separa kulit + sandaran tangan belakang',
          ],
          usedPriceBand: 'Varian termahal — biasanya RM2–3k atas X',
          spotChecks: [
            'Butang START/STOP (bukan lubang kunci) — emblem "Advance" boleh ditampal, butang tak boleh',
            'Kerusi separa kulit',
            'AV 2020+: butang ASA berhampiran stereng',
          ],
        },
      ],
    },
  ],
  redFlags: [
    'Bezza adalah kereta e-hailing paling popular — banyak unit ex-Grab dengan mileage sangat tinggi. Semak kerusi pemandu haus, kesan pelekat/pemegang telefon di dashboard',
    'Mileage rendah pada unit 5+ tahun patut disyaki — bandingkan dengan keadaan pedal, stereng dan kerusi',
    'Emblem "Advance" ditampal pada varian X — sahkan dengan butang push-start, bukan emblem',
  ],
  faq: [
    {
      q: 'Bezza 1.0 ke 1.3 — mana patut pilih?',
      a: '1.3 untuk kebanyakan orang — 4 silinder lebih lancar, senyap, dan tidak mengah di lebuh raya. 1.0 hanya berbaloi jika bajet sangat ketat dan kegunaan bandar sahaja. Beza penggunaan minyak sebenar tidak sebesar yang disangka.',
    },
    {
      q: 'Bezza varian mana paling berbaloi untuk dibeli terpakai?',
      a: '1.3 X — kit cukup, enjin yang betul, dan paling mudah dijual semula. Advance/AV berbaloi hanya jika bezanya dengan X kurang dari RM3k.',
    },
    {
      q: 'Macam mana nak tahu Bezza tu bekas Grab atau e-hailing?',
      a: 'Semak kehausan kerusi pemandu berbanding kerusi lain, kesan pemegang telefon di dashboard, dan keadaan pedal. Mileage sangat tinggi (atau mencurigakan rendah untuk umur kereta) adalah petanda. Laporan Paqar juga semak sama ada mileage munasabah untuk umur kereta.',
    },
    {
      q: 'Kenapa harga Bezza terpakai kekal tinggi?',
      a: 'Permintaan tinggi — jimat minyak, kos servis rendah, dan popular untuk e-hailing. Nilai jual semula yang kuat bermakna anda juga tidak banyak rugi bila jual nanti.',
    },
  ],
}

const CITY_GUIDE: VariantGuide = {
  modelSlug: 'honda-city',
  make: 'Honda', model: 'City', brand: 'Honda',
  question: 'Honda City varian mana patut anda beli?',
  answerLine: 'Untuk kebanyakan pembeli: varian E — kit harian cukup tanpa premium varian V. Hybrid berbaloi hanya dengan rekod servis Honda yang penuh.',
  bestValue: 'E',
  avoid: null,
  generations: [
    {
      label: 'Generasi 6 (GM6)',
      years: '2014–2019',
      variants: [
        {
          name: 'S',
          matchTokens: ['S'],
          verdict: 'worth-it-if',
          verdictNote: 'Berbaloi jika harga jelas lebih murah dari E — kit sangat asas untuk kereta kelas ini.',
          differentiators: [
            'Rim besi berpenutup, lampu halogen',
            'Radio asas tanpa skrin sentuh',
            'Kit paling minimum dalam barisan',
          ],
          usedPriceBand: 'Termurah — biasanya RM2–4k bawah E',
          spotChecks: [
            'Rim besi berpenutup plastik',
            'Tiada skrin sentuh di tengah dashboard',
          ],
        },
        {
          name: 'E',
          matchTokens: ['E'],
          verdict: 'best-value',
          verdictNote: 'Nilai terbaik — sports rim, skrin sentuh dan kunci pintar, tanpa harga varian V.',
          differentiators: [
            'Sports rim 16 inci + skrin sentuh',
            'Kunci pintar dengan push-start',
            'Kit harian yang cukup untuk kebanyakan orang',
          ],
          usedPriceBand: 'Biasanya RM2–4k atas S, RM3–5k bawah V',
          spotChecks: [
            'Butang push-start',
            'Sports rim (bukan penutup plastik)',
          ],
        },
        {
          name: 'V',
          matchTokens: ['V'],
          verdict: 'worth-it-if',
          verdictNote: 'Berbaloi jika anda mahu kit penuh dan bezanya dengan E kurang dari RM4k.',
          differentiators: [
            'Kerusi separa kulit + lampu LED',
            '6 beg udara (varian bawah biasanya kurang)',
            'Kamera undur berbilang sudut',
          ],
          usedPriceBand: 'Biasanya RM3–5k atas E',
          spotChecks: [
            'Kerusi separa kulit',
            'Lampu depan LED (bukan halogen)',
          ],
        },
        {
          name: 'Sport Hybrid (i-DCD)',
          matchTokens: ['HYBRID'],
          years: '2017–2019 sahaja',
          verdict: 'worth-it-if',
          verdictNote: 'Hanya dengan rekod servis Honda yang penuh — sistem hibrid i-DCD dan bateri berumur adalah risiko kos yang sebenar.',
          differentiators: [
            'Hibrid dengan gearbox dual-clutch (bukan CVT)',
            'Paling jimat minyak dalam generasi ini',
            'Bateri hibrid berumur — kos ganti boleh mencecah ribuan ringgit',
          ],
          usedPriceBand: 'Harga hampir sama dengan V — jangan bayar premium besar untuk unit tanpa rekod',
          spotChecks: [
            'Emblem "Sport Hybrid" + paparan bateri di meter',
            'MINTA rekod servis Honda penuh — paling penting untuk varian ini',
            'Test drive: gearbox dual-clutch patut lancar, bukan tersentak-sentak',
          ],
        },
      ],
    },
    {
      label: 'Generasi 7 (GN2)',
      years: '2020–kini',
      variants: [
        {
          name: 'S / E',
          matchTokens: ['S', 'E'],
          verdict: 'best-value',
          verdictNote: 'E adalah nilai terbaik generasi ini — beza dengan V kebanyakannya keselesaan, bukan keperluan.',
          differentiators: [
            'Enjin 1.5L DOHC baru — lebih bertenaga dari generasi lama',
            'E tambah kunci pintar + rim lebih besar dari S',
            'Kit asas generasi ini sudah cukup lengkap',
          ],
          usedPriceBand: 'S biasanya RM2–3k bawah E',
          spotChecks: [
            'E: butang push-start; S: kunci biasa',
          ],
        },
        {
          name: 'V',
          matchTokens: ['V'],
          verdict: 'worth-it-if',
          verdictNote: 'Berbaloi jika anda mahu LED penuh dan kit keselamatan tambahan — sahkan ciri sebenar, bukan andaian.',
          differentiators: [
            'Lampu LED penuh + kerusi separa kulit',
            'Kit keselamatan lebih lengkap (sahkan Honda Sensing — bukan semua tahun/varian)',
            'Skrin lebih besar dengan sambungan telefon',
          ],
          usedPriceBand: 'Biasanya RM3–5k atas E',
          spotChecks: [
            'Kerusi separa kulit + lampu LED',
            'Sahkan Honda Sensing: kamera kecil di cermin depan atas',
          ],
        },
        {
          name: 'RS e:HEV (Hybrid)',
          matchTokens: ['RS', 'HYBRID', 'HEV'],
          verdict: 'worth-it-if',
          verdictNote: 'Hibrid i-MMD yang jauh lebih baik dari i-DCD lama — tapi tetap perlukan rekod servis Honda dan pemahaman kos hibrid.',
          differentiators: [
            'Hibrid i-MMD — paling jimat minyak, pemanduan paling senyap',
            'Honda Sensing standard',
            'Bodykit RS + dalaman gelap',
          ],
          usedPriceBand: 'Varian termahal — premium ketara atas V; pastikan bateri masih dalam waranti',
          spotChecks: [
            'Emblem RS + e:HEV di belakang',
            'Semak baki waranti bateri hibrid dengan Honda Malaysia',
            'Rekod servis pusat Honda — bukan bengkel biasa',
          ],
        },
      ],
    },
  ],
  redFlags: [
    'City adalah antara kereta paling terjejas banjir Disember 2021 (Klang Valley) — semak bau lembap, karat bawah kerusi, dan air dalam lampu',
    'Popular untuk e-hailing — semak kehausan kerusi pemandu dan mileage yang munasabah',
    'Unit hibrid tanpa rekod servis Honda penuh — risiko bateri dan gearbox yang mahal; tawar lebih rendah atau cari unit lain',
    'Iklan kata "V" tapi kerusi fabrik dan lampu halogen — kemungkinan varian bawah',
  ],
  faq: [
    {
      q: 'Honda City E ke V — berbaloi ke tambah untuk V?',
      a: 'V tambah kerusi kulit, LED, dan kit keselamatan — keselesaan, bukan keperluan. Berbaloi jika bezanya kurang dari RM4k dan anda mahu kit penuh. Untuk nilai semata-mata, E adalah pilihan yang betul.',
    },
    {
      q: 'City hybrid berbaloi ke untuk dibeli terpakai?',
      a: 'Bergantung pada generasi dan rekod. RS e:HEV (2020+) guna sistem i-MMD yang lebih baik dan berbaloi jika bateri masih dalam waranti. Sport Hybrid lama (i-DCD) lebih berisiko — hanya beli dengan rekod servis Honda yang penuh.',
    },
    {
      q: 'Berapa kos ganti bateri hibrid Honda City?',
      a: 'Anggaran boleh mencecah beberapa ribu ringgit bergantung model dan sumber (baru vs recond). Sebab itu baki waranti bateri dan rekod servis adalah perkara paling penting untuk semak sebelum beli unit hibrid.',
    },
    {
      q: 'Macam mana nak tahu City tu kena banjir?',
      a: 'Bau lembap atau pewangi yang terlalu kuat, karat pada rel kerusi dan bawah karpet, wap air dalam lampu, dan elektronik yang tidak konsisten. Kereta banjir Disember 2021 masih beredar di pasaran — inspection fizikal sangat penting untuk City.',
    },
  ],
}

VARIANT_GUIDES['perodua-bezza'] = BEZZA_GUIDE
VARIANT_GUIDES['honda-city']   = CITY_GUIDE

export const VERDICT_LABELS: Record<VariantVerdict, string> = {
  'best-value':  'nilai terbaik',
  'ok':          'okay',
  'worth-it-if': 'berbaloi jika',
  'avoid':       'elak',
}

function tokenize(text: string): string[] {
  return text.toUpperCase().split(/[^A-Z0-9.]+/).filter(Boolean)
}

function variantTokens(v: VariantInfo): string[] {
  return v.matchTokens ?? tokenize(v.name)
}

/**
 * Locate a car within its model's variant ladder.
 * - Generation picked by registration year. A known year OUTSIDE every
 *   covered generation returns null — showing a wrong-era ladder (2006 Myvi
 *   against the 2018+ range) is worse than showing nothing. Unknown year
 *   falls back to the latest generation (rare; ladder is labeled with its
 *   years so it stays honest).
 * - Matching is whole-token only and curator-controlled via matchTokens —
 *   single letters like H/G/S are substring landmines ("H" is inside "HEV")
 * - Ambiguity (two variants match equally) returns NO match: a wrong
 *   "← Kereta ini" on a paid report is worse than asking the buyer to
 *   match the record themselves.
 */
export function findVariantPosition(
  guide: VariantGuide,
  officialText: string | null | undefined,
  registrationYear: string | null | undefined,
): { generation: VariantGeneration; matchedVariantName: string | null } | null {
  // Generation by registration year
  const regYear = registrationYear ? parseInt(registrationYear, 10) : NaN
  let generation: VariantGeneration | null = guide.generations[guide.generations.length - 1]!
  if (Number.isFinite(regYear)) {
    generation = null
    for (const gen of guide.generations) {
      const nums = gen.years.match(/\d{4}/g)?.map(Number) ?? []
      const start = nums[0]
      const end   = nums[1] ?? new Date().getFullYear()
      if (start != null && regYear >= start && regYear <= end) { generation = gen; break }
    }
  }
  if (!generation) return null

  if (!officialText) return { generation, matchedVariantName: null }
  const textTokens = new Set(tokenize(officialText))

  let best: { name: string; score: number } | null = null
  let tie = false
  for (const v of generation.variants) {
    const tokens  = variantTokens(v)
    const matched = tokens.filter(t => textTokens.has(t))
    // multi-token sets: require all; single-token sets: require the one
    const fullMatch = tokens.length > 1 ? matched.length === tokens.length : matched.length === 1
    const partial   = tokens.length > 1 && matched.length > 0
    const score     = fullMatch ? tokens.length + 1 : partial ? matched.length : 0
    if (score === 0) continue
    if (!best || score > best.score) { best = { name: v.name, score }; tie = false }
    else if (score === best.score) tie = true
  }

  return { generation, matchedVariantName: best && !tie ? best.name : null }
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
