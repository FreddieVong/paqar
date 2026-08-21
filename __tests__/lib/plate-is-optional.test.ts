import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    if (e === 'node_modules' || e === '.next') continue
    const rel = join(dir, e)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(e)) out.push(rel)
  }
  return out
}

/**
 * THE PLATE IS OPTIONAL, AND EVERY BUG TODAY CAME FROM FORGETTING IT.
 *
 * Migration 032 made brand/model/year the identifier so the RM0.81 provider
 * call could move behind the paywall. Plateless is now the DEFAULT journey,
 * and code written before that keeps assuming a plate is there. In one
 * afternoon that produced, in order of damage:
 *
 *   the checkout gate resolving the offer from the plate alone and failing
 *     closed — a pay button the majority of buyers could never use, under a
 *     message telling them the report was not for sale
 *   a pre-warm calling decrypt(null) AFTER the Billplz bill existed, so the
 *     buyer was told payment failed and pressed again, minting a second bill
 *   the paid report pricing a car against every year because a null year
 *     means "no year filter"
 *   a report opening with "we could not verify the details for plate
 *     Honda City 2018" — the car's NAME where a registration number belongs
 *   the dashboard decrypting a plateless check's absent plate
 *
 * decrypt() does `ciphertext.split(':')`, so null throws rather than returning
 * null. Every call site therefore needs a presence check or a try/catch, and
 * `as string` is precisely the cast that hides the need for one from tsc.
 */
describe('no unguarded decrypt of a plate that may not exist', () => {
  const SOURCES = [...walk('app'), ...walk('lib'), ...walk('components')]

  it('every decrypt of plate_encrypted is guarded', () => {
    const offenders: string[] = []

    for (const f of SOURCES) {
      const src = read(f)
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        if (!/decrypt\([^)]*plate_encrypted/.test(line)) return
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return

        // Guarded if the same line tests the value, or a try / presence check
        // appears in the six lines above it.
        const window = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
        const guarded =
          /\?\s*decrypt|plate_encrypted\s*\?/.test(line)            // ternary on the plate
          || /try\s*\{/.test(window)                                 // wrapped
          || /if\s*\([^)]*plate_encrypted/.test(window)              // presence check, incl. ?.
          // A query that excludes null plates makes every decrypt below it
          // safe by construction — lib/db/vehicles does exactly that.
          || /not\('plate_encrypted', 'is', null\)/.test(src)
        if (!guarded) offenders.push(`${f}:${i + 1}`)
      })
    }

    expect(offenders, `unguarded decrypt(plate) at: ${offenders.join(', ')}`).toEqual([])
  })

  it('the checkout gate identifies the car without a plate', () => {
    // The one that blocked revenue outright: no plate meant 'no_vehicle', and
    // the gate fails closed.
    const gate = read('lib/server/offer-for-check.ts')
    expect(gate).toContain('resolveCarIdentity')
    expect(gate).not.toMatch(/plateEncrypted: string\n/)
  })

  it('a pre-warm cannot fail a sale that already happened', () => {
    // The bill exists by the time this runs. An optimisation that throws here
    // returns "Ralat membuat pembayaran" for a charge Billplz already created.
    const actions = read('app/laporan-pembeli/[checkId]/_actions.ts')
    const i = actions.indexOf('prewarmReportData')
    const around = actions.slice(Math.max(0, i - 700), i + 200)
    expect(around).toContain('if (row.check.plate_encrypted)')
    expect(around).toMatch(/try\s*\{/)
  })

  it('the paid report delivers its script without a plate', () => {
    // The script section required vehicleData?.make, so on the default journey
    // it vanished — while "Langkah Seterusnya" step 1 still told the buyer to
    // send the seller a negotiation script the report had never given them.
    // It is also one of the four things the paywall names.
    const report = read('components/report/BuyerReportContent.tsx')
    const i = report.indexOf('3. Skrip Rundingan')
    const guard = report.slice(i, i + 900)
    expect(guard).toContain('(vehicleData?.make || cohortBrand)')
    expect(guard).toContain('cohortBrand')
  })

  it('lets the buyer check our comparables against the market', () => {
    // The Mudah/Carlist links are how a buyer verifies the cohort themselves.
    const report = read('components/report/BuyerReportContent.tsx')
    expect(report).toContain('(vehicleData?.make || cohortBrand) && (() => {')
  })

  it('still gates the registration section on an actual plate', () => {
    // The one section that genuinely cannot be produced without one. Loosening
    // this would promise a record Paqar never looked up.
    const report = read('components/report/BuyerReportContent.tsx')
    const i = report.indexOf('4. Data Kenderaan Rasmi')
    expect(report.slice(i, i + 200)).toContain('{vehicleData?.make && (')
  })

  it('the dashboard does not adopt a plateless check as a vehicle', () => {
    // A vehicle IS its plate; there is nothing to register without one.
    expect(read('lib/db/vehicles.ts')).toContain("not('plate_encrypted', 'is', null)")
  })
})
