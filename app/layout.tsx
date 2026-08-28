import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { BASE_REPORT_LABEL } from '@/lib/pricing'
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'
import { MetaPixelScript } from '@/components/layout/MetaPixelScript'
import { AdLandingTracker } from '@/components/layout/AdLandingTracker'

const GoogleTagScript = dynamic(() => import('@/components/layout/GoogleTagScript').then(mod => ({ default: mod.GoogleTagScript })), { ssr: false })

/**
 * ── THE TYPE SYSTEM, AND WHY IT IS THIS ONE ────────────────────────────────
 *
 * It was Plus Jakarta Sans over DM Sans: a good pairing, and the pairing
 * anyone reaches for on any project. Nothing about it said used cars, or
 * Malaysia, or a document you rely on before handing over RM55,000.
 *
 * What Paqar actually produces is a RECORD about a REGISTERED VEHICLE —
 * closer to a roadtax disc or a geran than to a dashboard. So the type comes
 * from that world:
 *
 *   Archivo        headings. A grotesque with institutional weight and a
 *                  slight condensation, so a three-line Malay headline holds
 *                  its line without shrinking. Confident rather than friendly,
 *                  which is the register of a verdict.
 *
 *   IBM Plex Sans  body. Drawn for technical documentation, which is exactly
 *                  what a claim record and a variant comparison are, and its
 *                  numerals are unusually clear at 12-13px — the size most of
 *                  Paqar's money is set in.
 *
 *   IBM Plex Mono  plates, reference codes and comparable prices. A Malaysian
 *                  number plate IS monospaced type on a white ground; setting
 *                  WXY 1234 in mono makes it read as a plate rather than as a
 *                  word. Loaded at two weights only, for the handful of places
 *                  that are genuinely data.
 *
 * Weights are trimmed to what is used. Archivo drops 400 and 500 — headings
 * here are never light — which pays for the third family rather than adding to
 * the page.
 */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700', '800'],
  display: 'swap',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  // THE TITLE NAMES THE MOMENT, NOT JUST THE TOPIC.
  //
  // It read "Paqar — Semak Harga Kereta Terpakai Malaysia", which sells PRICE
  // — what Paqar sold at RM12. The product is now the decision about one
  // advert, and the homepage says so from the headline down; the one string
  // Google shows in a result still described the old product.
  //
  // The head keyword "Semak Harga Kereta Terpakai" is kept intact and in the
  // same leading position, so nothing that ranks today loses its term. What
  // replaces "Malaysia" is the buyer's actual moment. Malaysia is the weaker
  // half to spend: a .my domain serving ms_MY content about Malaysian listings
  // signals the country several other ways, and no other page competes for it.
  //
  // 57 characters, so Google shows it whole. Matches the OG image alt text,
  // which already described the page this way.
  title: 'Paqar — Semak Harga Kereta Terpakai Sebelum Bayar Deposit',
  description: `Hantar iklan kereta terpakai yang anda nak beli. Kami beritahu apa patut anda buat sebelum bayar deposit — disemak oleh manusia, ${BASE_REPORT_LABEL}.`,
  metadataBase: new URL('https://paqar.my'),
  // NO title, description or url here — same reasoning as the canonical note
  // below, which was written for `alternates` and never applied to openGraph.
  // Next.js replaces `openGraph` wholesale when a child declares one, and
  // INHERITS it wholesale when a child does not. A url set here therefore
  // became og:url on every page that forgot, and the built output showed all
  // seven /faq/* guides telling Facebook and WhatsApp they were the homepage.
  //
  // What stays is only what is true of every page: the site name, the locale,
  // the type and a branded fallback image. Title and description now resolve
  // from each page's own, which is the correct default. Pages should use
  // lib/seo/page-metadata.ts, which emits a complete and self-consistent set.
  openGraph: {
    siteName: 'Paqar',
    locale: 'ms_MY',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Paqar — semak harga kereta terpakai sebelum bayar deposit' }],
  },
  // Twitter title/description/images intentionally omitted — Next.js falls back
  // to each page's resolved openGraph values, keeping cards page-specific.
  twitter: {
    card: 'summary_large_image',
  },
  // NO canonical here. Next.js metadata is inherited, so a canonical set in
  // the root layout silently becomes the canonical of every page that does
  // not override it — telling Google those pages are duplicates of the
  // homepage. That is exactly what happened to all 8 /faq/* pages. Each page
  // now declares its own canonical; a page that forgets simply emits none,
  // and Google self-canonicalises, which fails safe instead of deindexing.
  verification: {
    google: 'Wr8qqynVahWvYrI7-01zcZTq9Lgsznw0ZpG8G6WLp00',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-[#F8FAF7] font-body antialiased">
        <GoogleTagScript />
        <MetaPixelScript />
        <AdLandingTracker />
        {/* SKIP LINK + MAIN LANDMARK.
            There was no <main> anywhere, so a screen-reader user had no way to
            jump past the header on any page, and a keyboard user had to tab
            through the whole navigation on every navigation. Both are one
            element each.

            Visible only on focus: it must be reachable, not decorative. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-[#3D472F] focus:text-white focus:px-4 focus:py-2 focus:rounded-[10px] focus:font-heading focus:font-bold focus:text-[14px]"
        >
          Terus ke kandungan
        </a>
        {/* THE LANDMARK IS HERE; THE SKIP TARGET IS NOT.
            Shell also rendered a <main>, so every public page had two nested
            main landmarks — invalid, and it makes the landmark useless for
            navigating by region.
            The id moved to Shell rather than the landmark moving here, because
            this element wraps the page's <Nav /> too: "Terus ke kandungan"
            jumped to a point ABOVE the navigation, which is the one thing a
            skip link exists not to do. Shell's content region begins after the
            nav, which is what the link should reach. */}
        <main>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </main>
      </body>
    </html>
  )
}
