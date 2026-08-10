// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { matchListingsByVariant } from '@/lib/comparables'

/**
 * THE MATCHER AND THE FILTER MUST AGREE ABOUT WHERE A TOKEN IS.
 *
 * variantRegex decides whether a listing mentions a badge. isLookalike decides
 * whether that mention is a conversion ("M3 BODYKIT", "AMG Bodykit"). Both need
 * the same notion of "the token appears here", and both used to carry their own
 * copy of it.
 *
 * The copies drifted twice:
 *
 *   1. variantRegex started allowing a leading hyphen so "Civic TYPE-R" would
 *      match; isLookalike did not. "2020 Honda CIVIC 1.8 S (A) TRPE-R KIT &
 *      SPORT RIM" (RM69,800, verbatim from the cache) walked past the KIT rule
 *      and took the Civic Type R median from RM199,800 to RM137,800.
 *
 *   2. isLookalike applied the SINGLE-LETTER boundary to every token, so a
 *      scraper-concatenated "C200AMG Bodykit" — which variantRegex matches —
 *      was never inspected at all.
 *
 * The invariant below is what makes a third drift a test failure rather than a
 * silent cohort corruption: for every boundary form the MATCHER accepts, the
 * FILTER must be able to see that same occurrence.
 */

const listing = (title: string) => ({
  title, price: 100_000, url: 'https://www.mudah.my/x-1.htm', year: '2020',
})
const matched = (title: string, token: string) =>
  matchListingsByVariant([listing(title)], token).length === 1

/**
 * Boundary forms, as `[label, prefix, suffix]`. A title is built as
 * `${prefix}${token}${suffix}` so the same form can be tested with and without
 * a trailing kit word.
 */
const FORMS: [string, string, string][] = [
  ['space either side',      '2020 Honda CIVIC TYPE ', ' GT'],
  ['leading hyphen',         '2020 Honda CIVIC TYPE-', ' GT'],
  ['end of string',          '2020 Honda CIVIC TYPE ', ''],
  ['digit before (multi)',   '2016 Mercedes Benz C200', ' 4MATIC'],
]

describe('every boundary the matcher accepts, the filter can inspect', () => {
  // Run the invariant for a single-letter and a multi-letter token, because
  // they take different branches of tokenBoundary.
  for (const token of ['R', 'AMG']) {
    for (const [label, prefix, suffix] of FORMS) {
      it(`token ${token}, ${label}`, () => {
        const plain = `${prefix}${token}${suffix}`
        if (!matched(plain, token)) return   // form not accepted for this token

        // The matcher sees the badge here. Therefore appending a kit word to
        // that SAME occurrence must be recognised as a lookalike and excluded.
        // If the filter used a different boundary it would not find the token,
        // would return "not a lookalike", and this would fail.
        expect(matched(`${prefix}${token} BODYKIT${suffix}`, token), 'filter missed a match the matcher made')
          .toBe(false)
      })
    }
  }

  it('the regression that started this: TRPE-R KIT', () => {
    expect(matched('Mfg Year VerifiedRM 69,8002020 Honda CIVIC 1.8 S (A) TRPE-R KIT & SPORT RIM', 'R')).toBe(false)
  })

  it('the latent twin: a concatenated multi-letter badge with a kit word', () => {
    // isLookalike applied the single-letter rule here, so the digit before
    // "AMG" hid the token from the filter while the matcher saw it fine.
    expect(matched('2016 Mercedes Benz C200AMG Bodykit', 'AMG')).toBe(false)
    expect(matched('2016 Mercedes Benz C200AMG 4MATIC',  'AMG')).toBe(true)
  })
})

describe('noise forms are rejected by the matcher, so the filter never sees them', () => {
  it.each([
    ['manual transmission', '2022 Perodua AXIA 1.0 E MY19 (M)', 'M'],
    ['service record',      'Mercedes Benz C200 1.5 AVANTGARDE (A) F.S.R.', 'R'],
    ['reverse camera',      'Kia PICANTO 1.2 EX (A)R/CAM,CARPLAY', 'R'],
    ['CSS in scraper tail', 'Perodua VIVA 1.0 (A)Verified Dealer.__m__-_R_5mp_{align-items:center;}@m', 'M'],
    ['CSS, token R',        'Perodua VIVA 1.0 (A)Verified Dealer.__m__-_R_5mp_{align-items:center;}@m', 'R'],
  ])('%s', (_l, title, token) => {
    expect(matched(title, token)).toBe(false)
  })
})

describe('the boundary rule lives in exactly one place', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'lib', 'comparables.ts'), 'utf-8')

  it('tokenBoundary is the only definition', () => {
    expect(src).toContain('function tokenBoundary(')
    // The lookbehind forms must appear once each — inside tokenBoundary.
    for (const form of ['(?<![^\\\\s-])', '(?<![A-Za-z])']) {
      const n = src.split(form).length - 1
      expect(n, `${form} should be defined once, found ${n}`).toBe(1)
    }
  })

  it('both consumers go through it', () => {
    const uses = src.split('tokenBoundary(').length - 1
    expect(uses, 'expected the definition plus a call in variantRegex and isLookalike').toBe(3)
  })

  it('token escaping is shared too', () => {
    expect(src).toContain('function escapeToken(')
    // The raw escape expression should appear only inside escapeToken.
    const n = src.split('/[.*+?^${}()|[\\]\\\\]/g').length - 1
    expect(n, `raw escape should be defined once, found ${n}`).toBe(1)
  })
})
