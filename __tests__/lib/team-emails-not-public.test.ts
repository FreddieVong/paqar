// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { TEAM_EMAILS } from '@/lib/team-emails'
import { SUPPORT_REPLY_TO } from '@/lib/site'

/**
 * The team address list must never reach a browser.
 *
 * lib/team-emails.ts exists because the list had been trapped behind
 * `server-only` (via lib/env) where operational scripts could not read it. That
 * move deliberately removed the runtime barrier, so the barrier has to be
 * replaced by a structural one — otherwise one `import` from a 'use client'
 * component silently ships five personal addresses in a public JS bundle, and
 * nothing would fail.
 *
 * `import 'server-only'` is NOT the fix here: it throws under plain Node, which
 * is exactly what broke scripts/reconcile-payments.ts and caused the extraction
 * in the first place. So this walks the real import graph instead.
 */

const ROOT = join(__dirname, '..', '..')
const SRC_DIRS = ['app', 'components', 'lib', 'hooks'].filter(d => existsSync(join(ROOT, d)))
const EXT = ['.ts', '.tsx', '.js', '.jsx']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (EXT.some(e => p.endsWith(e))) out.push(p)
  }
  return out
}

const allFiles = SRC_DIRS.flatMap(d => walk(join(ROOT, d)))

const isClientFile = (p: string) => {
  const head = readFileSync(p, 'utf-8').slice(0, 400)
  return /^\s*['"]use client['"]/m.test(head)
}

/** Resolve an import specifier to a real file, or null for packages. */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null                       // node_modules — cannot reach our lib
  for (const e of EXT) if (existsSync(base + e)) return base + e
  for (const e of EXT) if (existsSync(join(base, 'index' + e))) return join(base, 'index' + e)
  return existsSync(base) && statSync(base).isFile() ? base : null
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf-8')
  const specs: string[] = []
  const re = /(?:from|import)\s*['"]([^'"]+)['"]/g
  for (let m = re.exec(src); m; m = re.exec(src)) specs.push(m[1]!)
  return specs.map(s => resolveImport(file, s)).filter((s): s is string => s !== null)
}

/** Every file reachable from `entry`, following imports. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>()
  const stack = [entry]
  while (stack.length) {
    const cur = stack.pop()!
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const next of importsOf(cur)) if (!seen.has(next)) stack.push(next)
  }
  return seen
}

/**
 * SUPPORT_REPLY_TO is a team address AND a published support contact — it is
 * the reply-to on every customer email and is meant to be reachable. Only the
 * addresses whose exposure would be a leak are scanned for as literals. The
 * import-graph test above still covers the whole list, which is the guard that
 * actually matters: shipping the SET is what reveals who is internal.
 */
const PRIVATE_ADDRESSES = [...TEAM_EMAILS].filter(e => e !== SUPPORT_REPLY_TO)

describe('the team address list cannot reach the browser', () => {
  const TARGET = join(ROOT, 'lib', 'team-emails.ts')
  const clientEntries = allFiles.filter(isClientFile)

  it('the private-address list is not accidentally empty', () => {
    expect(PRIVATE_ADDRESSES.length).toBeGreaterThanOrEqual(4)
  })

  it('there are client components to check (the walk is not vacuous)', () => {
    expect(clientEntries.length).toBeGreaterThan(5)
  })

  it('no client component reaches lib/team-emails.ts, however indirectly', () => {
    const offenders: string[] = []
    for (const entry of clientEntries) {
      if (reachableFrom(entry).has(TARGET)) offenders.push(entry.replace(ROOT + '/', ''))
    }
    expect(offenders, 'these client components would ship the address list').toEqual([])
  })

  it('no client-reachable file contains a team address as a literal', () => {
    // Catches a copy-paste of the addresses into client code, which the import
    // walk above cannot see.
    const clientReachable = new Set<string>()
    for (const entry of clientEntries) for (const f of reachableFrom(entry)) clientReachable.add(f)

    const offenders: string[] = []
    for (const f of clientReachable) {
      const src = readFileSync(f, 'utf-8')
      if (PRIVATE_ADDRESSES.some(e => src.includes(e))) offenders.push(f.replace(ROOT + '/', ''))
    }
    expect(offenders, 'team addresses appear in client-reachable source').toEqual([])
  })

  it('the module stays dependency-free so it never drags a secret along', () => {
    const src = readFileSync(TARGET, 'utf-8')
    expect(src).not.toMatch(/^\s*import\s/m)
  })

  it('no built client bundle contains a team address', () => {
    // Belt and braces against the real artefact. Skipped when no build exists.
    const staticDir = join(ROOT, '.next', 'static')
    if (!existsSync(staticDir)) return

    // Generic addresses are excluded from the BUNDLE scan, though they stay in
    // TEAM_EMAILS where isTeamEmail() needs them: one real team purchase used
    // test@example.com, so it must still classify as internal.
    //
    // Scanning bundles for it produced a false alarm — the Sentry SDK ships a
    // doc comment containing `"contact_email": "test@example.com"`, and vendor
    // sample data is not a Paqar leak. A test that cries wolf on framework
    // strings gets muted, which is worse than not having it.
    const SCANNABLE = PRIVATE_ADDRESSES.filter(
      e => !/^(test|example|user|admin|foo|bar)@(example|test)\.(com|org|invalid)$/i.test(e),
    )
    expect(SCANNABLE.length, 'nothing distinctive left to scan for').toBeGreaterThan(0)

    const offenders: string[] = []
    for (const f of walk(staticDir)) {
      const src = readFileSync(f, 'utf-8')
      if (SCANNABLE.some(e => src.includes(e))) offenders.push(f.replace(ROOT + '/', ''))
    }
    expect(offenders, 'team addresses shipped in a public bundle').toEqual([])
  })
})
