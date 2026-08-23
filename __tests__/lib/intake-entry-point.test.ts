import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')
const FORM = read('components/check/ListingIntakeForm.tsx')

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
    // Comments stripped: the note explaining why Facebook gets its OWN,
    // non-error message necessarily quotes the amber wording it replaced, and
    // an un-stripped slice lands in that comment instead of the notice.
    const visible = FORM.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const notice = visible.slice(visible.indexOf('Kami tak dapat baca')).slice(0, 900)
    expect(notice).toContain('Kami tak dapat baca link itu')
    expect(notice).toContain('Kami tak dapat baca screenshot itu')
    expect(notice).toContain('shotCount')
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
