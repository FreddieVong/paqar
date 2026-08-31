import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

/**
 * Source with comments removed.
 *
 * Four assertions in this repo have now tripped on their own explanatory
 * comments: a note describing a phrase that was REMOVED necessarily quotes it,
 * and a slice taken from the first match then lands inside the note instead of
 * the code. Stripping once, here, is cheaper than remembering per assertion —
 * and only what ships is what these tests are about.
 */
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/(^|[^:])\/\/.*$/gm, '$1')

const FORM = code(read('components/check/ListingIntakeForm.tsx'))

/**
 * The entry point fails by being SILENT, not by being wrong.
 *
 * Both defects here were found by driving the real page in a browser at
 * 390x844, and neither was visible to the type checker or to any behavioural
 * test — the code did exactly what it said, just where nobody could see it.
 */
describe('pasting a link starts something the buyer can see', () => {
  it('reads the URL on Enter, not only on blur', () => {
    // It fired on blur alone. A buyer pastes a link, presses Enter or the phone
    // keyboard's "Go", and the page sits there — the only way to start was to
    // tap some unrelated part of the page. That is the reported "when paste
    // link nothing happens", and on a phone it is most of the time.
    expect(FORM).toMatch(/onKeyDown=\{e => \{\s*if \(e\.key === 'Enter'\)/)
    expect(FORM).toContain('onBlur={readListingUrl}')
  })

  it('offers a visible button as well, because blur and Enter cannot be seen', () => {
    expect(FORM).toContain('Semak kereta ini')
  })

  /**
   * The button used to render only once the field had text. A screenshot of
   * the rendered hero showed the cost: the page whose entire job is one action
   * had no coloured control anywhere above the fold, and a first-time reader
   * had nothing telling them what the page wanted.
   *
   * Disabling it instead was worse — a large dead slab in the middle of the
   * card is indistinguishable from broken. So it is always live, and with an
   * empty field it focuses the field and says what is missing.
   */
  it('is always present and always does something', () => {
    expect(FORM, 'the button is conditional on the field having text')
      .not.toMatch(/\{listingUrl\.trim\(\) !== ''\s*&&\s*\(\s*<button/)
    const btn = FORM.slice(FORM.indexOf('ref={submitRef}'))
    expect(btn).toContain('urlRef.current?.focus()')
    expect(btn).toContain('void readListingUrl()')
  })

  it('cannot run two extractions against one intake', () => {
    // Tapping the button blurs the input first, so all three entry points can
    // fire for a single gesture.
    const fn = FORM.slice(FORM.indexOf('async function readListingUrl'))
      .slice(0, 600)
    expect(fn).toContain('reading.current')
    expect(fn).toMatch(/finally\s*\{/)
  })

  it('names the input that actually failed', () => {
    // The failure notice said "screenshot" whatever the buyer had given us, so
    // someone who pasted a link was told their screenshot could not be read.
    // ANCHORED ON THE THREE BRANCHES, not on the first occurrence of a prefix.
    // It used to slice 900 characters from the first 'Kami tak dapat baca' in
    // the file. That is positional, not semantic: adding any earlier string
    // starting with those words — as the extract-failure message briefly did on
    // 2026-08-31 — moved the window off the notice entirely and failed the test
    // for a reason it was never checking.
    const idx = (s: string) => {
      const i = FORM.indexOf(s)
      expect(i, `source does not contain ${s}`).toBeGreaterThan(-1)
      return i
    }
    const link   = idx('Kami tak dapat baca link itu')
    const shot   = idx('Kami tak dapat baca screenshot itu')
    // Same branch of the same ternary: they must sit together, whatever else
    // the file grows above them.
    expect(Math.max(link, shot) - Math.min(link, shot)).toBeLessThan(400)
    // Searched FROM the notice, not from the top of the file: shotCount is also
    // a state declaration ~19k characters earlier, and matching that one proves
    // nothing about the notice showing a count.
    const countd = FORM.indexOf('shotCount', Math.min(link, shot))
    expect(countd, 'shotCount does not appear in the failure notice').toBeGreaterThan(-1)
    expect(countd - Math.min(link, shot)).toBeLessThan(900)
  })

  it('promises only what the link path actually delivers', () => {
    // Any platform is accepted and stored; only Mudah is read without a human.
    // Verified live: a Carlist URL persists on listing_intake.listing_url.
    //
    // This used to assert a sentence — "Mana-mana platform. Kami buka link ini
    // sendiri…" — sitting above the field. It was removed: a tester said the
    // form was a wall of text he had to read before he could act, and he was
    // right. The same promise is now made by the PLACEHOLDER, which names the
    // platforms instead of describing them, and is read without effort.
    // ONLY WHAT THIS FIELD CAN READ. It named "FB Marketplace" too, and a
    // Facebook link carries no car — an opaque /item/<id>/ and nothing else.
    // Advertising a platform the field cannot serve sets up the
    // disappointment before the buyer has pasted anything.
    expect(FORM).toContain('Mudah atau Carlist')
    expect(FORM, 'the link field advertises Facebook again')
      .not.toMatch(/placeholder="[^"]*(?:FB|Facebook)/)
    // And the buyer who HAS a Facebook link is routed to the screenshot at the
    // first screen rather than after a failed paste.
    expect(FORM).toContain('Dari Facebook, atau tiada link?')

    // "A human opens it" is the half that makes ANY platform work, and it is
    // the thing an automated competitor cannot match — so it is still stated.
    // It now appears in the could-not-read notice instead of above the field:
    // that is the moment the buyer wonders whether the product just broke, and
    // an answer delivered then is worth more than a sentence read past on the
    // way in.
    expect(FORM).toMatch(/Link anda tetap disimpan dan akan dibuka oleh manusia semasa menyemak/)
  })
})

describe('the answer is brought to the buyer', () => {
  it('scrolls the summary into view when it lands', () => {
    // Reading takes up to half a minute and the summary renders BELOW the
    // upload box. Measured at 390x844: the primary CTA sat at 1065px, entirely
    // off-screen, so a buyer waited thirty seconds and was shown the same
    // upload box they started at.
    expect(FORM).toContain('summaryRef')
    expect(FORM).toMatch(/scrollIntoView\?\.\(\{[^}]*behavior: 'smooth'/)
    // Bound to the phase, so it fires for every route into the summary —
    // screenshot, link, or manual entry.
    expect(FORM).toMatch(/if \(phase !== 'summary'\) return/)
  })

  it('attaches the ref to the card that actually carries the answer', () => {
    const card = FORM.slice(FORM.indexOf("phase === 'summary' && summary && !editing"))
    expect(card.slice(0, 200)).toContain('ref={summaryRef}')
  })
})

/**
 * Freddie submitted the word "hello". Paqar spent about fifteen seconds
 * "reading the listing", asked him to type the car by hand, then sold a
 * checkout saying "Orang kami baca iklan anda sendiri".
 *
 * There was no iklan. normaliseListingUrl rejects anything that is not a URL
 * and rejects it silently, so nothing was stored — and readyForCoverage is
 * satisfied by four fields the buyer typed themselves. A reviewer would have
 * opened the queue to a car with no advert, no screenshot and no link.
 *
 * That is not a thin report. It is a false one, and no care at review time
 * repairs it: the four fields describe a MODEL, and the product sells a
 * decision about a UNIT.
 */
describe('nothing is sold without an advert', () => {
  it('refuses to convert when there is no link and no screenshot', () => {
    const convert = read('app/api/listing-intake/[id]/convert/route.ts')
    expect(convert).toMatch(/!intake\.listing_url && shots\.length === 0/)
    expect(convert).toContain('no_listing')
  })

  it('says so instead of running extraction against nothing', () => {
    const fn = FORM.slice(FORM.indexOf('async function readListingUrl')).slice(0, 900)
    expect(fn, 'plain text still reaches extraction').toContain('normaliseListingUrl(url)')
    expect(fn).toContain('Itu bukan link')
  })

  it('keeps the guard against two extractions racing', () => {
    const fn = FORM.slice(FORM.indexOf('async function readListingUrl')).slice(0, 900)
    expect(fn).toContain('reading.current')
    expect(fn).toMatch(/finally\s*\{/)
  })
})
