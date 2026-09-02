import type { Metadata } from 'next'

/**
 * One builder for every indexable page's metadata.
 *
 * ── THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────
 *
 * Next.js merges metadata field by field at the TOP level, and `openGraph` is
 * one field. A child that declares its own `openGraph` therefore REPLACES the
 * parent's entirely — it does not merge into it. Measured against the built
 * output of 116 public pages, that produced two opposite failures, and between
 * them they covered every page on the site:
 *
 *   Pages WITHOUT their own openGraph (10, all /faq/* guides)
 *     og:title       the HOMEPAGE's title
 *     og:description the HOMEPAGE's description
 *     og:url         https://paqar.my
 *
 *     Every one of those guides told Facebook and WhatsApp that it WAS the
 *     homepage. The root layout already carries a long comment explaining why
 *     a canonical must never be set there — the same trap, correctly diagnosed
 *     for `alternates.canonical` and left in place for `openGraph.url`.
 *
 *   Pages WITH their own openGraph (30)
 *     og:locale      absent on 108 of 116 pages
 *     og:image       absent on 27
 *
 *     Declaring an openGraph block silently dropped the locale and the image
 *     the root had set.
 *
 * A helper fixes this in a way a convention cannot: there is no longer a
 * partial openGraph to write. Give it a path, a title and a description, and
 * every required field is present and self-consistent.
 *
 * ── WHAT IT GUARANTEES ─────────────────────────────────────────────────────
 *
 *   · canonical is absolute, on https://paqar.my, and self-referencing
 *   · og:url EQUALS the canonical — never the homepage, never a relative path
 *   · og:title and og:description default to the page's own, not the root's
 *   · og:locale is ms_MY on every page
 *   · og:image is always present, absolute, with width, height and alt
 *   · twitter:card stays inherited from the root, so cards resolve from the
 *     page's own openGraph rather than needing a second copy of every string
 */

export const SITE_ORIGIN = 'https://paqar.my'

/**
 * The default social image: Paqar's own OG renderer, which draws the verdict
 * card on brand. Deliberately not a stock car photograph — the product visual
 * is the result a buyer gets, and a generic car says nothing Paqar means.
 */
/**
 * The brand's one-line self-description, as alt text on the social card.
 *
 * It read "Paqar — semak harga kereta terpakai sebelum bayar deposit", and was
 * hand-typed into 27 more pages beside this file that already owned it —
 * including /privasi and /terma, which are not about checking a price at all.
 *
 * Same defect as ORG_DESCRIPTION in lib/site.ts, and corrected the same way:
 * it led with SEMAK HARGA, which is the crowded commodity category Paqar loses
 * on price inside, rather than the human verdict nothing else in the market
 * sells. Exported so the 27 copies became references and the next page gets it
 * right by default.
 *
 * Low individual weight — it is alt text on a share image, not a ranking
 * signal. It is here because 27 copies of the wrong positioning is how the
 * wrong positioning survives a correction.
 */
export const BRAND_OG_ALT =
  'Paqar — keputusan disemak manusia untuk satu iklan kereta terpakai, sebelum bayar deposit'

const DEFAULT_OG_IMAGE = {
  url:    '/api/og',
  width:  1200,
  height: 630,
  alt:    BRAND_OG_ALT,
} as const

export interface OgImage {
  url:    string
  width?: number
  height?: number
  alt?:   string
}

export interface PageMetadataInput {
  /** Route path with a leading slash, e.g. `/faq/roadtax-by-state`. `/` for home. */
  path:           string
  title:          string
  description:    string
  /** Defaults to `title`. Set only where a social headline should differ. */
  ogTitle?:       string
  /** Defaults to `description`. */
  ogDescription?: string
  /** Defaults to the branded verdict-card renderer. */
  images?:        readonly OgImage[]
  /** `article` for guides, `website` otherwise. */
  type?:          'website' | 'article'
  robots?:        Metadata['robots']
}

/** Absolute, trailing-slash-free canonical for a path. */
export function canonicalUrl(path: string): string {
  if (!path.startsWith('/')) throw new Error(`path must start with "/": ${path}`)
  if (path === '/') return SITE_ORIGIN
  return SITE_ORIGIN + path.replace(/\/$/, '')
}

export function pageMetadata(input: PageMetadataInput): Metadata {
  const url    = canonicalUrl(input.path)
  const images = (input.images ?? [DEFAULT_OG_IMAGE]).map(i => ({
    url:    i.url.startsWith('http') ? i.url : `${SITE_ORIGIN}${i.url}`,
    width:  i.width  ?? 1200,
    height: i.height ?? 630,
    alt:    i.alt    ?? DEFAULT_OG_IMAGE.alt,
  }))

  return {
    title:       input.title,
    description: input.description,
    alternates:  { canonical: url },
    ...(input.robots ? { robots: input.robots } : {}),
    openGraph: {
      title:       input.ogTitle       ?? input.title,
      description: input.ogDescription ?? input.description,
      // The whole point. Never inherited, never the homepage.
      url,
      siteName: 'Paqar',
      locale:   'ms_MY',
      type:     input.type ?? 'website',
      images,
    },
  }
}
