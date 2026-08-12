// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import {
  RETIRED_CREATIVE_TAGS, ACTIVE_CREATIVE_TAGS,
  isRetiredCreativeTag, isActiveCreativeTag, activeSlots, CARLIST_INTEREST,
} from '@/lib/meta-ads/guards'

describe('retired video tags never become active graphic tags', () => {
  it('active tags are the Aug26 creative-treatment pair', () => {
    // The active pair follows ACTIVE_CAMPAIGN; it is never hard-coded apart
    // from it, so switching campaigns cannot leave the two out of step.
    expect(ACTIVE_CREATIVE_TAGS).toEqual(['creative_b_aug26', 'mudah_carousel_aug26'])
  })

  it('retires every creative from earlier campaigns, in launch order', () => {
    // creative_a/b were the videos; creative_c/d the static graphics of
    // paqar_first_paid_test; the bare carousels were Carlist vs Mudah. All are
    // history now the creative-treatment test is live.
    expect(RETIRED_CREATIVE_TAGS).toEqual([
      'creative_a', 'creative_b', 'creative_c', 'creative_d',
      'carlist_carousel', 'mudah_carousel',
    ])
  })

  it('keeps a repeated creative in two separate cohorts', () => {
    // mudah_carousel ran twice: once in Carlist vs Mudah, once in the Aug26
    // test. Same artwork, different cohort — and summing them is precisely the
    // blending defect the _aug26 suffix exists to prevent.
    expect(isRetiredCreativeTag('mudah_carousel')).toBe(true)
    expect(isActiveCreativeTag('mudah_carousel')).toBe(false)
    expect(isActiveCreativeTag('mudah_carousel_aug26')).toBe(true)
    expect(isRetiredCreativeTag('mudah_carousel_aug26')).toBe(false)
  })

  it('the two sets never overlap', () => {
    // The whole point: creative_b alone carried 192 events as a video. If a
    // graphic reused that tag the comparison would blend two creatives.
    for (const t of ACTIVE_CREATIVE_TAGS) expect(isRetiredCreativeTag(t)).toBe(false)
    for (const t of RETIRED_CREATIVE_TAGS) expect(isActiveCreativeTag(t)).toBe(false)
    const overlap = ACTIVE_CREATIVE_TAGS.filter((t) =>
      (RETIRED_CREATIVE_TAGS as readonly string[]).includes(t))
    expect(overlap).toEqual([])
  })

  it('treats unknown and null tags as neither', () => {
    for (const t of [null, undefined, '', 'creative_z']) {
      expect(isRetiredCreativeTag(t)).toBe(false)
      expect(isActiveCreativeTag(t)).toBe(false)
    }
  })
})

describe('slots are positions, tags are identities', () => {
  it('maps the two ad-id columns onto the ACTIVE tags, not creative_a/b', () => {
    // The columns are named creative_a_ad_id / creative_b_ad_id but hold
    // whichever ads are live. Conflating the column name with the tag is the
    // mistake this accessor exists to prevent.
    const [s1, s2] = activeSlots({ creative_a_ad_id: 'ad_1', creative_b_ad_id: 'ad_2' })
    expect(s1).toEqual({ slot: 1, tag: 'creative_b_aug26', adId: 'ad_1' })
    expect(s2).toEqual({ slot: 2, tag: 'mudah_carousel_aug26', adId: 'ad_2' })
  })

  it('survives an unconfigured slot without inventing a tag', () => {
    const [s1, s2] = activeSlots({ creative_a_ad_id: null, creative_b_ad_id: null })
    expect(s1.adId).toBeNull()
    expect(s2.adId).toBeNull()
    expect(s1.tag).toBe('creative_b_aug26')
  })
})

describe('Carlist targeting is a suggestion, not recent-visit targeting', () => {
  it('is identified by interest id, because Meta renames interests', () => {
    expect(CARLIST_INTEREST.id).toBe('6013492996272')
    expect(CARLIST_INTEREST.name).toBe('Carlist.my')
  })

  it('is never described as a visit, browse or retarget signal', async () => {
    // Guards against copy drift that would misrepresent an affinity audience
    // as behavioural evidence.
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    for (const f of ['lib/meta-ads/guards.ts', 'lib/meta-ads/preflight.ts']) {
      const src = await readFile(join(process.cwd(), f), 'utf8')
      const claims = src.match(/recently visited|just visited|retarget(ing)? Carlist/gi) ?? []
      // The only permitted mentions are explicit denials.
      for (const c of claims) {
        const i = src.indexOf(c)
        expect(src.slice(Math.max(0, i - 90), i + c.length).toLowerCase())
          .toMatch(/not|never|nor /)
      }
    }
  })
})
