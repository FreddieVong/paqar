import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')
const FORM = read('components/check/ListingIntakeForm.tsx')
const CSS  = read('app/globals.css')

/**
 * Reading a listing takes up to a minute. The buyer has to be able to tell
 * that something is happening, from where they are actually looking.
 *
 * Reported twice: first as a 13px grey line nobody noticed, then again after
 * it became a card — because the card renders BELOW the upload box, and a
 * buyer who has just dropped a screenshot is looking at the drop zone.
 */
describe('the wait is impossible to miss', () => {
  it('is brought to the buyer rather than waiting to be found', () => {
    expect(FORM).toContain('statusRef')
    const i = FORM.indexOf('if (!status) return')
    expect(FORM.slice(i, i + 200)).toContain('scrollIntoView')
  })

  it('shows motion that travels, not only a ring that turns', () => {
    // A rotating ring looks identical at second one and second forty. A bar
    // crossing the card has direction, and is legible peripherally.
    expect(FORM).toContain('paqar-indeterminate')
    expect(CSS).toContain('@keyframes paqar-indeterminate')
  })

  it('proves it is alive with a number that keeps changing', () => {
    // The one thing a spinner cannot do.
    expect(FORM).toContain('setElapsed')
    expect(FORM).toMatch(/\{elapsed\}s/)
  })

  it('claims elapsed time, never a percentage or a countdown', () => {
    // One request of unknown duration. "60%" would be invented, and a
    // countdown that overruns breaks the promise it just made.
    // Comments here explain the rule by quoting the thing it forbids, so
    // strip them before checking the rendered output.
    const code = FORM
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(code).not.toMatch(/\d+\s*%/)
    expect(CSS).toContain('NOT a percentage')
  })

  it('still states the worst case honestly', () => {
    expect(FORM).toContain('Ambil masa sehingga seminit')
  })

  it('respects reduced motion', () => {
    expect(CSS).toContain('prefers-reduced-motion')
    expect(FORM).toContain('motion-reduce:animate-none')
  })
})
