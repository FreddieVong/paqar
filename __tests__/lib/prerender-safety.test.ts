// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * Strip comments before matching. These files explain the trap in prose — the
 * words "useSearchParams()" appear precisely because they must not be CALLED,
 * and a naive grep would flag the explanation as the offence.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Components that render during a STATIC PRERENDER must not call
 * useSearchParams().
 *
 * THE BUILD FAILURE THIS EXISTS TO PREVENT
 *
 *   ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/"
 *   Export encountered errors on following paths:
 *     /page: /
 *     /laporan-pembeli-kereta-terpakai/page: /laporan-pembeli-kereta-terpakai
 *
 * It appeared the moment the homepage default flipped from the model tab to
 * the plate tab. PlateCheckerForm had always called useSearchParams(), but it
 * had never been the SERVER-rendered branch before, so the hook was only ever
 * reached on the client and the prerender never saw it.
 *
 * WHY NOT JUST WRAP IT IN SUSPENSE. That builds, but it client-renders the
 * hero input — the single element that must exist in the static HTML now that
 * organic search is the acquisition channel. Reading window.location inside
 * the submit handler costs nothing instead: the handler only runs from a real
 * click, where the query string is always available and always current.
 *
 * HomeCheckerTabs already documented this trap and used window.location for
 * exactly this reason. The guard below is what makes that reasoning survive
 * the next person who reaches for the hook.
 *
 * A local `next build` cannot backstop this — it is OOM-killed on the dev
 * machine (and on untouched origin/main too), so the remote build is the only
 * place the real error surfaces. This test is the cheap local stand-in.
 */

/** Rendered inside the statically prerendered homepage tree. */
const PRERENDERED_COMPONENTS = [
  'components/check/HomeCheckerTabs.tsx',
  'components/check/PlateCheckerForm.tsx',
  'components/check/DualCheckForm.tsx',
]

/** Pages that statically prerender the tree above. */
const PRERENDERED_PAGES = [
  'app/page.tsx',
  'app/laporan-pembeli-kereta-terpakai/page.tsx',
]

describe('statically prerendered components avoid useSearchParams', () => {
  it.each(PRERENDERED_COMPONENTS)('%s does not call useSearchParams', (path) => {
    const src = code(read(path))
    expect(src).not.toMatch(/useSearchParams\s*\(/)
    expect(src).not.toMatch(/import\s*\{[^}]*useSearchParams/)
  })

  it('PlateCheckerForm reads the query string from window instead', () => {
    const src = read('components/check/PlateCheckerForm.tsx')
    expect(src).toContain('new URLSearchParams(window.location.search)')
  })

  it('and does so inside the submit handler, where window is guaranteed', () => {
    const src = read('components/check/PlateCheckerForm.tsx')
    const handler = src.slice(src.indexOf('async function handleSubmit'))
    expect(handler).toContain('new URLSearchParams(window.location.search)')
  })

  it('HomeCheckerTabs still reads ?tab= from window, not the hook', () => {
    const src = read('components/check/HomeCheckerTabs.tsx')
    expect(src).toContain('window.location.search')
  })
})

describe('the pages that host them stay prerenderable', () => {
  it.each(PRERENDERED_PAGES)('%s declares no dynamic bailout it does not need', (path) => {
    const src = read(path)
    // force-dynamic would mask the problem by giving up static rendering for
    // the whole route — the opposite of what the organic channel needs.
    expect(src).not.toContain("export const dynamic = 'force-dynamic'")
  })

  it('the homepage keeps its ISR revalidate, so it is still statically served', () => {
    expect(read('app/page.tsx')).toMatch(/export const revalidate\s*=\s*\d+/)
  })
})

/**
 * The model-fallback link is a real tap target.
 *
 * Browser QA on the preview measured it at 335x18 — legible, but 18px tall is
 * well under the 44px minimum, and it is the ONE control that rescues a buyer
 * who has no plate. Missing it sends them away rather than to the fallback.
 *
 * Source-level, because the failure is a CSS class and jsdom does not lay out.
 * The measured proof is the browser pass on the preview deployment.
 */
describe('the model-fallback link is tappable', () => {
  it('declares a 44px minimum height on both fallback directions', () => {
    const src = read('components/check/HomeCheckerTabs.tsx')
    const matches = src.match(/min-h-\[44px\]/g) ?? []
    // Two: plate -> model, and model -> plate.
    expect(matches).toHaveLength(2)
  })

  it('centres its label so the padded box stays readable', () => {
    const src = read('components/check/HomeCheckerTabs.tsx')
    expect(src).toMatch(/inline-flex items-center justify-center/)
  })
})
