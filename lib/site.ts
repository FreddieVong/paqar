// Single source of truth for Paqar's public identity: the profiles that
// represent the same real-world entity, and the channels a customer can
// actually reach us on.
//
// Scope note: `https://paqar.my` is still hardcoded in ~60 other places across
// the app. This module deliberately does NOT try to absorb them — migrating
// every literal is a separate refactor. What lives here is the set of values
// that were previously duplicated *and* drifting: the social profiles (which
// existed nowhere), the Google Business Profile (which existed in exactly one
// component), and the Organization schema node (which was retyped three times
// with different fields).

export const SITE_URL = 'https://paqar.my'

/**
 * The company behind the brand.
 *
 * Paqar is a trading name; TENTEC SDN BHD is the entity that operates it,
 * controls the data and collects the money — the footer, the terms, the
 * privacy policy and the Billplz page all say so. Structured data did not:
 * seventeen Organization nodes named "Paqar" and none named the company, so
 * the one question a cautious buyer asks before paying a stranger RM29 —
 * "who actually is this?" — had no machine-readable answer.
 *
 * NAME ONLY. The registration number and registered address are pending legal
 * review and must not be published anywhere until they have had it.
 */
export const LEGAL_NAME = 'TENTEC SDN BHD'

export const SOCIAL = {
  facebook:  'https://www.facebook.com/paqar.my',
  instagram: 'https://www.instagram.com/paqar.my',
  tiktok:    'https://www.tiktok.com/@paqar.my',
} as const

// Two distinct concepts, deliberately kept apart:
//   `profile` is the entity identity — the URL that goes in schema.org sameAs.
//   `review`  is a call-to-action deep link that opens the review composer.
// Using the /review URL as the entity identity would tell Google our canonical
// business profile is a form submission endpoint, so never substitute one for
// the other.
export const GOOGLE_BUSINESS = {
  profile: 'https://g.page/r/CcBaaoqXP_shEBM',
  review:  'https://g.page/r/CcBaaoqXP_shEBM/review',
} as const

// hello@paqar.my is NOT listed here, and that is intentional. It silently
// swallowed seven consecutive daily ops reports (see lib/meta-ads/alerts.ts).
// paqar.my now publishes MX records via Namecheap's forwarding service, but
// that only accepts mail for addresses with an explicit forwarding rule — so
// the address stays unlisted until someone has confirmed a rule exists AND
// tested a real round trip. Publishing an untested support address is how the
// original problem happened; WhatsApp is the channel we can actually verify.
//
// `whatsapp` is digits-only international format, no '+', spaces or hyphens,
// because that is what wa.me expects in the path: '60123456789'.
export const CONTACT = {
  email:    null as string | null,
  whatsapp: '60124424221' as string | null,
}

/**
 * Reply-to for transactional mail. Deliberately NOT CONTACT.email.
 *
 * CONTACT.email is the address we publish on the site; this is an inbox that
 * merely has to receive. paqar.my has no MX at all now, so any @paqar.my
 * reply-to hard-bounces — and a customer replying to their RM12 receipt is
 * the last person who should hit an error.
 *
 * The rule this encodes, already learned once in customer-feedback.ts: a
 * reply-to must be an inbox someone actually reads, never noreply@ and never
 * an address chosen because it looks tidy on a domain.
 */
export const SUPPORT_REPLY_TO = 'freddie.vong@yahoo.com'

export const SAME_AS = [
  SOCIAL.facebook,
  SOCIAL.instagram,
  SOCIAL.tiktok,
  GOOGLE_BUSINESS.profile,
] as const

/** wa.me requires digits only — a leading '+' or any separator breaks the link. */
export function isValidWhatsappNumber(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(value)
}

/**
 * Builds a wa.me deep link, or returns null when no number is configured.
 *
 * Returning null rather than a partial URL is the whole point: callers must
 * branch on it and render nothing, which is what stops `wa.me/null` from ever
 * reaching a page.
 */
export function whatsappUrl(message: string): string | null {
  const number = CONTACT.whatsapp
  if (!number || !isValidWhatsappNumber(number)) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

/** True when at least one contact channel actually works. */
export function hasContactChannel(): boolean {
  return whatsappUrl('') !== null || CONTACT.email !== null
}

/** E.164 (with '+') for JSON-LD telephone values — distinct from the wa.me form. */
export function telephoneE164(): string | null {
  const number = CONTACT.whatsapp
  if (!number || !isValidWhatsappNumber(number)) return null
  return `+${number}`
}

const ORG_DESCRIPTION =
  'Paqar membantu pembeli kereta terpakai Malaysia semak harga pasaran, dapatkan Laporan Pembeli, dan semak rekod claim insurans sebelum bayar deposit.'

/**
 * The shared Organization node. Spread it and add page-specific fields
 * (`areaServed`, etc.) rather than retyping the identity values:
 *
 *   { ...organizationSchema(), areaServed: { '@type': 'Country', name: 'Malaysia' } }
 *
 * A `contactPoint` is attached only when a channel genuinely works. An empty
 * or unreachable ContactPoint is worse than none — it publishes a promise the
 * business cannot keep.
 */
export function organizationSchema(): Record<string, unknown> {
  const telephone = telephoneE164()
  return {
    '@type':     'Organization',
    name:        'Paqar',
    legalName:   LEGAL_NAME,
    url:         SITE_URL,
    logo:        `${SITE_URL}/paqar-logo.png`,
    description: ORG_DESCRIPTION,
    sameAs:      [...SAME_AS],
    ...(telephone
      ? {
          contactPoint: {
            '@type':           'ContactPoint',
            contactType:       'customer support',
            telephone,
            availableLanguage: ['Malay', 'English', 'Chinese'],
          },
        }
      : {}),
  }
}

/**
 * A lightweight Organization reference, for `author`, `publisher` and
 * `provider` slots.
 *
 * Fourteen of those slots were the literal
 * `{ '@type': 'Organization', name: 'Paqar', url: 'https://paqar.my' }`,
 * retyped per page. They are references to an entity, not declarations of it,
 * so they do not need the logo, description, sameAs and contactPoint that
 * organizationSchema() carries — repeating all of that on every Article node
 * would bloat the graph without telling a consumer anything the homepage's
 * full node does not already say.
 *
 * What they DO need is the identity, which is why this exists rather than the
 * literal: `legalName` reaches all fourteen from one place, and a future
 * identity field cannot land on some of them and not others.
 */
export function organizationRef(): Record<string, string> {
  return { '@type': 'Organization', name: 'Paqar', legalName: LEGAL_NAME, url: SITE_URL }
}
