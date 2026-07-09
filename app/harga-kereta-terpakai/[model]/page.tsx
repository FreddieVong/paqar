import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { DualCheckForm } from '@/components/check/DualCheckForm'
import { VARIANT_GUIDES } from '@/lib/variant-guides'

type PriceRow = { year: string; min: number; max: number }

type ModelConfig = {
  brand:       string
  model:       string
  yearKey:     string   // key used in /harga-{yearKey}-{year} pages
  description: string
  priceRows:   PriceRow[]
  buyerTips:   string[]
  faqs:        { q: string; a: string }[]
}

const MODELS: Record<string, ModelConfig> = {
  'perodua-myvi': {
    brand: 'Perodua', model: 'Myvi', yearKey: 'myvi',
    description: 'Perodua Myvi adalah kereta terpakai paling popular di Malaysia. Mudah diselenggara, kos servis rendah, dan ada banyak pilihan di pasaran. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2017', min: 33000, max: 48000 },
      { year: '2018', min: 37000, max: 52000 },
      { year: '2019', min: 42000, max: 56000 },
      { year: '2020', min: 46000, max: 60000 },
      { year: '2021', min: 50000, max: 65000 },
      { year: '2022', min: 54000, max: 70000 },
      { year: '2023', min: 58000, max: 74000 },
    ],
    buyerTips: [
      'Semak nombor enjin dan casis pada geran — nombor mesti sama persis',
      'Myvi generasi 3 (2018 ke atas) ada VSC dan ASA — pastikan sistem ini berfungsi',
      'Tanya rekod servis di Perodua Service Centre — boleh semak dengan nombor plat',
      'Cat bumbung dan tiang A/B perlu sekata — kereta banjir sering ada kelunturan di sini',
    ],
    faqs: [
      { q: 'Berapa harga Myvi terpakai 2020?', a: 'Harga Myvi 2020 terpakai biasanya antara RM46,000 hingga RM60,000 bergantung kepada varian (E, X, AV, H) dan jarak tempuh. Semak harga semasa di Paqar untuk keputusan harga yang tepat.' },
      { q: 'Varian Myvi mana yang paling berbaloi dibeli terpakai?', a: 'Varian H (1.5L) dan AV menawarkan nilai terbaik kerana ada VSC, ASA, dan pelek aloi. Varian X 1.3L lebih murah tapi ketiadaan VSC bermakna kurang selamat.' },
      { q: 'Apa yang perlu disemak sebelum beli Myvi terpakai?', a: 'Semak saman dengan PDRM dan JPJ, semak geran asal, rekod servis di Perodua, kondisi airbag, dan test drive untuk dengar bunyi gear atau enjin.' },
      { q: 'Boleh tawar berapa untuk Myvi terpakai?', a: 'Bergantung kepada keputusan harga semasa. Jika Paqar tunjukkan harga MAHAL, anda ada asas untuk tawar turun menggunakan harga tengah pasaran sebagai rujukan.' },
    ],
  },
  'perodua-axia': {
    brand: 'Perodua', model: 'Axia', yearKey: 'axia',
    description: 'Perodua Axia adalah pilihan kereta terpakai paling berpatutan di Malaysia. Kos petrol dan insurans rendah, sesuai untuk pemandu baru atau guna dalam bandar.',
    priceRows: [
      { year: '2016', min: 20000, max: 28000 },
      { year: '2017', min: 21000, max: 30000 },
      { year: '2018', min: 23000, max: 33000 },
      { year: '2019', min: 26000, max: 36000 },
      { year: '2020', min: 28000, max: 39000 },
      { year: '2022', min: 31000, max: 43000 },
      { year: '2023', min: 35000, max: 48000 },
    ],
    buyerTips: [
      'Axia 2023 (generasi 2) berbeza sangat dari versi lama — harga lebih tinggi tapi lebih besar dan lebih selamat',
      'Semak sama ada pemilik lama guna untuk Grab/e-hailing — jarak tempuh biasanya lebih tinggi',
      'Aircond Axia sering kena servis kerana kapasiti enjin kecil — tanya berapa kali sudah isi gas',
      'Pilih varian SE atau AV untuk dapat airbag — Standard tiada airbag penumpang hadapan',
    ],
    faqs: [
      { q: 'Berapa harga Axia terpakai 2020?', a: 'Axia 2020 terpakai biasanya antara RM28,000 hingga RM39,000. Harga bergantung kepada varian, jarak tempuh, dan sama ada pernah digunakan untuk e-hailing.' },
      { q: 'Axia generasi 1 atau generasi 2 lebih berbaloi?', a: 'Generasi 2 (2023) lebih besar, lebih selamat dan ada lebih banyak ciri keselamatan. Tapi harganya lebih tinggi. Generasi 1 lebih murah tapi ruang dalaman terhad.' },
      { q: 'Axia yang pernah jadi Grab boleh beli ke?', a: 'Boleh, tapi semak jarak tempuh dengan teliti. Kereta Grab biasanya ada jarak tempuh 80,000km ke atas dalam 3-4 tahun. Pastikan harga mencerminkan penggunaan tersebut.' },
    ],
  },
  'perodua-bezza': {
    brand: 'Perodua', model: 'Bezza', yearKey: 'bezza',
    description: 'Perodua Bezza ialah sedan ekonomi paling popular di Malaysia. Boot besar, enjin 1.0L dan 1.3L, kos servis rendah. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2016', min: 26000, max: 38000 },
      { year: '2017', min: 28000, max: 40000 },
      { year: '2018', min: 30000, max: 42000 },
      { year: '2019', min: 33000, max: 46000 },
      { year: '2020', min: 36000, max: 50000 },
      { year: '2021', min: 38000, max: 52000 },
      { year: '2022', min: 40000, max: 55000 },
    ],
    buyerTips: [
      'Bezza 1.3L AV dan X lebih berbaloi kerana ada VSC dan kamera belakang',
      'Semak lampu belakang — Bezza lama ada isu kelembapan air masuk reflektor',
      'Rekod servis Perodua boleh disemak terus di service centre dengan nombor plat',
      'Pastikan tiada bunyi ketukan dari enjin 1.0L — isu penggunaan petrol RON 95 yang tidak konsisten',
    ],
    faqs: [
      { q: 'Berapa harga Bezza terpakai 2019?', a: 'Bezza 2019 terpakai biasanya antara RM33,000 hingga RM46,000 bergantung kepada varian dan jarak tempuh.' },
      { q: 'Enjin 1.0L atau 1.3L lebih bagus untuk Bezza?', a: '1.3L lebih berbaloi kerana tenaga lebih, gearbox CVT lebih baik, dan varian tinggi ada VSC. 1.0L cukup untuk bandar sahaja.' },
      { q: 'Apa yang perlu disemak sebelum beli Bezza terpakai?', a: 'Semak saman, geran asal, rekod servis Perodua, kondisi lampu belakang, dan test drive untuk pastikan CVT berfungsi lancar tanpa bunyi slip.' },
    ],
  },
  'proton-saga': {
    brand: 'Proton', model: 'Saga', yearKey: 'saga',
    description: 'Proton Saga adalah sedan nasional paling laris di Malaysia. Sejak dilancarkan semula pada 2016, ia menawarkan nilai terbaik dalam segmen sedan ekonomi. Semak harga sebelum beli.',
    priceRows: [
      { year: '2016', min: 20000, max: 30000 },
      { year: '2017', min: 22000, max: 32000 },
      { year: '2018', min: 24000, max: 35000 },
      { year: '2019', min: 27000, max: 38000 },
      { year: '2020', min: 30000, max: 42000 },
      { year: '2021', min: 32000, max: 45000 },
      { year: '2022', min: 34000, max: 48000 },
    ],
    buyerTips: [
      'Saga 2019 ke atas ada VSC — pilih varian ini untuk keselamatan tambahan',
      'Semak sama ada transmisi CVT atau AT — Saga lama ada isu CVT jika tidak diselenggara dengan betul',
      'Cat tiang B dan bawah pintu sering menunjukkan tanda karat pada Saga lama',
      'Minta penjual tunjukkan rekod servis di Proton Service Centre atau bengkel biasa',
    ],
    faqs: [
      { q: 'Berapa harga Proton Saga terpakai 2020?', a: 'Saga 2020 biasanya antara RM30,000 hingga RM42,000 bergantung kepada varian (Standard, Executive, Premium) dan jarak tempuh.' },
      { q: 'Saga CVT ada masalah ke?', a: 'Saga CVT yang tidak diselenggara dengan betul (tukar minyak setiap 40,000km) boleh ada isu slip. Tanya rekod penggantian minyak CVT sebelum beli.' },
      { q: 'Varian Saga mana yang paling berbaloi?', a: 'Varian Premium 1.3L paling berbaloi — ada VSC, 2 airbag, kamera belakang, dan pelek aloi. Jika bajet terhad, Executive cukup baik dengan airbag dan ABS.' },
    ],
  },
  'toyota-vios': {
    brand: 'Toyota', model: 'Vios', yearKey: 'vios',
    description: 'Toyota Vios ialah sedan Jepun paling popular di Malaysia. Dikenali sebagai kereta tahan lama dengan kos penyelenggaraan rendah dan nilai tukar ganti yang stabil.',
    priceRows: [
      { year: '2014', min: 36000, max: 50000 },
      { year: '2016', min: 40000, max: 56000 },
      { year: '2018', min: 48000, max: 64000 },
      { year: '2019', min: 52000, max: 68000 },
      { year: '2020', min: 55000, max: 72000 },
      { year: '2021', min: 58000, max: 76000 },
      { year: '2022', min: 62000, max: 80000 },
    ],
    buyerTips: [
      'Vios 2019 ke atas (facelift) ada 7 airbag dan VSC sebagai standard — pilih ini jika mampu',
      'Semak rekod servis di Toyota Service Centre — ia sangat mempengaruhi harga jualan semula',
      'Vios yang pernah digunakan untuk e-hailing atau teksi biasanya ada jarak tempuh sangat tinggi',
      'Warna putih dan silver lebih mudah jual semula di Malaysia',
    ],
    faqs: [
      { q: 'Berapa harga Toyota Vios terpakai 2019?', a: 'Vios 2019 biasanya antara RM52,000 hingga RM68,000 bergantung kepada varian (G, J, E) dan jarak tempuh. Varian G dengan rekod servis penuh boleh mencapai harga atas.' },
      { q: 'Vios atau City — mana lebih berbaloi dibeli terpakai?', a: 'Vios lebih tahan lama dan lebih murah diselenggara. City ada ruang lebih luas dan lebih sporty. Semak harga kedua-dua di Paqar sebelum buat keputusan.' },
      { q: 'Berapa varian Vios yang ada di Malaysia?', a: 'Vios ada varian E, J, dan G. Varian G paling tinggi dengan 7 airbag, VSC, dan reka bentuk pelek lebih premium. Varian E paling asas tapi masih ada ABS dan airbag depan.' },
    ],
  },
  'honda-city': {
    brand: 'Honda', model: 'City', yearKey: 'city',
    description: 'Honda City adalah sedan Jepun popular di Malaysia dengan ruang dalaman luas dan prestasi enjin yang baik. Nilai tukar ganti yang stabil menjadikannya pilihan pelaburan yang bijak.',
    priceRows: [
      { year: '2014', min: 38000, max: 54000 },
      { year: '2016', min: 44000, max: 60000 },
      { year: '2018', min: 52000, max: 68000 },
      { year: '2019', min: 56000, max: 74000 },
      { year: '2020', min: 60000, max: 80000 },
      { year: '2021', min: 65000, max: 86000 },
      { year: '2022', min: 70000, max: 92000 },
    ],
    buyerTips: [
      'City 2020 (generasi 7) sangat berbeza dari generasi sebelum — lebih besar, lebih selamat, Honda Sensing standard',
      'Semak rekod servis di Honda Service Centre — penyelenggaraan teratur penting untuk enjin VTEC',
      'Airbag curtain dan Honda Sensing hanya pada City 2020 ke atas — periksa varian sebelum beli',
      'Bunyi ketukan dari enjin pada idle boleh menandakan isu VTC actuator — biasa pada City 2009-2013',
    ],
    faqs: [
      { q: 'Berapa harga Honda City terpakai 2020?', a: 'City 2020 (generasi 7) biasanya antara RM60,000 hingga RM80,000 bergantung kepada varian dan jarak tempuh. City generasi ini paling berbaloi kerana ada Honda Sensing.' },
      { q: 'City generasi berapa yang paling berbaloi dibeli terpakai?', a: 'Generasi 7 (2020-2023) paling berbaloi — ada Honda Sensing, lebih selamat, dan enjin lebih efisien. Tapi harga lebih tinggi. Generasi 6 (2014-2019) lebih murah tapi kurang ciri keselamatan.' },
      { q: 'Honda City ada isu biasa apa?', a: 'City 2009-2013 ada isu VTC actuator yang menyebabkan bunyi ketukan. City 2014-2019 umumnya lebih boleh dipercayai. City 2020 ke atas adalah yang paling moden dan selamat.' },
    ],
  },
  'perodua-alza': {
    brand: 'Perodua', model: 'Alza', yearKey: 'alza',
    description: 'Perodua Alza adalah MPV 7-tempat duduk paling laris di Malaysia. Alza generasi baru (2022) adalah peningkatan besar dari generasi lama. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2015', min: 30000, max: 44000 },
      { year: '2017', min: 33000, max: 47000 },
      { year: '2019', min: 36000, max: 52000 },
      { year: '2021', min: 40000, max: 56000 },
      { year: '2022', min: 56000, max: 76000 },
      { year: '2023', min: 60000, max: 80000 },
    ],
    buyerTips: [
      'Alza 2022 ke atas berbeza sangat dari generasi lama — lebih besar, ada ADAS, harga berbeza',
      'Alza lama (sebelum 2022) ada isu pintu gelongsor yang keras — semak semua pintu buka tutup lancar',
      'Baris ketiga Alza lama sangat sempit — pastikan sesuai untuk kegunaan anda',
      'Semak rekod servis kerana Alza yang kerap bawa penumpang ramai ada penggunaan lebih tinggi',
    ],
    faqs: [
      { q: 'Alza lama atau Alza baru yang lebih berbaloi dibeli terpakai?', a: 'Alza 2022 (baru) adalah kereta yang sama sekali berbeza — lebih besar, ada ADAS, lebih selamat. Jika bajet mencukupi, Alza baru lebih berbaloi. Alza lama lebih murah tapi kurang ciri.' },
      { q: 'Berapa harga Alza 2022 terpakai?', a: 'Alza 2022 terpakai biasanya antara RM56,000 hingga RM76,000 bergantung kepada varian (Active atau Advance) dan jarak tempuh.' },
      { q: 'Berapa kapasiti tempat duduk Alza?', a: 'Alza ada 7 tempat duduk dalam konfigurasi 2-2-3. Baris ketiga Alza lama lebih sempit dan sesuai untuk kanak-kanak. Alza 2022 mempunyai baris ketiga yang lebih luas.' },
    ],
  },
  'proton-x50': {
    brand: 'Proton', model: 'X50', yearKey: 'x50',
    description: 'Proton X50 adalah SUV kompak paling laris di Malaysia sejak dilancarkan pada 2020. Dengan teknologi terkini dari Geely, ia menawarkan nilai yang kompetitif dalam segmen B-SUV.',
    priceRows: [
      { year: '2020', min: 58000, max: 78000 },
      { year: '2021', min: 60000, max: 82000 },
      { year: '2022', min: 63000, max: 86000 },
      { year: '2023', min: 67000, max: 92000 },
    ],
    buyerTips: [
      'X50 ada 4 varian: Standard, Executive, Premium, dan Flagship — ciri keselamatan berbeza mengikut varian',
      'Semak rekod servis di Proton Edar — X50 baru ada waranti 5 tahun yang boleh dipindah',
      'Waranti asal 5 tahun / 150,000km boleh dipindah kepada pembeli baru — semak status waranti',
      'Semak rekod insurans kerana X50 popular dan sering terlibat tuntutan kemalangan kecil',
    ],
    faqs: [
      { q: 'Berapa harga Proton X50 terpakai 2021?', a: 'X50 2021 biasanya antara RM60,000 hingga RM82,000 bergantung kepada varian. Flagship dengan sunroof dan ADAS penuh ada harga lebih tinggi.' },
      { q: 'Waranti X50 terpakai masih sah ke?', a: 'Waranti asal Proton X50 adalah 5 tahun / 150,000km dan boleh dipindah kepada pembeli baru. Semak status waranti dengan nombor VIN di Proton Edar sebelum beli.' },
      { q: 'X50 atau Myvi — mana lebih berbaloi?', a: 'Bergantung pada keperluan. X50 adalah SUV dengan ruang lebih, teknologi lebih canggih tapi harga dua kali ganda Myvi. Untuk bandar sahaja, Myvi lebih jimat. Untuk keluarga atau perjalanan jauh, X50 lebih sesuai.' },
    ],
  },
  'perodua-ativa': {
    brand: 'Perodua', model: 'Ativa', yearKey: 'ativa',
    description: 'Perodua Ativa adalah SUV crossover kompak pertama Perodua, dilancarkan 2021. Enjin 1.0L turbo, platform DNGA, dan ASA standard menjadikannya pilihan popular dalam segmen crossover nasional.',
    priceRows: [
      { year: '2021', min: 53000, max: 68000 },
      { year: '2022', min: 58000, max: 73000 },
      { year: '2023', min: 63000, max: 78000 },
    ],
    buyerTips: [
      'Ativa guna platform DNGA yang sama dengan Myvi baru — kualiti binaan lebih tinggi dari Axia atau Bezza lama',
      'Enjin 1.0L turbo perlukan minyak enjin 0W-20 dan selang servis 10,000km yang ketat — semak rekod',
      'Pilih varian AV atau X untuk dapat ASA dan kamera 360° — ciri penting untuk SUV kompak',
      'Gunakan RON 95 minimum — enjin turbo sensitif kepada kualiti petrol yang rendah',
    ],
    faqs: [
      { q: 'Berapa harga Perodua Ativa terpakai 2022?', a: 'Ativa 2022 terpakai biasanya antara RM58,000 hingga RM73,000 bergantung kepada varian (X, H, atau AV) dan jarak tempuh.' },
      { q: 'Ativa lebih bagus dari Myvi?', a: 'Ativa adalah SUV crossover yang lebih tinggi dari tanah, enjin turbo lebih bertenaga, dan ada kamera 360°. Tapi harganya RM10k–RM15k lebih mahal dari Myvi tahun yang sama. Pilih Ativa jika anda mahukan ketinggian dan kuasa lebih.' },
      { q: 'Ativa ada masalah biasa apa?', a: 'Enjin 1.0L turbo memerlukan minyak enjin berkualiti dan servis mengikut jadual. Ativa yang tidak servis dengan betul boleh mengalami isu turbo lebih awal. Semak rekod servis dengan teliti.' },
    ],
  },
  'honda-jazz': {
    brand: 'Honda', model: 'Jazz', yearKey: 'jazz',
    description: 'Honda Jazz generasi 3 (2014–2020) terkenal dengan Magic Seats yang fleksibel dan ruang dalaman yang sangat luas berbanding saiznya. Enjin VTEC 1.5L yang tahan lama menjadikannya pilihan popular.',
    priceRows: [
      { year: '2015', min: 38000, max: 52000 },
      { year: '2016', min: 40000, max: 55000 },
      { year: '2017', min: 43000, max: 58000 },
      { year: '2018', min: 46000, max: 62000 },
      { year: '2019', min: 50000, max: 66000 },
      { year: '2020', min: 54000, max: 70000 },
    ],
    buyerTips: [
      'Semak Magic Seats — pastikan mekanisme lipatan baris kedua masih berfungsi lancar ke semua posisi',
      'Enjin VTEC 1.5L sangat tahan lama tapi perlukan minyak enjin 0W-20 yang betul — tanya rekod servis',
      'Jazz yang ada kemalangan sering tunjukkan cat tidak sekata di ruang enjin atau panel bawah pintu',
      'Semak rekod servis Honda — CVT Jazz perlu penggantian minyak setiap 40,000km untuk kekal sihat',
    ],
    faqs: [
      { q: 'Berapa harga Honda Jazz terpakai 2018?', a: 'Jazz 2018 terpakai biasanya antara RM46,000 hingga RM62,000 bergantung kepada varian (E, V, atau RS) dan jarak tempuh.' },
      { q: 'Magic Seats Jazz untuk apa?', a: 'Magic Seats membolehkan kerusi baris kedua dilipat ke hadapan (Utility Mode) atau kerusi dilipat naik untuk bawa barang tinggi (Tall Mode). Sangat berguna untuk pindah barang atau basikal.' },
      { q: 'Jazz atau Myvi — mana lebih berbaloi?', a: 'Jazz lebih mahal tapi ruang dalaman jauh lebih luas, enjin 1.5L lebih bertenaga, dan nilai jual semula stabil. Jika bajet mencukupi dan anda kerap bawa barang atau penumpang, Jazz memberikan nilai lebih.' },
    ],
  },
  'proton-x70': {
    brand: 'Proton', model: 'X70', yearKey: 'x70',
    description: 'Proton X70 adalah SUV C-segment yang dilancarkan pada 2018 — lebih besar dari X50. Berdasarkan Geely Boyue dengan enjin 1.8L turbo, ia menawarkan ruang dalaman luas dan ciri keselamatan aktif.',
    priceRows: [
      { year: '2018', min: 65000, max: 85000 },
      { year: '2019', min: 68000, max: 90000 },
      { year: '2020', min: 72000, max: 94000 },
      { year: '2021', min: 76000, max: 98000 },
      { year: '2022', min: 80000, max: 104000 },
    ],
    buyerTips: [
      'X70 ada 3 varian: Standard, Executive, dan Premium — ADAS hanya pada varian Premium',
      'Waranti asal 5 tahun / 150,000km boleh dipindah kepada pembeli baru — semak status di Proton Edar',
      'Semak infotainment system — model 2018-2019 ada isu software lag yang sudah diperbaiki melalui update',
      'Komponen X70 berasaskan Geely — dapatkan bahagian dari Proton Edar bertauliah untuk mengelak masalah',
    ],
    faqs: [
      { q: 'Berapa harga Proton X70 terpakai 2020?', a: 'X70 2020 terpakai biasanya antara RM72,000 hingga RM94,000 bergantung kepada varian dan jarak tempuh. Varian Premium dengan ADAS ada harga lebih tinggi.' },
      { q: 'X70 atau X50 — mana lebih baik?', a: 'X70 lebih besar (C-segment) dengan enjin 1.8L turbo yang lebih bertenaga dan ruang dalaman lebih luas. X50 lebih kecil tapi teknologi lebih baru dan harga lebih rendah. Pilih X70 jika anda perlukan SUV yang lebih besar.' },
      { q: 'Alat ganti X70 mudah dapat?', a: 'X70 menggunakan komponen Geely Boyue. Bahagian boleh didapatkan dari Proton Edar atau pengedar Geely bertauliah. Elak beli bahagian dari sumber tidak rasmi untuk kerja waranti.' },
    ],
  },
  'proton-iriz': {
    brand: 'Proton', model: 'Iriz', yearKey: 'iriz',
    description: 'Proton Iriz adalah hatchback kompak yang dilancarkan pada 2014. Dengan enjin 1.3L dan 1.6L, ia bersaing langsung dengan Perodua Myvi dalam segmen hatchback nasional dengan harga yang lebih rendah.',
    priceRows: [
      { year: '2015', min: 24000, max: 36000 },
      { year: '2016', min: 26000, max: 38000 },
      { year: '2017', min: 27000, max: 40000 },
      { year: '2018', min: 29000, max: 42000 },
      { year: '2019', min: 31000, max: 45000 },
      { year: '2020', min: 33000, max: 48000 },
      { year: '2021', min: 36000, max: 52000 },
    ],
    buyerTips: [
      'Transmisi CVT Iriz sangat sensitif — semak rekod penggantian minyak CVT setiap 40,000km',
      'Pilih enjin 1.6L untuk prestasi lebih baik di lebuh raya — 1.3L cukup untuk bandar sahaja',
      'Cat Iriz cenderung kena chips lebih awal — semak bumper depan dan bahagian bawah pintu dengan teliti',
      'Iriz R3 (sport edition) ada harga lebih tinggi tapi suspensi lebih keras — tidak sesuai untuk kegunaan harian biasa',
    ],
    faqs: [
      { q: 'Berapa harga Proton Iriz terpakai 2019?', a: 'Iriz 2019 terpakai biasanya antara RM31,000 hingga RM45,000 bergantung kepada varian (1.3L Standard, 1.6L Executive, atau 1.6L Premium) dan jarak tempuh.' },
      { q: 'Iriz 1.3L atau 1.6L lebih berbaloi?', a: '1.6L lebih berbaloi — lebih bertenaga di lebuh raya, gearbox lebih baik, dan varian tinggi ada ciri keselamatan tambahan. 1.3L cukup untuk guna dalam bandar sahaja.' },
      { q: 'Iriz vs Myvi — mana lebih berbaloi dibeli terpakai?', a: 'Iriz lebih murah RM5k–RM10k dari Myvi tahun yang sama. Tapi Myvi mempunyai nilai jual semula lebih tinggi dan lebih mudah dijual semula. Pilih Iriz jika bajet terhad, Myvi jika anda nak pegang kereta lebih lama.' },
    ],
  },
  'honda-hrv': {
    brand: 'Honda', model: 'HR-V', yearKey: 'hr-v',
    description: 'Honda HR-V generasi 1 (2015–2021) adalah crossover SUV popular yang menawarkan ketinggian SUV dengan kecekapan kereta biasa. Enjin 1.8L tahan lama dan ruang dalaman luas menjadikannya pilihan keluarga.',
    priceRows: [
      { year: '2015', min: 56000, max: 72000 },
      { year: '2016', min: 60000, max: 76000 },
      { year: '2017', min: 63000, max: 80000 },
      { year: '2018', min: 67000, max: 84000 },
      { year: '2019', min: 71000, max: 88000 },
      { year: '2020', min: 75000, max: 92000 },
    ],
    buyerTips: [
      'HR-V facelift 2018 ke atas ada Honda Sensing pada varian V — semak spesifikasi sebelum beli',
      'Isu biasa: bunyi dari cermin sisi pada kelajuan lebuh raya — semak gasket dan kondisi cermin',
      'Semak rekod servis Honda — enjin 1.8L SOHC i-VTEC sangat tahan lama dengan penyelenggaraan yang betul',
      'Semak cat ruang enjin dan tiang A untuk kesan banjir atau kemalangan tersembunyi',
    ],
    faqs: [
      { q: 'Berapa harga Honda HR-V terpakai 2018?', a: 'HR-V 2018 terpakai biasanya antara RM67,000 hingga RM84,000 bergantung kepada varian (E atau V) dan jarak tempuh. Varian V facelift dengan Honda Sensing ada harga lebih tinggi.' },
      { q: 'HR-V facelift 2018 ada Honda Sensing ke?', a: 'Hanya varian V facelift 2018 ke atas ada Honda Sensing. Semak spesifikasi varian dengan nombor VIN atau tanya penjual secara langsung sebelum beli.' },
      { q: 'HR-V atau X50 — mana lebih berbaloi?', a: 'X50 lebih baru, ada teknologi lebih canggih dan lebih murah untuk tahun hampir sama. HR-V pula lebih tahan lama, kos penyelenggaraan lebih rendah jangka panjang, dan nilai jual semula Honda lebih stabil.' },
    ],
  },
  'nissan-almera': {
    brand: 'Nissan', model: 'Almera', yearKey: 'almera',
    description: 'Nissan Almera generasi 3 (2019 ke atas) hadir dengan enjin 1.0L turbo yang sangat jimat petrol. Sedan kompak ini popular untuk kegunaan harian dan e-hailing kerana kos operasi yang rendah.',
    priceRows: [
      { year: '2019', min: 46000, max: 60000 },
      { year: '2020', min: 50000, max: 64000 },
      { year: '2021', min: 54000, max: 68000 },
      { year: '2022', min: 58000, max: 72000 },
    ],
    buyerTips: [
      'Almera sangat popular untuk e-hailing — semak jarak tempuh dan tanda penggunaan intensif',
      'Enjin 1.0L turbo jimat tapi perlukan minyak enjin betul dan servis mengikut jadual 10,000km',
      'Semak suspension — Almera kerap digunakan sebagai kereta sewa dan mungkin ada kerosakan pada suspension bawah',
      'Waranti asal 3 tahun boleh dipindah kepada pembeli baru — semak status waranti di Nissan Malaysia',
    ],
    faqs: [
      { q: 'Berapa harga Nissan Almera terpakai 2021?', a: 'Almera 2021 terpakai biasanya antara RM54,000 hingga RM68,000 bergantung kepada varian (E, V, atau VLT) dan jarak tempuh.' },
      { q: 'Almera turbo jimat petrol ke?', a: 'Ya, enjin 1.0L turbo Almera sangat jimat — boleh capai 18–20km/L dalam bandar. Ini menjadikannya salah satu sedan paling jimat petrol dalam kelasnya.' },
      { q: 'Almera vs Vios — mana lebih berbaloi?', a: 'Vios mempunyai nilai jual semula lebih tinggi dan reputasi lebih tahan lama. Almera lebih jimat petrol dan harga beli lebih rendah. Untuk jangka panjang, Vios lebih stabil nilainya. Untuk kos rendah jangka pendek, Almera menarik.' },
    ],
  },
}

type Props = { params: { model: string } }

export function generateStaticParams() {
  return Object.keys(MODELS).map(model => ({ model }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cfg = MODELS[params.model]
  if (!cfg) return {}
  const year        = new Date().getFullYear()
  const title       = `Harga ${cfg.brand} ${cfg.model} Terpakai Malaysia ${year} | Paqar`
  const description = `Semak harga pasaran ${cfg.brand} ${cfg.model} terpakai Malaysia — anggaran harga mengikut tahun, tip pembeli, dan keputusan harga percuma.`
  return {
    title,
    description,
    alternates: { canonical: `https://paqar.my/harga-kereta-terpakai/${params.model}` },
    openGraph: {
      title,
      description,
      url: `https://paqar.my/harga-kereta-terpakai/${params.model}`,
      images: [{
        url:    `/api/og?title=Harga%20${encodeURIComponent(cfg.brand + ' ' + cfg.model)}%20Terpakai&subtitle=Semak%20harga%20pasaran%20sebelum%20beli`,
        width:  1200,
        height: 630,
      }],
    },
  }
}

export default function ModelPage({ params }: Props) {
  const cfg = MODELS[params.model]
  if (!cfg) notFound()

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Harga Kereta Terpakai', item: 'https://paqar.my/harga-kereta-terpakai' },
          { '@type': 'ListItem', position: 3, name: `${cfg.brand} ${cfg.model}`, item: `https://paqar.my/harga-kereta-terpakai/${params.model}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: cfg.faqs.map(faq => ({
          '@type': 'Question',
          name:    faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              {cfg.brand}
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga {cfg.brand} {cfg.model} Terpakai Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              {cfg.description}
            </p>
          </div>

          {/* Price table */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
              <h2 className="font-heading font-bold text-[14px] text-[#111827]">
                Anggaran harga pasaran {cfg.model} terpakai
              </h2>
              <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">
                Berdasarkan data pasaran semasa. Harga sebenar bergantung kepada varian, jarak tempuh, dan kondisi.
              </p>
            </div>
            {cfg.priceRows.map((row, i) => (
              <Link
                key={row.year}
                href={`/harga-${cfg.yearKey}-${row.year}`}
                className={`flex items-center justify-between px-5 py-3 hover:bg-[#F9FAFB] ${i < cfg.priceRows.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}
              >
                <span className="font-heading font-bold text-[14px] text-[#064E4A]">{row.year}</span>
                <span className="font-body text-[13px] text-[#374151]">
                  RM{row.min.toLocaleString()} – RM{row.max.toLocaleString()} →
                </span>
              </Link>
            ))}
          </div>

          {/* Check CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Semak harga {cfg.model} yang nak anda beli:
            </p>
            <DualCheckForm />
          </div>

          {/* Buyer tips */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">
              Tip sebelum beli {cfg.model} terpakai
            </h2>
            <ul className="space-y-3">
              {cfg.buyerTips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 font-body text-[13px] text-[#374151] leading-relaxed">
                  <span className="text-[#064E4A] font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-1">Soalan lazim</h2>
            {cfg.faqs.map((faq) => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{faq.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            {VARIANT_GUIDES[params.model] && (
              <Link href={`/varian/${params.model}`} className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">
                {cfg.model} varian mana patut beli? →
              </Link>
            )}
            <Link href="/cara-beli-kereta-terpakai"      className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
            <Link href="/risiko-beli-kereta-terpakai"    className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
            <Link href="/harga-kereta-terpakai"          className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semua model kereta terpakai →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
