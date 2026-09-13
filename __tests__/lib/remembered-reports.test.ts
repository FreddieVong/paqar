import { describe, it, expect } from 'vitest'
import {
  REMEMBERED_COOKIE, REMEMBERED_MAX, REMEMBERED_MAX_AGE_SECONDS,
  decodeRemembered, encodeRemembered, remember, rememberedTokenFor,
} from '@/lib/remembered-reports'

/**
 * The phone that paid remembers its report.
 *
 * A buyer paid at 05:46, never saw the e-mail (Hotmail junk, most likely),
 * came back to the site three times, tapped "Laporan Saya" at 21:18 and was
 * told to check their e-mail. Nothing on that phone knew which report was
 * theirs — the claim token lived only in the link.
 *
 * This is the codec for a cookie that changes that. It stores (checkId,
 * token) pairs the browser has already been shown in a URL; every reader
 * still validates the token against the database exactly as the URL is
 * validated, so the cookie grants nothing the link did not. It only helps the
 * device that held the link — which is the device that paid.
 */
const A = { checkId: 'ch_OsLyTdc926', token: '3f1e0b9a-2c4d-4e8f-9a1b-0c2d3e4f5a6b' }
const B = { checkId: 'ch_7U4ItAGxqg', token: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' }

describe('codec', () => {
  it('round-trips a list, newest first', () => {
    const v = encodeRemembered([A, B])
    expect(decodeRemembered(v)).toEqual([A, B])
  })

  it('stays small enough for a cookie at the cap', () => {
    const many = Array.from({ length: REMEMBERED_MAX }, (_, i) => ({ checkId: `ch_${String(i).padStart(10, 'x')}`, token: A.token }))
    expect(encodeRemembered(many).length).toBeLessThan(600)
  })

  it('ignores garbage and malformed entries rather than throwing', () => {
    expect(decodeRemembered(undefined)).toEqual([])
    expect(decodeRemembered('')).toEqual([])
    expect(decodeRemembered('not json')).toEqual([])
    expect(decodeRemembered('{"a":1}')).toEqual([])
    expect(decodeRemembered(JSON.stringify([['ch_bad', 'not-a-uuid'], ['nope', A.token], [A.checkId, A.token]]))).toEqual([A])
  })

  it('names the cookie and a lifetime long enough for a car search', () => {
    expect(REMEMBERED_COOKIE).toBe('paqar_laporan')
    expect(REMEMBERED_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 60)
  })
})

describe('remember', () => {
  it('puts the latest first and drops an older copy of the same check', () => {
    expect(remember([A, B], B)).toEqual([B, A])
  })

  it('caps the list, forgetting the oldest', () => {
    let list = [A]
    for (let i = 0; i < REMEMBERED_MAX + 2; i++) {
      list = remember(list, { checkId: `ch_${String(i).padStart(10, 'y')}`, token: B.token })
    }
    expect(list).toHaveLength(REMEMBERED_MAX)
    expect(list.some(e => e.checkId === A.checkId)).toBe(false)
  })

  it('refuses an entry that is not shaped like a check id + claim token', () => {
    expect(remember([A], { checkId: 'ch_OsLyTdc926', token: 'abc' })).toEqual([A])
    expect(remember([A], { checkId: '../etc', token: A.token })).toEqual([A])
  })
})

describe('rememberedTokenFor', () => {
  it('finds the token for a check the phone has seen', () => {
    expect(rememberedTokenFor([A, B], 'ch_7U4ItAGxqg')).toBe(B.token)
  })
  it('is null for an unknown check', () => {
    expect(rememberedTokenFor([A], 'ch_zzzzzzzzzz')).toBeNull()
  })
})
