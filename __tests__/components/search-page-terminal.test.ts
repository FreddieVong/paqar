import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')

/** Comments quote the removed behaviour on purpose; strip them before matching. */
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * A Mudah results page for "Honda City 2019" yields Honda / City / 2019 from
 * the URL slug exactly as designed, finds comparables, and looks like a
 * success. The convert boundary refuses it — but only at the very end.
 *
 * Everything before that told the buyer the opposite: an amber "ini halaman
 * carian" notice AND a green "✓ Paqar boleh semak" AND an RM29 button, all on
 * screen together. A UI that shows a failure and a success for the same input
 * is worse than one that only shows the failure, because the buyer believes
 * the half that says yes.
 */
describe('a search page cannot look like a success', () => {
  const form = code(read('components/check/ListingIntakeForm.tsx'))

  it('withholds the primary action while the link is a results page', () => {
    expect(form).toMatch(/phase === 'summary' && summary && !searchPage/)
  })

  it('withholds the coverage result entirely — including the green one', () => {
    expect(form).toMatch(/phase === 'coverage' && coverage && !searchPage/)
  })

  it('names both ways out, since the buyer did nothing wrong', () => {
    expect(form).toContain('salin link itu')
    expect(form).toContain('screenshot iklan itu')
  })
})

describe('the blocking signal means what the money boundary means', () => {
  /**
   * convert lets screenshots rescue a results-page URL: the reviewer has the
   * advert, and the stale link beside it costs nothing. extract ignored them,
   * so a buyer who did exactly what the form asked was still told the link was
   * wrong — while being walked to a green success anyway.
   */
  it('extract clears searchPage once screenshots exist', () => {
    const route = code(read('app/api/listing-intake/[id]/extract/route.ts'))
    expect(route).toMatch(/searchPage:\s*searchPage && shots\.length === 0/)
  })

  it('and convert refuses only when nothing can rescue it', () => {
    const route = code(read('app/api/listing-intake/[id]/convert/route.ts'))
    expect(route).toMatch(/isSearchPage\(intake\.listing_url\)\)\s*\{[\s\S]{0,120}shots\.length === 0/)
  })
})

describe('only one message is on screen, and it is the true one', () => {
  const form = code(read('components/check/ListingIntakeForm.tsx'))

  it('the read-failure notice does not fire for a results page', () => {
    // "Kami tak dapat baca link itu — isi butiran kereta di bawah" stacked
    // above "Ini halaman carian — betulkan link itu". One said type the car
    // in, the other said don't bother.
    expect(form).toMatch(/needShots && !opaqueSource && !searchPage/)
  })

  it('the manual fields are withheld, since nothing typed there can help', () => {
    expect(form).toMatch(/\{!searchPage && \(editing \|\| \(phase === 'summary'/)
  })
})
