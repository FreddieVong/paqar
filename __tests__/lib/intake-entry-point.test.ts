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
    const btn = FORM.slice(FORM.indexOf("listingUrl.trim() !== ''"))
    expect(btn).toContain('Baca iklan ini')
    expect(btn).toContain('onClick={readListingUrl}')
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
    const notice = FORM.slice(FORM.indexOf('Kami tak dapat baca'))
      .slice(0, 900)
    expect(notice).toContain('Kami tak dapat baca link itu')
    expect(notice).toContain('Kami tak dapat baca screenshot itu')
    expect(notice).toContain('shotCount')
  })

  it('promises only what the link path actually delivers', () => {
    // Any platform is accepted and stored; only Mudah is read without a human.
    // Verified live: a Carlist URL persists on listing_intake.listing_url.
    expect(FORM).toContain('Mana-mana platform')
    expect(FORM).toMatch(/Kami buka link ini sendiri semasa semak/)
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
