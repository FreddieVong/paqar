import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { HISTORY_UPGRADE_OPERATIONAL } from '@/lib/pricing'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const visible = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/(^|[^:])\/\/.*$/gm, '$1')

function pages(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(join(ROOT, dir))) {
      if (['node_modules', '.next', 'admin', 'api'].includes(e)) continue
      const rel = join(dir, e)
      if (statSync(join(ROOT, rel)).isDirectory()) { walk(rel); continue }
      if (!/\.tsx?$/.test(e)) continue
      out.push({ path: rel, text: visible(read(rel)) })
    }
  }
  walk('app'); walk('components')
  return out
}

/**
 * Five surfaces described the accident/claim add-on and they disagreed with
 * each other and with the product. On the day it went live the homepage still
 * said "Paqar tidak menjual rekod tuntutan", /tentang said "belum dibuka", the
 * insurance guide said "Paqar belum membuka semakan rekod claim" — and the
 * checkout was selling it for +RM88 and taking RM117.
 *
 * A buyer who opened the About page after paying would have found Paqar
 * denying it sells the thing it had just sold them.
 *
 * Every one of those lines was written truthfully. They became false when a
 * flag moved, and nothing tied them to the flag.
 */
describe('every surface agrees about the add-on', () => {
  it('no page denies selling it while it is on sale', () => {
    if (!HISTORY_UPGRADE_OPERATIONAL) return
    const bad = pages()
      .filter(p => /tidak menjual rekod tuntutan|belum membuka semakan rekod claim/i.test(p.text))
      // A file may CONTAIN the off-state string as one arm of a conditional.
      .filter(p => !/historyAddOnSellable|historyAddOnLimitLine|historyUpgradeAvailable|JOMCHECK_ON/.test(read(p.path)))
      .map(p => p.path)
    expect(bad, `these deny selling a live product: ${bad.join(', ')}`).toEqual([])
  })

  it('no page calls it unopened while it is on sale', () => {
    if (!HISTORY_UPGRADE_OPERATIONAL) return
    const bad = pages()
      .filter(p => /belum dibuka/i.test(p.text))
      .filter(p => !/historyAddOnStatusLine|historyUpgradeAvailable|JOMCHECK_ON/.test(read(p.path)))
      .map(p => p.path)
    expect(bad, `these call a live product unopened: ${bad.join(', ')}`).toEqual([])
  })

  /**
   * The copy is derived so that switching the add-on OFF reverts every surface
   * on its own. A page that hardcodes the on-state is the same bug pointed the
   * other way, and would be found the same way — by a buyer.
   */
  it('the wording is derived, not written twice', () => {
    const copy = read('lib/history-addon-copy.ts')
    expect(copy).toContain('historyUpgradeAvailable()')
    // The price comes from the constant that bills it.
    expect(copy).toContain('JOMCHECK_UPGRADE_CENTS')
  })

  it('states the limits that a clean result could mislead someone about', () => {
    const copy = read('lib/history-addon-copy.ts')
    expect(copy).toMatch(/[Tt]idak semua kemalangan ada rekod/)
    expect(copy).toMatch(/bukan pengesahan odometer sebenar/)
    expect(copy).toMatch(/nombor plat/)
  })
})
