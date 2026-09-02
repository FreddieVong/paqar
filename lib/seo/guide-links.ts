/**
 * Where each /faq/* guide sends a reader next.
 *
 * ── WHY THE GUIDES NEEDED THIS ─────────────────────────────────────────────
 *
 * app/sitemap.ts carries the note "FAQ hub — the only internal path into the
 * /faq/* guides", and it was accurate: five of the eight had no outbound
 * internal link at all beyond the shared CTA, and none had an inbound one from
 * another guide. A crawler reached them from /faq or from the sitemap and left
 * the same way. Eight pages that answer adjacent questions for the same buyer,
 * with nothing joining them.
 *
 * It was also the right order to do it in. Linking them while they still
 * contained an invented JPJ fee table and a Honda variant Honda never sold
 * would have spread the errors rather than the traffic — every link is a
 * recommendation, and these are only worth making now that the destinations
 * survive being read.
 *
 * ── THE RULE FOR ADDING ONE ────────────────────────────────────────────────
 *
 * `why` is shown to the reader, not stored for us. If you cannot write a
 * specific reason a person reading THIS page would want THAT one, the link
 * does not belong here — a related-links block that lists everything is
 * navigation furniture, and readers learn to skip it. Each pairing below
 * exists because the source page raises a question the destination answers.
 *
 * Destinations are checked by __tests__/lib/no-dead-links.test.ts against the
 * routes that actually exist, so a renamed page cannot leave a dead
 * recommendation behind.
 */

export interface GuideLink {
  href:  string
  title: string
  /** The reason, in the reader's terms. Rendered under the title. */
  why:   string
}

export const GUIDE_LINKS: Readonly<Record<string, readonly GuideLink[]>> = {
  'roadtax-by-state': [
    { href: '/cara-semak-roadtax-kereta', title: 'Cara semak status roadtax kereta',
      why:  'Jadual di atas beritahu berapa kadarnya. Ini cara semak sama ada roadtax kereta tertentu itu masih sah.' },
    { href: '/cara-semak-insurans-kereta', title: 'Cara semak insurans kereta',
      why:  'Insurans adalah bahagian yang betul-betul berubah ikut lokasi dan pemandu — bukan roadtax.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Roadtax dan insurans jadi tanggungjawab anda selepas pindah milik. Ini senarai penuh yang patut disemak dahulu.' },
  ],

  'what-to-check-buying-used-car': [
    { href: '/faq/how-to-spot-flood-cars', title: 'Cara kesan kereta banjir',
      why:  'Bau hapak dan minyak enjin berbuih ada dalam senarai tanda bahaya di atas. Ini cara baca kedua-duanya dengan betul.' },
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga',
      why:  'Setiap masalah konkrit yang anda jumpa semasa pemeriksaan adalah asas untuk tawar lebih rendah.' },
    { href: '/faq/roadtax-by-state', title: 'Berapa roadtax kereta ini',
      why:  'Kos memiliki kereta itu bermula sebaik anda beli. Roadtax boleh dikira dari kapasiti enjin dalam beberapa saat.' },
  ],

  'how-to-negotiate-used-car': [
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Langkah 2 rangka di atas ialah cari isu konkrit. Ini senarai penuh apa yang patut dicari, dan di mana.' },
    { href: '/faq/how-to-spot-flood-cars', title: 'Cara kesan kereta banjir',
      why:  'Harga yang jauh lebih murah daripada pasaran selalunya ada sebab. Ini salah satu sebab yang paling mahal.' },
    { href: '/harga-kereta-terpakai', title: 'Harga pasaran ikut model',
      why:  'Asas rundingan anda adalah harga iklan setanding. Mula di sini kalau anda belum tahu julatnya.' },
  ],

  'how-to-spot-flood-cars': [
    { href: '/semak-accident-claim-insurans-kereta', title: 'Semakan rekod claim insurans',
      why:  'Banjir yang dituntut kepada insurans meninggalkan rekod. Halaman ini terangkan apa yang semakan itu boleh dan tidak boleh tunjuk.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Pemeriksaan penuh, bukan hanya tanda banjir — enjin, elektrik, test drive dan bawah kereta.' },
  ],

  'best-first-car-under-30k': [
    { href: '/faq/honda-city-buying-guide', title: 'Panduan beli Honda City terpakai',
      why:  'Kalau anda condong kepada sedan: tahun mana, varian S/E/V yang mana, dan apa perlu disemak.' },
    { href: '/faq/toyota-vios-buying-guide', title: 'Panduan beli Toyota Vios terpakai',
      why:  'Pilihan ketiga dalam senarai di atas, dengan julat harga ikut tahun dan jarak tempuh.' },
    { href: '/faq/roadtax-by-state', title: 'Berapa roadtax kereta ini',
      why:  'Kereta bawah RM30k kebanyakannya 1.0 hingga 1.5 liter — bezanya RM70 setahun, dan ia sama di seluruh Semenanjung.' },
  ],

  'honda-city-buying-guide': [
    { href: '/faq/honda-city-vs-toyota-vios', title: 'Honda City vs Toyota Vios',
      why:  'Dua sedan yang sama saiz dan sama harga. Ini di mana setiap satu menang.' },
    { href: '/varian/honda-city', title: 'Panduan varian Honda City',
      why:  'Cara cam varian sebenar sebuah unit, bukan varian yang ditulis dalam iklan.' },
    { href: '/harga-kereta-terpakai/honda-city', title: 'Harga pasaran Honda City',
      why:  'Julat harga iklan setanding untuk City, ikut tahun.' },
  ],

  'toyota-vios-buying-guide': [
    { href: '/faq/honda-city-vs-toyota-vios', title: 'Honda City vs Toyota Vios',
      why:  'Perbandingan terus antara dua sedan yang paling kerap dipertimbang bersama.' },
    { href: '/harga-kereta-terpakai/toyota-vios', title: 'Harga pasaran Toyota Vios',
      why:  'Julat harga iklan setanding untuk Vios, ikut tahun.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Tanda bahaya di atas khusus untuk Vios. Ini pemeriksaan yang sama untuk mana-mana kereta.' },
  ],

  'honda-city-vs-toyota-vios': [
    { href: '/faq/honda-city-buying-guide', title: 'Panduan beli Honda City terpakai',
      why:  'Kalau anda pilih City: tahun mana, varian S/E/V yang mana, dan apa perlu disemak.' },
    { href: '/faq/toyota-vios-buying-guide', title: 'Panduan beli Toyota Vios terpakai',
      why:  'Kalau anda pilih Vios: tahun mana paling berbaloi, dan tanda bahaya khusus Vios.' },
    { href: '/bandingkan/vios-vs-city', title: 'Vios vs City — harga pasaran berdampingan',
      why:  'Julat harga iklan setanding untuk kedua-duanya, sebelah-menyebelah.' },
  ],
  // ── HUB → GUIDE ───────────────────────────────────────────────────────────
  //
  // The link graph ran one way. GUIDE_LINKS wired guide→guide and guide→hub,
  // so the guides finally had inbound links — but the market-price hubs, which
  // are the highest-priority pages in app/sitemap.ts (0.85–0.9) and the ones
  // that actually rank, passed nothing back into the guides. The strongest
  // pages on the site were a dead end.
  //
  // That matters for one page in particular. /faq/roadtax-by-state holds the
  // correct answer to "roadtax ikut negeri" — a query where, checked live on
  // 2026-09-02, eight competing pages and the AI summarising them all give the
  // WRONG answer (that it varies by state; it is federal, two schedules). Being
  // right earns nothing without links, and it had none from anything strong.
  //
  // Each pairing below is the question the source page LEAVES the reader with,
  // per the rule above — not a directory of everything Paqar has written.
  'harga-kereta-terpakai': [
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga kereta terpakai',
      why:  'Anda dah tahu harga pasaran. Ini cara menukarnya jadi tawaran yang penjual boleh terima.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Harga yang betul untuk kereta yang bermasalah tetap harga yang salah.' },
    { href: '/faq/roadtax-by-state', title: 'Berapa roadtax kereta ini',
      why:  'Harga beli bukan kos sebenar. Roadtax ikut kapasiti enjin, bukan ikut negeri.' },
  ],
  'bandingkan': [
    { href: '/faq/honda-city-vs-toyota-vios', title: 'Honda City vs Toyota Vios',
      why:  'Perbandingan penuh dua sedan yang paling kerap dibanding — bukan sekadar julat harga.' },
    { href: '/faq/best-first-car-under-30k', title: 'Kereta pertama terbaik bawah RM30k',
      why:  'Kalau ini kereta pertama anda, mula dari senarai pendek ini dahulu.' },
  ],
  'harga-perodua-terpakai': [
    { href: '/faq/best-first-car-under-30k', title: 'Kereta pertama terbaik bawah RM30k',
      why:  'Myvi ada dalam hampir setiap senarai pendek kereta pertama. Ini sebabnya, dan bila ia bukan pilihan terbaik.' },
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga kereta terpakai',
      why:  'Anda dah tahu julat harga Perodua. Ini cara guna angka itu.' },
  ],
  'harga-honda-terpakai': [
    { href: '/faq/honda-city-buying-guide', title: 'Panduan beli Honda City terpakai',
      why:  'Generasi mana, varian S/E/V yang mana, dan apa perlu disemak pada unit tertentu.' },
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga kereta terpakai',
      why:  'Anda dah tahu julat harga Honda. Ini cara guna angka itu.' },
  ],
  'harga-toyota-terpakai': [
    { href: '/faq/toyota-vios-buying-guide', title: 'Panduan beli Toyota Vios terpakai',
      why:  'Tahun mana paling berbaloi, dan tanda bahaya yang khusus untuk Vios.' },
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga kereta terpakai',
      why:  'Anda dah tahu julat harga Toyota. Ini cara guna angka itu.' },
  ],
  'harga-proton-terpakai': [
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga kereta terpakai',
      why:  'Anda dah tahu julat harga Proton. Ini cara guna angka itu.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Senarai semak penuh untuk dibawa masa pergi tengok kereta.' },
  ],
  'harga-nissan-terpakai': [
    { href: '/faq/how-to-negotiate-used-car', title: 'Cara rundingkan harga kereta terpakai',
      why:  'Anda dah tahu julat harga Nissan. Ini cara guna angka itu.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Senarai semak penuh untuk dibawa masa pergi tengok kereta.' },
  ],
  // /panduan is priority 0.9 in app/sitemap.ts and lists NINE guides — every
  // one of them a /panduan-* or /cara-* page. It links to none of the eight
  // /faq/* guides, while /faq links out to /panduan. Two guide hubs for the
  // same buyer, pointing one way, which is why sitemap.ts could accurately
  // call /faq "the only internal path into the /faq/* guides".
  'panduan': [
    { href: '/faq', title: 'Soalan lazim & panduan model',
      why:  'Panduan khusus mengikut model — Myvi, City, Vios — dan soalan yang pembeli paling kerap tanya.' },
    { href: '/faq/what-to-check-buying-used-car', title: 'Apa nak periksa sebelum beli',
      why:  'Senarai semak penuh: luaran, dalaman, enjin, test drive, dan bila patut berundur.' },
    { href: '/faq/roadtax-by-state', title: 'Roadtax ikut negeri? Sebenarnya tidak',
      why:  'Kadar JPJ sebenar mengikut kapasiti enjin, dan kenapa ramai tersalah sangka ia ikut negeri.' },
  ],
}
