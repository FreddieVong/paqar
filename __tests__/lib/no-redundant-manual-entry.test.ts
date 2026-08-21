import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')
const FORM = read('components/check/ListingIntakeForm.tsx')
/** Comments here explain what was REMOVED, so they name it. Strip them. */
const CODE = FORM
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * When Paqar has already read the advert, it must not ask again.
 *
 * All four defects below were reported from production within minutes of each
 * other, from one BMW listing whose model was the only field extraction could
 * not settle.
 */
describe('the form asks only for what it could not read', () => {
  it('renders brand and year independently of the model', () => {
    // They were gated on `missing('brand') || missing('model')`, so an advert
    // that gave up everything BUT its model showed three inputs — two already
    // correct — asking the buyer to confirm work Paqar had just done.
    expect(FORM).toContain("(editing || missing('brand') || missing('year'))")
    expect(FORM).toContain("{(editing || missing('brand')) && (")
    expect(FORM).toContain("{(editing || missing('year')) && (")
  })

  it('has one primary action, not a save step in front of it', () => {
    // "Simpan butiran" then "Semak kereta ini" is two taps for one intent, and
    // the first does nothing the buyer asked for.
    expect(CODE).not.toContain('Simpan butiran')
    expect(FORM).toContain('saveThenCheck')
  })

  it('does not re-save what extraction produced', () => {
    // `brand || model || year || price` is always true after a successful
    // extraction, because extraction prefills them — every buyer paid for a
    // round trip saving Paqar's own output back to Paqar.
    expect(FORM).toContain('if (dirty && intakeId)')
    expect(CODE).not.toMatch(/const edited = brand \|\| model/)
  })

  it('checks coverage against the saved values, not stale state', () => {
    // setSummary has not landed when the next line runs, so reading state
    // would check the extracted values and ignore the buyer's correction.
    expect(FORM).toContain('await checkCoverage(saved)')
    expect(FORM).toMatch(/async function checkCoverage\(override\?: MergedListing\)/)
  })
})

describe('a step that is finished leaves the screen', () => {
  it('retires the screenshot box and the link field once the car is known', () => {
    // They stayed on screen underneath the answer they had produced — the
    // buyer had already given us the car and was still looking at an upload
    // box and a link field. Clutter on the one screen that has to be simple,
    // and an accidental second upload would restart extraction and overwrite
    // a summary that was already correct.
    expect(CODE).toContain("{(phase === 'start' || phase === 'working') && (")

    // The gate must OPEN the block that holds both inputs, not just one.
    const gate = CODE.indexOf("{(phase === 'start' || phase === 'working') && (")
    const after = CODE.slice(gate)
    expect(after.indexOf('li-shots')).toBeGreaterThan(-1)
    expect(after.indexOf('li-url')).toBeGreaterThan(after.indexOf('li-shots'))
  })

  it('still offers a correction path from the summary itself', () => {
    // Retiring the inputs is only safe because the cheaper path — fixing a
    // value rather than re-uploading — is on the summary card.
    expect(FORM).toContain('Maklumat salah? Ubah')
  })
})

describe('a missing field is never sent as the word "null"', () => {
  it('the form refuses to ask about a car it cannot name', () => {
    // String(null) is "null" — four characters, so the route's min(1) accepts
    // it. The buyer was shown "Paqar belum boleh bantu untuk BMW null 2020":
    // a refusal naming a market nobody searched.
    expect(FORM).toContain("if (q.brand == null || q.model == null || q.year == null || q.askingPrice == null)")
    expect(FORM).toContain('Lengkapkan butiran kereta dahulu.')
  })

  it('and the route refuses it too, for callers that are not this form', () => {
    const route = read('app/api/price-check/route.ts')
    expect(route).toMatch(/\['null', 'undefined', 'NaN'\]/)
    for (const junk of ['null', 'undefined', 'NaN']) {
      expect(route).toContain(`'${junk}'`)
    }
  })

  it('leaves the model free-text, so an unlisted car is not a dead end', () => {
    // MODELS_BY_BRAND is a SUGGESTION list, not a gate. The catalogue has been
    // extended so the reported BMW 8 Series now resolves on the link path too,
    // but the long tail of Malaysian used cars will always outrun any list —
    // a datalist suggests, a <select> would refuse.
    expect(FORM).toContain('list="li-models"')
    expect(FORM).toContain('<datalist id="li-models">')
    expect(FORM).not.toMatch(/<select id="li-model"/)
  })

  it('now carries the model that was missing in production', () => {
    const catalogue = read('lib/model-catalog.ts')
    expect(catalogue).toContain("'8 Series'")
  })
})
