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
}
