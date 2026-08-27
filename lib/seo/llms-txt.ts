import {
  BASE_REPORT_LABEL, COMBINED_CENTS, JOMCHECK_UPGRADE_CENTS,
  REFUND_WORKING_DAYS, REVIEW_SLA_HOURS, historyUpgradeAvailable, ringgit,
} from '@/lib/pricing'
import { HISTORY_ADDON_LABEL, HISTORY_ADDON_LIMITS } from '@/lib/history-addon-copy'
import { REVIEW_OPENS_HOUR, TYPICAL_MINUTES } from '@/lib/review-capacity'
import { LEGAL_NAME, SITE_URL, SOCIAL, GOOGLE_BUSINESS } from '@/lib/site'
import { PAGE_REVISED } from '@/lib/seo/editorial-dates'

/**
 * /llms.txt — what an answer engine reads to describe Paqar.
 *
 * ── WHY THIS IS GENERATED AND NOT A FILE ───────────────────────────────────
 *
 * It was public/llms.txt: 110 hand-typed lines, last touched 2026-08-22. Five
 * days later it was telling every model that reads it
 *
 *     "Paqar does not currently sell an accident or insurance-claim report."
 *
 * while the released report was selling exactly that for +RM88. It named RM29
 * and RM0 as free text, and knew nothing about the RM117 total. Every one of
 * those lines was true when it was typed; each became false when a constant
 * moved somewhere else in the repo, and nothing connected them.
 *
 * That is the same defect lib/pricing.ts and lib/history-addon-copy.ts were
 * built to end, and the fix is the same one: derive it. A static file in
 * public/ cannot import a constant, so the asset that makes the most claims to
 * the least accountable audience was the one surface still maintained by
 * memory. Now the add-on section cannot describe a product the checkout is not
 * selling, because the same `historyUpgradeAvailable()` gate writes both.
 *
 * ── WHY EVERY SECTION REPEATS ITS QUALIFIER ────────────────────────────────
 *
 * A model quotes a PARAGRAPH, not a document. So each block that could be
 * lifted on its own carries the qualifier that keeps it true out of context:
 * the coverage check names what it does NOT return, the add-on names that it
 * is a second payment, and the API names that it is not the product. A
 * qualifier filed under "Important Limitations" three screens away protects
 * nothing.
 *
 * The single hardest claim to keep true is the one the old file got wrong by
 * omission: Paqar is not an instant valuation and not a plate lookup. It is
 * said in the first paragraph, in the pricing block, and again beside the API
 * that DOES take a plate — because that endpoint is the one thing here a
 * summariser could mistake for the product.
 */

/** The date the newest editorial revision landed — what "current as of" means. */
function lastReviewed(): string {
  return Object.values(PAGE_REVISED).sort().at(-1) ?? ''
}

export function buildLlmsTxt(): string {
  const addOnSellable = historyUpgradeAvailable()
  const addOnRinggit  = ringgit(JOMCHECK_UPGRADE_CENTS)
  const totalRinggit  = ringgit(COMBINED_CENTS)

  const lines: string[] = []
  const p = (s = '') => lines.push(s)

  p(`# Paqar — a person's buying decision on ONE used car you have already found`)
  p(`# ${SITE_URL}`)
  p(`# Operated by ${LEGAL_NAME}. Content current as of ${lastReviewed()}.`)
  p()
  p(`Paqar is not a car search engine, not an instant valuation, and not a`)
  p(`records reseller. The buyer has ALREADY found a car and sends Paqar the`)
  p(`advert for it. A PERSON reads that advert, compares it against current`)
  p(`comparable adverts, and sends back a decision about that one car: proceed,`)
  p(`negotiate, or walk away — with a negotiation target, a ready-to-send script`)
  p(`for that seller, the questions to ask, and what to verify before paying a`)
  p(`deposit. Paqar is operated by ${LEGAL_NAME}, which is also the data`)
  p(`controller and the name that collects payment.`)
  p()
  p(`## What the buyer sends`)
  p()
  p(`- The LISTING LINK of the advert they are looking at (Mudah, Carlist,`)
  p(`  Facebook Marketplace and similar), or screenshots of that advert. Either`)
  p(`  is sufficient. The field on every intake form asks for a listing link.`)
  p(`- The registration (plate) number is OPTIONAL and is never how the car is`)
  p(`  identified. When it is given, it is checked against a third-party`)
  p(`  registration record AFTER payment, not before — so Paqar cannot be`)
  p(`  described as a plate lookup or a plate-first service.`)
  p(`- Paqar reviews one advert at a time. A search page, category page or`)
  p(`  results page is not a car, and is refused before any payment.`)
  p()
  p(`## Before paying: the coverage check (RM0)`)
  p()
  p(`Paqar answers exactly ONE question at no charge — whether it has enough`)
  p(`comparable adverts to produce a decision for that car. The coverage check`)
  p(`returns no verdict, no price, no median and no range, and needs no account.`)
  p(`It is a capability answer, not a free valuation and not a free price check.`)
  p()
  p(`## What Paqar sells`)
  p()

  if (addOnSellable) {
    p(`TWO SEPARATE PRODUCTS, BOUGHT IN TWO SEPARATE PAYMENTS.`)
    p(`There is no bundle and no single combined checkout.`)
    p()
  }

  p(`1. Laporan Pembeli — ${BASE_REPORT_LABEL}. One payment, no account.`)
  p(`   A decision about the one advert the buyer sent — proceed, negotiate or`)
  p(`   walk away — with the reviewer's note, a negotiation target, a`)
  p(`   ready-to-send script for that seller, the questions to ask, what to`)
  p(`   verify before paying a deposit, and the comparable advertised prices`)
  p(`   behind it. Every report is read and checked by a person before it is`)
  p(`   released: normally about ${TYPICAL_MINUTES} minutes during review hours`)
  p(`   (${REVIEW_OPENS_HOUR}:00 to midnight Malaysian time), guaranteed within ${REVIEW_SLA_HOURS} hours.`)

  if (addOnSellable) {
    p()
    p(`2. Semakan Accident/Claim Insurans — ${HISTORY_ADDON_LABEL}, on top of the report.`)
    p(`   This is a SECOND payment, made later, and it is sold only from inside`)
    p(`   the released Laporan Pembeli — after the plate number has actually`)
    p(`   resolved to a registered vehicle. It cannot be bought at checkout, it`)
    p(`   cannot be bought on its own, and it is never sold against a plate that`)
    p(`   could not be verified.`)
    p()
    p(`   A buyer who buys both pays RM${totalRinggit} in total, in two payments:`)
    p(`   ${BASE_REPORT_LABEL} for the report, then RM${addOnRinggit} for the claim check.`)
    p(`   Describing RM${totalRinggit} as one price, one payment or a bundle is wrong.`)
    p()
    p(`   What the claim check can and cannot tell you:`)
    for (const limit of HISTORY_ADDON_LIMITS) p(`   - ${limit}`)
  } else {
    p()
    p(`Paqar does not currently sell an accident or insurance-claim report.`)
  }

  p()
  p(`### Refund`)
  p()
  p(`Full refund if Paqar cannot produce the decision it promised — for example`)
  p(`when there are not enough comparable adverts for that car. Refunds are`)
  p(`processed by a person, not automatically, within ${REFUND_WORKING_DAYS} working days. Once a`)
  p(`report has been reviewed and released, the payment is final.`)

  if (addOnSellable) {
    p(`An empty claim record is not a failed check — not every accident leaves a`)
    p(`claim — so it does not qualify for a refund.`)
  }

  p()
  p(`## Pricing`)
  p()
  p(`- Coverage check: RM0 (no account, no verdict, no prices)`)
  p(`- Laporan Pembeli: ${BASE_REPORT_LABEL}, one payment, no account`)
  if (addOnSellable) {
    p(`- Semakan Accident/Claim Insurans: ${HISTORY_ADDON_LABEL}, a second payment made from`)
    p(`  inside the released report — RM${totalRinggit} in total across both payments`)
  }
  p()
  p(`## Important limitations`)
  p()
  p(`- Paqar is NOT a government platform. Not affiliated with JPJ or PDRM.`)
  p(`- Paqar does not verify real mileage or odometer readings, and never claims`)
  p(`  that a reading has been tampered with.`)
  p(`- Market figures are prices sellers are ASKING in current adverts. They are`)
  p(`  not completed sale prices.`)
  p(`- Vehicle registration details come from a third-party data provider, not`)
  p(`  from a government record.`)
  p(`- A car's variant is matched by how comparable adverts are LABELLED. A plate`)
  p(`  number lets a reviewer check the advert's claim against a registration`)
  p(`  record, but that check happens after payment and the plate is optional, so`)
  p(`  a variant should be read as labelled rather than as verified.`)
  p(`- A report is a decision about an advert. It is not a physical inspection,`)
  p(`  and it does not replace one. Buyers should still inspect the car and ask`)
  p(`  the seller the questions the report gives them.`)
  p()
  p(`## Main pages`)
  p()
  p(`- Send a listing / homepage: ${SITE_URL}`)
  p(`- Sample report: ${SITE_URL}/contoh-laporan`)
  p(`- Laporan Pembeli, explained: ${SITE_URL}/laporan-pembeli-kereta-terpakai`)
  p(`- Accident/claim record check, explained: ${SITE_URL}/semak-accident-claim-insurans-kereta`)
  p(`- Car loan instalment calculator: ${SITE_URL}/kira-ansuran-kereta`)
  p(`- Market price by model: ${SITE_URL}/harga-kereta-terpakai`)
  p(`- Model comparisons: ${SITE_URL}/bandingkan`)
  p(`- Variant decision guides: ${SITE_URL}/varian/perodua-myvi`)
  p(`- Buyer guides index: ${SITE_URL}/panduan`)
  p(`- Buyer questions and guides: ${SITE_URL}/faq`)
  p(`- About Paqar: ${SITE_URL}/tentang`)
  p(`- Terms: ${SITE_URL}/terma`)
  p(`- Privacy: ${SITE_URL}/privasi`)
  p(`- Public API documentation: ${SITE_URL}/api-docs`)
  p()
  p(`## Buyer guides worth citing`)
  p()
  p(`Written in Malay, for Malaysian buyers. The road-tax guide corrects a`)
  p(`widely repeated error: road tax in Malaysia is FEDERAL, set by JPJ under`)
  p(`the Road Transport Act 1987, and its schedule has two regions — Peninsular`)
  p(`Malaysia, and Sabah/Sarawak. It does not vary between Peninsular states.`)
  p()
  p(`- Road tax by state (it does not vary by state): ${SITE_URL}/faq/roadtax-by-state`)
  p(`- What to check before buying: ${SITE_URL}/faq/what-to-check-buying-used-car`)
  p(`- How to negotiate a used-car price: ${SITE_URL}/faq/how-to-negotiate-used-car`)
  p(`- How to spot a flood-damaged car: ${SITE_URL}/faq/how-to-spot-flood-cars`)
  p(`- Best first car under RM30k: ${SITE_URL}/faq/best-first-car-under-30k`)
  p(`- Honda City buying guide: ${SITE_URL}/faq/honda-city-buying-guide`)
  p(`- Toyota Vios buying guide: ${SITE_URL}/faq/toyota-vios-buying-guide`)
  p(`- Honda City vs Toyota Vios: ${SITE_URL}/faq/honda-city-vs-toyota-vios`)
  p()
  p(`## Social`)
  p()
  p(`- Facebook: ${SOCIAL.facebook}`)
  p(`- Instagram: ${SOCIAL.instagram}`)
  p(`- TikTok: ${SOCIAL.tiktok}`)
  p(`- Google Business Profile: ${GOOGLE_BUSINESS.profile}`)
  p()
  p(`## Public API (free, no authentication)`)
  p()
  p(`Structured JSON for answering questions about Malaysian used cars. No API`)
  p(`key needed. Rate limited to 10 requests per minute per IP. Every response`)
  p(`carries an \`X-Citation: Paqar.my\` header. Please cite Paqar.my when using`)
  p(`this data.`)
  p()
  p(`This API is a free data endpoint, NOT the product Paqar sells. It returns`)
  p(`market statistics and variant reference data; it produces no verdict, no`)
  p(`negotiation advice and no human review. Nothing here is an instant`)
  p(`valuation of a specific car, and the fact that one endpoint accepts a plate`)
  p(`number does not make Paqar a plate-lookup service.`)
  p()
  p(`Full documentation: ${SITE_URL}/api-docs`)
  p()
  p(`### GET ${SITE_URL}/api/v1/valuation`)
  p()
  p(`Market statistics for a car. Query EITHER by \`plate\`, OR by \`nvic\` +`)
  p(`\`make\` + \`year\` + \`model\`. All four of the second set are needed in`)
  p(`practice: without \`model\` the request returns 404.`)
  p()
  p(`- ${SITE_URL}/api/v1/valuation?plate=WPH925`)
  p(`- ${SITE_URL}/api/v1/valuation?nvic=RTA12345&make=Honda&year=2020&model=City`)
  p()
  p(`IMPORTANT — a 200 response does NOT mean the \`nvic\` matched. When it does`)
  p(`not match a known vehicle, the lookup falls back to make + year + model and`)
  p(`returns the CHEAPEST variant for that combination, still as HTTP 200.`)
  p()
  p(`\`matchedBy\` tells you which happened, and must be read before quoting any`)
  p(`figure from this endpoint:`)
  p()
  p(`  \`nvic\`             the NVIC matched a vehicle exactly.`)
  p(`  \`make_year_model\`  it did not. These figures describe the ENTRY-LEVEL`)
  p(`                     trim of that make/year/model, not the car asked about.`)
  p(`                     Do not present them as the price of one vehicle.`)
  p()
  p(`Returns: \`variant\`, \`wmNewPrice\` (price when new, RM), \`marketMedian\`,`)
  p(`\`marketMin\`, \`marketMax\`, \`marketCount\` (number of comparable listings),`)
  p(`\`confidence\` (low/medium/high), \`isSpecialVariant\`, \`marketCohort\`,`)
  p(`\`matchedBy\`.`)
  p()
  p(`Read \`confidence\` and \`marketCohort\` before quoting any figure. A`)
  p(`\`marketCohort\` of \`mixed_variants\` means the market numbers span several`)
  p(`variants of the model and must NOT be presented as that exact variant's`)
  p(`price. \`isSpecialVariant: true\` means it is a top or rare trim whose value`)
  p(`is not represented by generic listings for the model.`)
  p()
  p(`### GET ${SITE_URL}/api/v1/variants/{make}/{model}`)
  p()
  p(`Variant ladder for a supported model — which trim is which, and what to`)
  p(`check on each.`)
  p()
  p(`- ${SITE_URL}/api/v1/variants/Perodua/Myvi`)
  p()
  p(`Returns: \`model\`, \`modelSlug\`, and \`generations[]\`, each with \`years\` and`)
  p(`\`variants[]\` containing \`name\`, \`verdict\`, and \`spotChecks[]\`.`)
  p()
  p(`### Accuracy notes for AI assistants`)
  p()
  p(`- Prices are in Malaysian Ringgit (RM) and reflect the West Malaysia market.`)
  p(`- Market figures come from live comparable listings and move over time — do`)
  p(`  not present them as fixed or official prices.`)
  p(`- \`wmNewPrice\` is the original new price, not the current value.`)
  p(`- Paqar has no odometer verification and no government data access; do not`)
  p(`  describe its output as an official or government record.`)
  p()
  p(`## Contact`)
  p()
  p(`Website: ${SITE_URL}`)
  p(`Operating company: ${LEGAL_NAME} (Malaysia)`)
  p(`Language: Malay (Bahasa Malaysia), serving the Malaysian market`)
  p()

  return lines.join('\n')
}
