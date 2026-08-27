import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { MODEL_HUB_SLUGS } from '@/lib/model-hubs'
import { buildLlmsTxt } from '@/lib/seo/llms-txt'
import { GUIDE_LINKS } from '@/lib/seo/guide-links'

// Source-level guards. The defects these cover are properties of the source
// itself — a literal dead mailto, an empty href, a hub slug with no route —
// so scanning the source is the direct test, not a proxy for one. Rendering
// every page would need Supabase and the network; this does not.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'components']

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry)) out.push(full)
    }
  }
  for (const d of SCAN_DIRS) walk(join(ROOT, d))
  return out
}

/**
 * Comments are stripped before scanning. These guards are about what the app
 * renders, and several of the fixes carry comments that quote the old broken
 * markup on purpose — that documentation should not trip the guard that
 * documents it.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const FILES = sourceFiles().map(f => ({
  path: relative(ROOT, f),
  text: stripComments(readFileSync(f, 'utf8')),
}))

describe('contact routing', () => {
  it('has no clickable mailto to the unreachable hello@paqar.my', () => {
    // paqar.my has no MX record — mail to it is discarded. Seven daily ops
    // reports were lost this way before anyone noticed.
    const offenders = FILES.filter(f => f.text.includes('mailto:hello@paqar.my')).map(f => f.path)
    expect(offenders).toEqual([])
  })

  it('has no mailto at all pointing at a paqar.my address in the UI', () => {
    const offenders = FILES.filter(f => /mailto:[^"'`\s]*@paqar\.my/.test(f.text)).map(f => f.path)
    expect(offenders).toEqual([])
  })
})

describe('transactional email reply-to', () => {
  const emailFiles = readdirSync(join(ROOT, 'lib', 'email'))
    .filter(f => f.endsWith('.ts'))
    .map(f => ({ path: `lib/email/${f}`, text: stripComments(readFileSync(join(ROOT, 'lib', 'email', f), 'utf8')) }))

  it('never replies to an @paqar.my address', () => {
    // paqar.my publishes no MX at all, so any @paqar.my reply-to hard-bounces.
    // A customer replying to their RM12 receipt must not hit an error.
    const offenders = emailFiles
      .filter(f => /replyTo:\s*'[^']*@paqar\.my'/.test(f.text))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })

  it('never replies to a noreply address', () => {
    const offenders = emailFiles
      .filter(f => /replyTo:\s*'?noreply/i.test(f.text))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })

  it('routes every reply-to through the shared constant', () => {
    const withReplyTo = emailFiles.filter(f => /replyTo:/.test(f.text))
    expect(withReplyTo.length).toBeGreaterThan(0)
    for (const f of withReplyTo) {
      expect(f.text, f.path).toMatch(/replyTo:\s*(SUPPORT_REPLY_TO|REPLY_TO)\b/)
    }
  })
})

describe('link integrity', () => {
  it('has no empty href', () => {
    const offenders = FILES
      .filter(f => /href=(""|''|\{''\}|\{""\}|\{``\})/.test(f.text))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })

  it('never hardcodes a wa.me link with a missing number', () => {
    const offenders = FILES
      .filter(f => /wa\.me\/(null|undefined|\$\{undefined\})/.test(f.text))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })

  it('does not build model-hub URLs by lowercasing a make and model', () => {
    // The derivation that produced honda-hr-v, honda-civic, proton-persona
    // and toyota-yaris. Hub slugs must be stated, not computed.
    const offenders = FILES
      .filter(f => /harga-kereta-terpakai\/\$\{[^}]*toLowerCase\(\)/.test(f.text))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })
})

describe('model hub slugs in source', () => {
  const hubSlugLiterals = FILES.flatMap(f =>
    Array.from(f.text.matchAll(/hubSlug: '([^']+)'/g)).map(m => ({ path: f.path, slug: m[1]! })),
  )

  it('finds hub slugs declared in the pages', () => {
    expect(hubSlugLiterals.length).toBeGreaterThan(0)
  })

  it('only ever declares a hubSlug that has a real route', () => {
    const bad = hubSlugLiterals.filter(h => !(MODEL_HUB_SLUGS as readonly string[]).includes(h.slug))
    expect(bad).toEqual([])
  })

  it('never declares the routes that do not exist', () => {
    const invented = ['honda-civic', 'proton-persona', 'toyota-yaris', 'honda-hr-v']
    const bad = hubSlugLiterals.filter(h => invented.includes(h.slug))
    expect(bad).toEqual([])
  })

  it('maps HR-V to honda-hrv on the year pages', () => {
    const yearPage = FILES.find(f => f.path.includes('harga-model') && f.path.endsWith('page.tsx'))!
    expect(yearPage.text).toContain("hubSlug: 'honda-hrv'")
    expect(yearPage.text).not.toContain("hubSlug: 'honda-hr-v'")
  })

  it('leaves Civic, Persona and Yaris without a hub on the year pages', () => {
    const yearPage = FILES.find(f => f.path.includes('harga-model') && f.path.endsWith('page.tsx'))!
    // Each entry starts `key: {` and the hubSlug, when present, is 2 lines down.
    for (const key of ['civic', 'persona', 'yaris']) {
      const entry = yearPage.text.split(new RegExp(`^  '?${key}'?: \\{$`, 'm'))[1]!
      // Keys may be quoted ('hr-v'), so the boundary must allow quotes too.
      const untilNextEntry = entry.split(/^  '?[a-z0-9-]+'?: \{$/m)[0]!
      expect(untilNextEntry).not.toContain('hubSlug')
    }
  })
})

describe('robots rules', () => {
  const robots = readFileSync(join(ROOT, 'app', 'robots.ts'), 'utf8')

  it('no longer blocks a route that never existed', () => {
    // '/semak-saman-kereta/' was stale; the real page is /panduan-semak-saman.
    const disallowBlock = robots.split('const disallow')[1]!.split(']')[0]!
    expect(disallowBlock).not.toContain('/semak-saman-kereta/')
  })

  it('blocks admin routes at the crawl layer', () => {
    const disallowBlock = robots.split('const disallow')[1]!.split(']')[0]!
    expect(disallowBlock).toContain('/admin/')
  })

  it('keeps the real saman guide crawlable', () => {
    const disallowBlock = robots.split('const disallow')[1]!.split(']')[0]!
    expect(disallowBlock).not.toContain('/panduan-semak-saman')
  })
})

describe('llms.txt', () => {
  // Was public/llms.txt, read off disk. It is now generated from the same
  // constants the checkout bills from — see lib/seo/llms-txt.ts for why — so
  // the guard reads the generator's output rather than a file that no longer
  // exists.
  const llms = buildLlmsTxt()

  it('lists all three social profiles and the GBP profile', () => {
    expect(llms).toContain('https://www.facebook.com/paqar.my')
    expect(llms).toContain('https://www.instagram.com/paqar.my')
    expect(llms).toContain('https://www.tiktok.com/@paqar.my')
    expect(llms).toContain('https://g.page/r/CcBaaoqXP_shEBM')
  })

  it('uses the GBP profile URL, not the review deep link', () => {
    expect(llms).not.toContain('g.page/r/CcBaaoqXP_shEBM/review')
  })

  it('points the FAQ at the real /faq page, not a nonexistent anchor', () => {
    // The homepage has one id, `semak`. There has never been a #soalan-lazim.
    expect(llms).not.toContain('#soalan-lazim')
    expect(llms).toContain('https://paqar.my/faq')
  })

  it('no longer advertises the unreachable inbox', () => {
    expect(llms).not.toContain('hello@paqar.my')
  })
})

/**
 * The guides' cross-links.
 *
 * lib/seo/guide-links.ts is a hand-typed map of destinations, which is exactly
 * the shape that rots: rename a page and the recommendation stays, pointing at
 * a 404 from eight pages that a crawler is now being told to follow. Checked
 * against the routes that actually exist, the same way the hub slugs are.
 */
describe('guide cross-links', () => {
  const APP = join(ROOT, 'app')

  /** Static routes: an app/ directory holding a page.tsx, ignoring dynamic segments. */
  const staticRoutes = (): Set<string> => {
    const routes = new Set<string>(['/'])
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (!statSync(full).isDirectory()) continue
        if (entry.startsWith('[')) continue
        const path = entry.startsWith('(') ? prefix : `${prefix}/${entry}`
        if (existsSync(join(full, 'page.tsx'))) routes.add(path || '/')
        walk(full, path)
      }
    }
    walk(APP, '')
    return routes
  }

  const STATIC = staticRoutes()
  const targets = Object.values(GUIDE_LINKS).flat()

  it('points every link at a route that exists', () => {
    const dead = targets
      .map(l => l.href)
      .filter(h => !STATIC.has(h))
      // Dynamic segments: /harga-kereta-terpakai/{hub}, /varian/{model}, /bandingkan/{slug}
      .filter(h => !MODEL_HUB_SLUGS.some(s => h === `/harga-kereta-terpakai/${s}`))
      .filter(h => !h.startsWith('/varian/') && !h.startsWith('/bandingkan/'))
    expect([...new Set(dead)], `guide links with no page behind them: ${dead.join(', ')}`).toEqual([])
  })

  it('never links a guide to itself', () => {
    for (const [slug, links] of Object.entries(GUIDE_LINKS)) {
      expect(links.map(l => l.href), slug).not.toContain(`/faq/${slug}`)
    }
  })

  it('gives every link a reason a reader can act on', () => {
    // A related block that lists everything is furniture, and readers skip it.
    for (const link of targets) {
      expect(link.why.length, `${link.href} has a stub reason`).toBeGreaterThan(40)
      expect(link.title.length, `${link.href} has no title`).toBeGreaterThan(5)
    }
  })

  it('covers every guide, so none is a dead end again', () => {
    // Five of the eight had no outbound internal link at all beyond the CTA.
    const guides = readdirSync(join(APP, 'faq'), { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name)
    for (const slug of guides) {
      expect(GUIDE_LINKS[slug]?.length, `${slug} has no cross-links`).toBeGreaterThan(0)
    }
  })
})
