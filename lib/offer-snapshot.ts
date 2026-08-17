import { z } from 'zod'
import type { ComparableCohort } from '@/lib/comparables'
import type { OfferAvailability } from '@/lib/offer'

/**
 * The evidence a buyer was sold on, frozen at the moment of the promise.
 *
 * WHY IT HOLDS THE LISTINGS AND NOT JUST THE FIGURES
 *
 * The report derives the offer band, the median and range, the negotiation
 * script and the comparable price chips from ONE cohort. If the snapshot stored
 * only the aggregates, the chips would still come from the live cache, and a
 * buyer could read "harga tengah RM45,000" above a row of chips that no longer
 * average anything like it. That is two evidence periods presented as one.
 *
 * So the snapshot holds the exact supporting listings, and the renderer feeds
 * them back through the SAME buildComparableCohort the live path uses. Every
 * derived claim then agrees by construction rather than by discipline — there
 * is no second code path to keep in step.
 *
 * The aggregates are stored ALONGSIDE the listings, not instead of them: they
 * are what the buyer was actually shown, so they are the audit record if the
 * recomputation ever disagrees.
 *
 * PRIVACY: market aggregates and public advert rows. No plate, email, IC, VIN,
 * claim token, session or buyer identifier.
 */

/** Bump when the shape changes incompatibly. Older snapshots then fail parsing and fall back to live. */
export const OFFER_SNAPSHOT_SCHEMA_VERSION = 1

const listingSchema = z.object({
  price: z.number().finite().positive(),
  title: z.string(),
  url:   z.string(),
  year:  z.string().nullable().optional(),
})

export const offerSnapshotSchema = z.object({
  /** Shape version, so an incompatible old row degrades instead of misrendering. */
  schemaVersion: z.literal(OFFER_SNAPSHOT_SCHEMA_VERSION),
  /** When Paqar froze this evidence — i.e. when the buyer was made the promise. */
  capturedAt:    z.string().datetime(),
  /** fetched_at of the market_price_cache row it came from: the EVIDENCE PERIOD. */
  sourceFetchedAt: z.string().datetime(),
  /** The exact adverts the figures and chips derive from. */
  listings: z.array(listingSchema).min(1),
  /** What the buyer was shown. Audit record, not the render source. */
  aggregates: z.object({
    count:        z.number().int().nonnegative(),
    median:       z.number().finite().nullable(),
    min:          z.number().finite().nullable(),
    max:          z.number().finite().nullable(),
    mode:         z.enum(['same_variant', 'mixed_variants', 'normal']),
    variantToken: z.string().nullable(),
  }),
  /** The offer band that was promised. */
  offer: z.object({
    low:  z.number().finite().positive(),
    high: z.number().finite().positive(),
  }),
}).strict()

export type OfferSnapshot = z.infer<typeof offerSnapshotSchema>

/**
 * Build a snapshot from the cohort that just authorised a sale.
 *
 * Returns null when the offer is unavailable — there is nothing to freeze, and
 * writing a snapshot for an unsellable state would imply a promise was made.
 */
export function buildOfferSnapshot(params: {
  cohort:          ComparableCohort
  offer:           OfferAvailability
  sourceFetchedAt: string
  capturedAt?:     string
}): OfferSnapshot | null {
  if (!params.offer.available) return null

  const candidate = {
    schemaVersion:   OFFER_SNAPSHOT_SCHEMA_VERSION,
    capturedAt:      params.capturedAt ?? new Date().toISOString(),
    sourceFetchedAt: new Date(params.sourceFetchedAt).toISOString(),
    listings: params.cohort.listings.map(l => ({
      price: l.price,
      title: l.title,
      url:   l.url,
      year:  (l as { year?: string | null }).year ?? null,
    })),
    aggregates: {
      count:        params.cohort.count,
      median:       params.cohort.median,
      min:          params.cohort.min,
      max:          params.cohort.max,
      mode:         params.cohort.mode,
      variantToken: params.cohort.variantToken,
    },
    offer: { low: params.offer.low, high: params.offer.high },
  }

  // Validate what we are about to persist. A snapshot that cannot be parsed
  // back is worse than none: it would fail silently at render time, when the
  // buyer has already paid.
  const parsed = offerSnapshotSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/**
 * Parse a stored snapshot. STRICT — anything unrecognised returns null and the
 * caller falls back to the live cohort, which is the pre-snapshot behaviour.
 *
 * Strictness is the point: a half-understood snapshot could drive an offer band
 * from one evidence period and chips from another, which is the exact failure
 * the snapshot exists to prevent.
 */
export function parseOfferSnapshot(raw: unknown): OfferSnapshot | null {
  if (raw == null) return null
  const parsed = offerSnapshotSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * The evidence period, for the label that must sit beside the figures.
 *
 * Snapshotted evidence is historical by definition, and presenting it without
 * saying so is how two periods get mixed in a buyer's head.
 */
export function evidencePeriodLabel(snapshot: OfferSnapshot): string {
  const d = new Date(snapshot.sourceFetchedAt)
  const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']
  return `Iklan setanding pada ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} — iklan mungkin sudah berubah sejak itu.`
}
