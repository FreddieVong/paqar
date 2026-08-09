// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Brand hubs and the model index must not assert market prices in source.
 *
 * Each of these six pages carried a per-model `range: 'RM33k – RM74k'` string,
 * rendered as the row's subtitle right under the model name. Nothing ever
 * updated them, and by August 2026 every one overstated the market — most by
 * RM15k–RM25k at the ceiling:
 *
 *     Myvi   page said RM33k – RM74k    cohorts said RM25.8k – RM49.8k
 *     Saga   page said RM20k – RM48k    cohorts said RM13.0k – RM35.8k
 *     Axia   page said RM20k – RM48k    cohorts said RM11.8k – RM41.5k
 *     X50    page said RM58k – RM92k    cohorts said RM46.0k – RM77.0k
 *
 * An inflated ceiling is the worst direction for this error: it tells a buyer
 * an overpriced car is normal, on a site whose entire promise is the opposite.
 *
 * Ranges now come from getCoverageModelSpans() at render time. Same guard, same
 * reasoning, as the model-hub and comparison-page versions.
 */

const PAGES = [
  'app/harga-kereta-terpakai/page.tsx',
  'app/harga-perodua-terpakai/page.tsx',
  'app/harga-proton-terpakai/page.tsx',
  'app/harga-toyota-terpakai/page.tsx',
  'app/harga-honda-terpakai/page.tsx',
  'app/harga-nissan-terpakai/page.tsx',
]

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8')

/** Strip comments so prose ABOUT the rule (the figures above) cannot trip it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const RINGGIT = /(?<![A-Za-z])RM\s?\d[\d,.]*\s*k?/gi

describe.each(PAGES)('%s', (path) => {
  const src = stripComments(read(path))

  it('declares no range field', () => {
    expect(src).not.toMatch(/range:\s*'/)
  })

  it('states no Ringgit amount in authored content', () => {
    // Template interpolation (`RM${…}`) is the live figure and is allowed; a
    // literal amount is not.
    const literals = (src.match(RINGGIT) ?? []).filter(m => !/RM\$\{/.test(m))
    expect(literals, `hardcoded Ringgit amounts: ${literals.join(', ')}`).toEqual([])
  })

  it('reads spans through the shared helper', () => {
    expect(src).toContain('getCoverageModelSpans')
  })

  it('revalidates on the shared market-page window', () => {
    expect(src).toContain('export const revalidate = MARKET_PAGE_REVALIDATE_SECONDS')
  })

  it('is an async server component, so the read can happen at render', () => {
    expect(src).toMatch(/export default async function/)
  })
})

describe('the shared row component', () => {
  const src = stripComments(read('components/layout/BrandModelList.tsx'))

  it('takes spans as a prop rather than reading a field off the model', () => {
    expect(src).toContain('spans')
    expect(src).not.toMatch(/m\.range/)
  })

  it('renders the tag alone when a model has no span', () => {
    expect(src).toContain('span ? ')
  })
})

describe('BrandModel no longer has a place to put a price', () => {
  it('declares no range field', () => {
    const src = stripComments(read('lib/model-hubs.ts'))
    const block = src.split('export type BrandModel')[1]!.split('}')[0]!
    expect(block).not.toContain('range')
  })
})
