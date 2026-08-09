// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildComparableCohort, excludeDuplicateListings, comparableConfidence } from '@/lib/comparables'

/**
 * The same car posted twice must count once — and two different cars must never
 * be merged into one.
 *
 * WHAT THE DATA ACTUALLY SHOWED
 *
 * A Mudah URL is `mudah.my/<slug>-<listingId>.htm`. The id is per POSTING, the
 * slug is per DESCRIPTION, so a repost keeps the slug and gets a new id. That
 * makes slug-matching look like the obvious dedup key. It is catastrophically
 * wrong: across 833 production listings, 66 slug groups covering 157 listings —
 * 19% of everything — share a slug, and only TWO of those groups are the same
 * car. `2023-nissan-almera-1-0-vlt-a` alone matched five separate vehicles from
 * RM50,800 to RM75,000 with mileages from 25k to 90k.
 *
 * The rule therefore requires slug + exact price + mileage band + transmission.
 * Every fixture below is taken from production.
 */

const L = (price: number, slug: string, id: string, mileage: string, trans = 'Auto') => ({
  price,
  url:   `https://www.mudah.my/${slug}-${id}.htm`,
  title: `RM ${price.toLocaleString()}${slug}2023${trans}${mileage}UsedVerified Dealer`,
  year:  '2023',
})

const prices = (ls: { price: number }[]) => ls.map(l => l.price)

describe('a genuine repost collapses to one comparable', () => {
  it('merges the Ativa posted twice minutes apart', () => {
    // Real pair: identical slug, consecutive Mudah ids 115425139 / 115425203.
    const listings = [
      L(49_900, '29kkm-ativa-1-0-av-2023-a-perodua-full-service-r', '115425203', '15k-20k'),
      L(49_900, '29kkm-ativa-1-0-av-2023-a-perodua-full-service-r', '115425139', '15k-20k'),
      L(52_300, '2023-perodua-ativa-1-0-h-a', '115300001', '40k-45k'),
      L(57_800, '2023-perodua-ativa-1-0-av-a', '115300002', '25k-30k'),
    ]
    expect(excludeDuplicateListings(listings)).toHaveLength(3)
  })

  it('keeps the first posting, not an arbitrary one', () => {
    const first  = L(49_900, 'same-slug', '115425203', '15k-20k')
    const repost = L(49_900, 'same-slug', '115425139', '15k-20k')
    const [kept] = excludeDuplicateListings([first, repost])
    expect(kept!.url).toContain('115425203')
  })

  it('collapses three postings of one car to one', () => {
    const ls = ['1', '2', '3'].map(n => L(58_800, '2021-proton-x50-1-5-tgdi-flagship-my20-a', `11540793${n}`, '45k-50k'))
    expect(excludeDuplicateListings(ls)).toHaveLength(1)
  })
})

describe('genuinely different cars sharing a slug are NEVER merged', () => {
  it('keeps five Almeras that share the generic slug', () => {
    // The exact production group. Slug-only dedup would have deleted four
    // real cars from a cohort of fifteen.
    const slug = '2023-nissan-almera-1-0-vlt-a'
    const listings = [
      L(59_900, slug, '115100001', '25k-30k'),
      L(50_800, slug, '115100002', '85k-90k'),
      L(55_800, slug, '115100003', '70k-75k'),
      L(60_800, slug, '115100004', '25k-30k'),
      L(75_000, slug, '115100005', '70k-75k'),
    ]
    expect(excludeDuplicateListings(listings)).toHaveLength(5)
  })

  it('does not merge on price alone', () => {
    const listings = [
      L(62_800, '2022-toyota-yaris-1-5-g-my19-facelift-a', '115200001', '55k-60k'),
      L(62_800, '2022-toyota-yaris-1-5-e-facelift-a',      '115200002', '40k-45k'),
    ]
    expect(excludeDuplicateListings(listings)).toHaveLength(2)
  })

  it('does not merge on slug alone when the price differs', () => {
    const slug = '2018-honda-jazz-1-5-e-my2014-facelift-a'
    const listings = [
      L(39_500, slug, '115300001', '140k-150k'),
      L(48_000, slug, '115300002', '90k-95k'),
      L(60_000, slug, '115300003', '70k-75k'),
    ]
    expect(excludeDuplicateListings(listings)).toHaveLength(3)
  })

  it('does not merge two X50s at the same price one mileage band apart', () => {
    // Real ambiguous pair: same slug, both RM60,800, 90k-95k vs 95k-100k.
    // Could be one car relisted with updated mileage, or two cars. The rule
    // must keep both — merging a real car is the expensive mistake.
    const slug = '2022-proton-x50-tgdi-flagship-1-5l-a-f-loan'
    const listings = [L(60_800, slug, '115400001', '90k-95k'), L(60_800, slug, '115400002', '95k-100k')]
    expect(excludeDuplicateListings(listings)).toHaveLength(2)
  })

  it('does not merge across transmissions', () => {
    const slug = '2022-honda-civic-1-5-fl1'
    const listings = [
      L(139_000, slug, '115500001', '10k-15k', 'Auto'),
      L(139_000, slug, '115500002', '10k-15k', 'Manual'),
    ]
    expect(excludeDuplicateListings(listings)).toHaveLength(2)
  })
})

describe('the fingerprint declines rather than guesses', () => {
  it('keeps everything when there is no URL', () => {
    const listings = [
      { price: 45_000, title: '2023 Perodua Myvi 1.5 AV2023Auto20k-25kUsedVerified Dealer', year: '2023' },
      { price: 45_000, title: '2023 Perodua Myvi 1.5 AV2023Auto20k-25kUsedVerified Dealer', year: '2023' },
    ]
    expect(excludeDuplicateListings(listings)).toHaveLength(2)
  })

  it('keeps everything when the URL is not a Mudah listing', () => {
    const ls = [
      { price: 45_000, url: 'https://carlist.my/some-car', title: 'x2023Auto20k-25kUsed', year: '2023' },
      { price: 45_000, url: 'https://carlist.my/some-car', title: 'x2023Auto20k-25kUsed', year: '2023' },
    ]
    expect(excludeDuplicateListings(ls)).toHaveLength(2)
  })

  it('keeps both when the card format changes and mileage cannot be read', () => {
    // The guard that matters most. A degraded fingerprint of slug+price alone
    // would start merging cars that merely share a description and a price —
    // and production contains exactly that case.
    const ls = [
      { price: 60_800, url: 'https://www.mudah.my/a-slug-115400001.htm', title: 'no card metadata here', year: '2023' },
      { price: 60_800, url: 'https://www.mudah.my/a-slug-115400002.htm', title: 'no card metadata here', year: '2023' },
    ]
    expect(excludeDuplicateListings(ls)).toHaveLength(2)
  })

  it('keeps both when the transmission is missing', () => {
    const ls = [
      { price: 60_800, url: 'https://www.mudah.my/a-slug-1.htm', title: 'x202320k-25kUsed', year: '2023' },
      { price: 60_800, url: 'https://www.mudah.my/a-slug-2.htm', title: 'x202320k-25kUsed', year: '2023' },
    ]
    expect(excludeDuplicateListings(ls)).toHaveLength(2)
  })
})

describe('the pipeline applies it', () => {
  it('buildComparableCohort counts a repost once', () => {
    // Drives the pipeline, not the helper: removing the call fails here even
    // though excludeDuplicateListings still exists and its own tests pass.
    const listings = [
      L(49_900, 'same-car-slug', '115425203', '15k-20k'),
      L(49_900, 'same-car-slug', '115425139', '15k-20k'),
      L(52_300, 'other-a', '115300001', '40k-45k'),
      L(57_800, 'other-b', '115300002', '25k-30k'),
    ]
    expect(buildComparableCohort(listings, { year: '2023' }).count).toBe(3)
  })

  it('a repost cannot inflate the confidence band', () => {
    // comparableConfidence steps at 5. Four real cars plus one repost must not
    // read as five independent comparables.
    const real = [
      L(40_000, 'a', '115000001', '20k-25k'),
      L(42_000, 'b', '115000002', '30k-35k'),
      L(44_000, 'c', '115000003', '40k-45k'),
      L(46_000, 'd', '115000004', '50k-55k'),
    ]
    const withRepost = [...real, L(40_000, 'a', '115000009', '20k-25k')]

    const cohort = buildComparableCohort(withRepost, { year: '2023' })
    expect(cohort.count).toBe(4)
    expect(comparableConfidence(cohort.count)).toBe('low')
  })

  it('does not disturb a cohort with no duplicates', () => {
    const clean = [
      L(40_000, 'a', '115000001', '20k-25k'),
      L(42_000, 'b', '115000002', '30k-35k'),
      L(44_000, 'c', '115000003', '40k-45k'),
    ]
    const cohort = buildComparableCohort(clean, { year: '2023' })
    expect(cohort.count).toBe(3)
    expect(cohort.median).toBe(42_000)
  })
})
