import { BRANDS, MODELS_BY_BRAND } from '@/lib/model-catalog'

/**
 * Turning a listing page into the four fields coverage needs, with an honest
 * account of how sure we are about each one.
 *
 * ── WHY CONFIDENCE IS PER-FIELD ────────────────────────────────────────────
 *
 * A page can state the price unambiguously in a meta tag while leaving the
 * variant buried in free-text prose. One overall score would force the intake
 * to either re-ask everything (the friction this exists to remove) or accept
 * everything (which is how a tester watched an asking price change from
 * RM35,000 to RM55,000). So each field carries its own status, and the intake
 * asks about exactly the uncertain ones.
 *
 * ── WHY THE ASKING PRICE IS STILL NOT SPECIAL-CASED ────────────────────────
 *
 * An earlier version forced an explicit confirmation tap on the price even at
 * high confidence, reasoning that a wrong price produces a confidently wrong
 * decision. That reasoning is right about the CONSEQUENCE and wrong about the
 * remedy.
 *
 * The price is displayed prominently with an Ubah action, and pressing the RM29
 * button is itself the confirmation — a buyer who reads "Seller minta RM55,000"
 * directly above the pay button and pays has confirmed it as surely as one who
 * tapped an extra "Ya, betul". The extra tap bought no additional signal and
 * reintroduced exactly the friction this intake exists to remove.
 *
 * An explicit question is asked only when the value is genuinely uncertain:
 * missing, or read out of a human-written title where it is as likely to be a
 * monthly instalment as an asking price.
 *
 * ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────
 *
 * It does not guess. A field it cannot read is returned as 'missing' rather
 * than inferred from the page title, because a plausible-looking wrong value
 * is worse than an empty one: the buyer skims past it, and the reviewer has
 * nothing flagging it.
 */

export type FieldStatus = 'high' | 'medium' | 'missing'

export interface ExtractedField<T> {
  value:  T | null
  status: FieldStatus
  /** Which part of the page this came from. Kept for the reviewer's audit. */
  evidence?: string | null
}

export interface ExtractedListing {
  brand:        ExtractedField<string>
  model:        ExtractedField<string>
  year:         ExtractedField<string>
  askingPriceRm: ExtractedField<number>
  mileageKm:    ExtractedField<number>
  variant:      ExtractedField<string>
}

export type ExtractionSource = 'url_metadata' | 'screenshot_ocr' | 'buyer_entry'

/** Pull a meta tag's content by property or name. */
function meta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i',
  )
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i',
  )
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null
}

function titleOf(html: string): string {
  return meta(html, 'og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ''
}

/** RM 55,000 / RM55000 / 55,000 — the shapes Malaysian listings actually use. */
export function parseRinggit(text: string): number | null {
  const m = text.match(/RM\s*([\d,]{4,12})/i) ?? text.match(/\b([\d,]{5,12})\b/)
  if (!m?.[1]) return null
  const n = parseInt(m[1].replace(/,/g, ''), 10)
  return Number.isFinite(n) && n >= 1000 && n <= 2_000_000 ? n : null
}

/** "85,000 km" / "85k km" / "85000km". */
export function parseMileage(text: string): number | null {
  // MUDAH'S BANDED FORM: "100k - 109k", with no "km" after it.
  //
  // It is how Mudah displays mileage on essentially every advert, and nothing
  // here matched it — so the single most common Malaysian listing format
  // returned null while the exact-figure patterns below handled the rare case.
  //
  // The midpoint, because the seller stated a band and the midpoint is the
  // only point estimate that does not take a side. Rounding down would flatter
  // the seller on the one number a buyer uses to judge wear; rounding up would
  // manufacture a concern the advert never claimed. Provenance stays
  // listing_claimed either way, so no finding is ever built on it alone —
  // see lib/mileage-provenance.
  const band = text.match(/\b(\d{1,3})\s*k\s*[-–—]\s*(\d{1,3})\s*k\b/i)
  if (band?.[1] && band[2]) {
    const lo = parseInt(band[1], 10) * 1000
    const hi = parseInt(band[2], 10) * 1000
    if (hi >= lo && hi <= 1_500_000) return Math.round((lo + hi) / 2)
  }

  const k = text.match(/\b(\d{1,3})\s*k\s*km\b/i)
  if (k?.[1]) return parseInt(k[1], 10) * 1000
  const m = text.match(/\b([\d,]{3,9})\s*km\b/i)
  if (!m?.[1]) return null
  const n = parseInt(m[1].replace(/,/g, ''), 10)
  return Number.isFinite(n) && n > 0 && n <= 1_500_000 ? n : null
}

/** A four-digit year in a plausible range for a used car. */
export function parseYear(text: string): string | null {
  const now = new Date().getFullYear()
  for (const m of text.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)) {
    const y = parseInt(m[1]!, 10)
    if (y >= 1990 && y <= now + 1) return String(y)
  }
  return null
}

/** Match a known brand, and then one of ITS models — never a model alone. */
export function parseVehicle(text: string): { brand: string | null; model: string | null } {
  const t = text.toLowerCase()
  const brand = BRANDS.find(b => t.includes(b.toLowerCase())) ?? null
  if (!brand) return { brand: null, model: null }
  const model = (MODELS_BY_BRAND[brand] ?? []).find(m => t.includes(m.toLowerCase())) ?? null
  return { brand, model }
}

const field = <T>(value: T | null, status: FieldStatus, evidence?: string | null): ExtractedField<T> =>
  ({ value, status, evidence: value == null ? null : evidence ?? null })

/**
 * Read the car out of the URL the buyer pasted.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Car portals slugify the listing title into the path, so the buyer usually
 * hands us the car in the link itself:
 *
 *   carlist.my/recon-cars/2023-toyota-alphard-2-5-sc-dim-sunroof/18950179
 *   mudah.my/honda-city-1-5-ivtec-v-spec-1owner-original-condi-115552872.htm
 *
 * Only Mudah can be READ — Carlist sits behind Cloudflare and Facebook
 * Marketplace requires a login, and going around either is off the table. So a
 * Carlist buyer was handed four empty fields and asked to type a car we were
 * already holding.
 *
 * This fetches NOTHING. It parses a string the buyer gave us, which is neither
 * a fetch nor an access-control question, and it works on any platform whose
 * URLs carry the model — which is most of them.
 *
 * NOT THE PRICE. Slugs almost never carry one, and a number lifted out of
 * "2-5-sc" would be a fabricated asking price on the one field a buyer must
 * not have invented for them. The price stays theirs to enter.
 */
export function parseListingUrlSlug(rawUrl: string): { brand: string | null; model: string | null; year: string | null } {
  let path: string
  try {
    path = new URL(rawUrl).pathname
  } catch {
    return { brand: null, model: null, year: null }
  }

  // Hyphens and slashes to spaces; drop the trailing numeric ad id and any
  // file extension so they cannot be read as a year.
  const words = decodeURIComponent(path)
    .replace(/\.[a-z]{2,4}$/i, '')
    .replace(/[/\-_]+/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .trim()

  const { brand, model } = parseVehicle(words)
  return { brand, model, year: parseYear(words) }
}

/**
 * Extract from a fetched listing page.
 *
 * Structured metadata (og:*) is treated as HIGH confidence: the site authored
 * it for machines, so it is the site's own statement rather than our reading of
 * its prose. Values recovered from the title are MEDIUM — the title is written
 * for humans and routinely contains a second car, a dealer name, or a monthly
 * instalment that reads exactly like a price.
 */
export function extractFromHtml(html: string): ExtractedListing {
  const title = titleOf(html)
  const desc  = meta(html, 'og:description') ?? ''
  const hay   = `${title} ${desc}`

  const ogPrice = meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount')
  const price   = ogPrice ? parseRinggit(`RM${ogPrice}`) : parseRinggit(hay)

  const { brand, model } = parseVehicle(hay)
  const year    = parseYear(title) ?? parseYear(desc)
  const mileage = parseMileage(hay)

  return {
    brand:  field(brand,  brand  ? 'high'   : 'missing', 'og:title'),
    model:  field(model,  model  ? 'high'   : 'missing', 'og:title'),
    year:   field(year,   year   ? 'high'   : 'missing', 'og:title'),
    // MEDIUM unless the site stated it in a price meta tag. A number scraped
    // out of a human-written title is as likely to be a monthly instalment.
    askingPriceRm: field(price, price ? (ogPrice ? 'high' : 'medium') : 'missing',
                         ogPrice ? 'product:price:amount' : 'og:title'),
    mileageKm: field(mileage, mileage ? 'medium' : 'missing', 'og:description'),
    // Variant is never read from free text. Its short tokens ("RS", "V", "E")
    // collide with ordinary words, and a wrong variant silently reprices the
    // car — the exact failure lib/comparables goes to lengths to avoid.
    variant: field<string>(null, 'missing'),
  }
}

/** Fields the intake must ask about, in the order a buyer should see them. */
export function fieldsNeedingInput(x: ExtractedListing): (keyof ExtractedListing)[] {
  const required: (keyof ExtractedListing)[] = ['brand', 'model', 'year', 'askingPriceRm']
  return required.filter(k => x[k].status === 'missing' || x[k].status === 'medium')
}

/**
 * May the intake proceed to coverage without asking anything?
 *
 * All four coverage fields — including the price — at HIGH confidence. The
 * buyer still sees every value, prominently and editable; they are simply not
 * interrupted for a value the source stated unambiguously.
 */
export function canProceedPassively(x: ExtractedListing): boolean {
  return (['brand', 'model', 'year', 'askingPriceRm'] as const)
    .every(k => x[k].status === 'high')
}

/**
 * Ask about the price only when it is genuinely uncertain.
 *
 * 'medium' means it was scraped from a human-written title, where a number is
 * as likely to be a monthly instalment or a second car. 'missing' means we have
 * nothing. A price the site itself published in a meta tag is not questioned —
 * it is shown, editable, above the pay button.
 */
export function needsPriceConfirmation(x: ExtractedListing): boolean {
  return x.askingPriceRm.status !== 'high'
}
