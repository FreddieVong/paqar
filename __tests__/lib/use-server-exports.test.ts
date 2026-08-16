// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A `'use server'` module may export ONLY async functions.
 *
 * This is not a style rule. Every export of such a module becomes a callable
 * server endpoint, so Next refuses to build when one is not a function — a
 * non-function export would either be silently unreachable or expose something
 * that was never meant to cross the boundary.
 *
 * It is pinned here because `tsc --noEmit` and `next lint` BOTH PASS on the
 * violation. The offer gate carried an exported message constant in its
 * `_actions.ts` for four commits and only failed at `next build`, which is the
 * slowest gate and the easiest one to skip. This test moves that failure to the
 * fastest gate.
 */

const ROOT = join(__dirname, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const serverModules = walk(join(ROOT, 'app'))
  .concat(walk(join(ROOT, 'lib')), walk(join(ROOT, 'components')))
  .map(path => ({ path, src: readFileSync(path, 'utf8') }))
  .filter(({ src }) => /^\s*['"]use server['"]/.test(src))

describe("'use server' modules", () => {
  it('exist — otherwise this suite is silently vacuous', () => {
    expect(serverModules.length).toBeGreaterThan(0)
  })

  it.each(serverModules.map(m => m.path.slice(ROOT.length + 1)))(
    '%s exports no const, let, var or class',
    (rel) => {
      const src = serverModules.find(m => m.path.endsWith(rel))!.src
      const offenders = [...src.matchAll(/^export\s+(const|let|var|class)\s+(\w+)/gm)]
        .map(m => `${m[1]} ${m[2]}`)
      expect(offenders, `move these out of the "use server" module: ${offenders.join(', ')}`)
        .toEqual([])
    },
  )

  it.each(serverModules.map(m => m.path.slice(ROOT.length + 1)))(
    '%s exports only async functions',
    (rel) => {
      const src = serverModules.find(m => m.path.endsWith(rel))!.src
      const sync = [...src.matchAll(/^export\s+function\s+(\w+)/gm)].map(m => m[1])
      expect(sync, `these must be async: ${sync.join(', ')}`).toEqual([])
    },
  )
})
