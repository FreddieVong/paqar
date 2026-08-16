// @vitest-environment node
//
// Source-level invariants for page metadata.
//
// scripts/seo-check.mjs checks the BUILT output, which is the only layer that
// can see what Next.js actually resolved. This file guards the two things it
// cannot: the shape of the root layout, and the builder every page should use.
//
// THE DEFECT. Next.js merges metadata field by field at the top level, and
// `openGraph` is one field — a child that declares one REPLACES the parent's,
// and a child that declares none INHERITS the parent's wholesale. Measured on
// 2026-08-15 against 116 built pages, that produced two opposite failures
// covering every page on the site: seven /faq/* guides advertising the
// homepage's og:url, title and description as their own, and 108 pages with no
// og:locale because declaring an openGraph block erased the root's.
//
// The root layout already carried a long comment about this exact trap. It was
// written for `alternates.canonical` and never applied to `openGraph`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pageMetadata, canonicalUrl, SITE_ORIGIN } from '@/lib/seo/page-metadata'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('the root layout cannot lend a page its identity', () => {
  const layout = read('app/layout.tsx')
  const og = layout.slice(layout.indexOf('openGraph: {'), layout.indexOf('verification'))
  // The image's own `url:` is legitimate and nested; strip the images array so
  // the top-level assertions below cannot be satisfied or tripped by it.
  const ogTopLevel = og.replace(/images:\s*\[[\s\S]*?\],/, '')

  it('declares no openGraph url', () => {
    // A url here becomes og:url on every page that declares no openGraph.
    expect(ogTopLevel).not.toMatch(/\burl:\s*'/)
  })

  it('declares no openGraph title or description', () => {
    // Both are inherited wholesale by such pages, so the homepage's copy
    // became the social preview of seven guides.
    expect(ogTopLevel).not.toMatch(/\btitle:\s*'/)
    expect(ogTopLevel).not.toMatch(/\bdescription:\s*'/)
  })

  it('still supplies what IS true of every page', () => {
    expect(og).toContain("siteName: 'Paqar'")
    expect(og).toContain("locale: 'ms_MY'")
    expect(og).toContain('/api/og')
  })

  it('still declares no canonical', () => {
    // The original form of this bug, already fixed. Kept so it cannot return.
    const before = layout.slice(0, layout.indexOf('export default'))
    expect(before).not.toMatch(/alternates:\s*\{\s*canonical/)
  })
})

describe('canonicalUrl', () => {
  it('returns the bare origin for the homepage', () => {
    expect(canonicalUrl('/')).toBe(SITE_ORIGIN)
  })

  it('is absolute and trailing-slash free', () => {
    expect(canonicalUrl('/faq/roadtax-by-state')).toBe(`${SITE_ORIGIN}/faq/roadtax-by-state`)
    expect(canonicalUrl('/faq/roadtax-by-state/')).toBe(`${SITE_ORIGIN}/faq/roadtax-by-state`)
  })

  it('refuses a path that is not rooted, rather than emitting a broken URL', () => {
    expect(() => canonicalUrl('faq/x')).toThrow()
  })
})

describe('pageMetadata emits a complete, self-consistent set', () => {
  const md = pageMetadata({
    path: '/faq/roadtax-by-state',
    title: 'Harga Roadtax Ikut Negeri',
    description: 'Berapa perlu bayar.',
    type: 'article',
  })

  it('makes og:url equal the canonical', () => {
    const canonical = (md.alternates as { canonical: string }).canonical
    expect(canonical).toBe(`${SITE_ORIGIN}/faq/roadtax-by-state`)
    expect(md.openGraph?.url).toBe(canonical)
  })

  it('never lets og:url be the homepage for a sub-page', () => {
    expect(md.openGraph?.url).not.toBe(SITE_ORIGIN)
  })

  it('defaults og title and description to the page’s own', () => {
    expect(md.openGraph?.title).toBe('Harga Roadtax Ikut Negeri')
    expect(md.openGraph?.description).toBe('Berapa perlu bayar.')
  })

  it('always sets the Malay locale', () => {
    expect((md.openGraph as { locale?: string }).locale).toBe('ms_MY')
  })

  it('always supplies an absolute image with dimensions and alt text', () => {
    const images = md.openGraph?.images as Array<{ url: string; width: number; height: number; alt: string }>
    expect(images).toHaveLength(1)
    expect(images[0]!.url).toMatch(/^https:\/\/paqar\.my\//)
    expect(images[0]!.width).toBe(1200)
    expect(images[0]!.height).toBe(630)
    expect(images[0]!.alt.length).toBeGreaterThan(10)
    // Paqar's own verdict renderer, never a stock car photograph.
    expect(images[0]!.url).toContain('/api/og')
  })

  it('absolutises a relative image', () => {
    const md2 = pageMetadata({ path: '/x', title: 't', description: 'd', images: [{ url: '/custom.png' }] })
    expect((md2.openGraph?.images as Array<{ url: string }>)[0]!.url).toBe(`${SITE_ORIGIN}/custom.png`)
  })

  it('leaves an already-absolute image alone', () => {
    const md2 = pageMetadata({ path: '/x', title: 't', description: 'd', images: [{ url: 'https://cdn.example/a.png' }] })
    expect((md2.openGraph?.images as Array<{ url: string }>)[0]!.url).toBe('https://cdn.example/a.png')
  })
})

// ── Every indexable page carries a complete openGraph ───────────────────────

describe('no indexable page can inherit or erase its social identity', () => {
  // Admin pages are noindex and never shared, so they are exempt.
  const INDEXABLE_WITH_METADATA = [
    'app/page.tsx',
    'app/tentang/page.tsx',
    'app/faq/page.tsx',
    'app/faq/honda-city-buying-guide/page.tsx',
    'app/faq/honda-city-vs-toyota-vios/page.tsx',
    'app/faq/toyota-vios-buying-guide/page.tsx',
    'app/faq/roadtax-by-state/page.tsx',
    'app/faq/what-to-check-buying-used-car/page.tsx',
    'app/faq/how-to-negotiate-used-car/page.tsx',
    'app/faq/how-to-spot-flood-cars/page.tsx',
    'app/faq/best-first-car-under-30k/page.tsx',
    'app/harga-model/[slug]/page.tsx',
    'app/harga-kereta-terpakai/[model]/page.tsx',
    'app/bandingkan/[slug]/page.tsx',
    'app/varian/[model]/page.tsx',
    'app/contoh-laporan/page.tsx',
  ]

  it.each(INDEXABLE_WITH_METADATA)('%s declares its own openGraph', (path) => {
    expect(read(path)).toContain('openGraph')
  })

  it.each(INDEXABLE_WITH_METADATA)('%s declares its own og:url', (path) => {
    // The seven /faq/* guides had none, and inherited the homepage's.
    const src = read(path)
    const og = src.slice(src.indexOf('openGraph'))
    expect(og).toMatch(/\burl:\s*[`'"]|url,/)
  })

  it.each(INDEXABLE_WITH_METADATA.filter(p => p !== 'app/page.tsx'))(
    '%s sets the Malay locale',
    (path) => {
      // The homepage is the one page that may inherit the root's, because the
      // root describes the homepage.
      expect(read(path)).toContain("locale: 'ms_MY'")
    },
  )
})
