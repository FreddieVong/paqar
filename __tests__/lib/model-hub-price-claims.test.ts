import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Model hubs must not assert market prices in source.
 *
 * They used to ship a `priceRows` array of hand-typed min/max numbers that no
 * cohort had ever produced, under a heading claiming the figures came from
 * current market data — and repeat those same ranges inside `faqs`, which are
 * emitted as FAQPage JSON-LD for Google. Prices now come from
 * market_price_cache at render time; nothing in this file may state one.
 *
 * This is a source scan rather than a render test on purpose: the defect is
 * authored content, so it must be caught where it is written.
 */

const HUB = join(process.cwd(), 'app/harga-kereta-terpakai/[model]/page.tsx')

/** Strip line and block comments so prose ABOUT the rule cannot trip it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Everything above `type Props` — the MODELS config and its types. */
function configRegion(src: string): string {
  const end = src.indexOf('type Props')
  expect(end, 'could not locate the end of the config region').toBeGreaterThan(0)
  return src.slice(0, end)
}

const RAW    = readFileSync(HUB, 'utf-8')
const CONFIG = stripComments(configRegion(RAW))

// A Ringgit amount: RM followed by digits. The negative lookbehind keeps
// 'PDRM' (the police) from reading as a price, which it does in a buyer tip.
const RINGGIT = /(?<![A-Za-z])RM\s?\d[\d,.]*\s*k?/gi

describe('model hub config states no market prices', () => {
  it('declares no priceRows table', () => {
    expect(CONFIG).not.toMatch(/priceRows/)
    expect(CONFIG).not.toMatch(/\bmin:\s*\d/)
    expect(CONFIG).not.toMatch(/\bmax:\s*\d/)
  })

  it('contains no Ringgit amount anywhere in authored content', () => {
    const found = CONFIG.match(RINGGIT) ?? []
    expect(found, `hardcoded Ringgit amounts in the model hub config: ${found.join(', ')}`).toEqual([])
  })

  it('contains no range-shaped price claim', () => {
    // 'RM46,000 hingga RM60,000', 'RM10k–RM15k', 'RM5k - RM10k'.
    const ranges = CONFIG.match(
      /(?<![A-Za-z])RM\s?\d[\d,.]*\s*k?\s*(?:hingga|ke|sehingga|–|—|-|to)\s*RM?\s?\d/gi,
    ) ?? []
    expect(ranges, `range-shaped claims: ${ranges.join(' | ')}`).toEqual([])
  })

  it('still allows Paqar product prices outside the config region', () => {
    // Guard the guard: this test must not become a blanket ban on 'RM' in the
    // file, or a legitimate 'RM12' CTA elsewhere would be unfixable.
    expect(stripComments(RAW)).toMatch(/RM\{/)   // the live table's RM{row.min}
  })

  it('does not mention PDRM as a false positive', () => {
    // The Myvi buyer tip says 'semak saman dengan PDRM'. It must survive.
    expect(CONFIG).toMatch(/PDRM/)
  })
})
