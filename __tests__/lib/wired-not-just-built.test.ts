import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, e)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(e)) out.push(rel)
  }
  return out
}
const SOURCES = [...walk('app'), ...walk('components'), ...walk('lib')]

/**
 * A safety module that nothing calls is worse than no module at all.
 *
 * Three shipped this way, each with a full test suite and zero call sites:
 *
 *   review-capacity     20/day ceiling enforcing nothing
 *   reviewed-overrides  reviewer corrections written on release, read by
 *                       nothing — the buyer got the uncorrected report under a
 *                       note implying a human had checked it
 *   release-validation  21 tests guarding five known failure modes, never
 *                       consulted at release
 *
 * In every case the tests passed, so the guard looked real to anyone reading
 * the suite. This checks the thing those tests could not: that something
 * outside the module and its own tests actually calls it.
 */
describe('safety modules are reachable from production code', () => {
  const REQUIRED: { module: string; symbol: string; why: string }[] = [
    { module: 'lib/release-validation.ts', symbol: 'validateForRelease',
      why: 'a report could be released with a silently changed asking price' },
    { module: 'lib/reviewed-overrides.ts', symbol: 'parseOverrides',
      why: 'reviewer corrections would never reach the buyer' },
    { module: 'lib/review-capacity.ts', symbol: 'capacityState',
      why: 'the 20/day ceiling would enforce nothing' },
    { module: 'lib/report-workflow.ts', symbol: 'isReportAccessible',
      why: 'the release gate would not gate' },
    { module: 'lib/mileage-provenance.ts', symbol: 'odometerEvidence',
      why: 'a buyer-typed number could drive a tampering claim' },
    { module: 'lib/intake-rate-limit.ts', symbol: 'mayIntake',
      why: 'intake endpoints would be unmetered' },
  ]

  it.each(REQUIRED)('$symbol is called outside its own module — else $why', ({ module, symbol }) => {
    const callers = SOURCES.filter(f => {
      if (f === module) return false
      const src = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      // A call, not merely a re-export or a type import.
      return new RegExp(`\\b${symbol}\\s*\\(`).test(src)
    })
    expect(callers, `${symbol} is defined but never called`).not.toEqual([])
  })
})
