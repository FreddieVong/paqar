// @vitest-environment node
//
// Guards the fix for a measurement defect: ad_sessions.referrer was NULL on all
// 1,037 rows as of 2026-08-14 because the column's only writer never passed a
// value. Organic search and direct traffic were therefore indistinguishable.
//
// The attribution rules are stated in full at the top of lib/traffic-source.ts.
// Each is asserted here, and the two that matter most are the ones about what
// must NOT happen: a referrer may never reclassify tagged Meta traffic (R1),
// and a full URL may never be stored or transmitted (R4).
import { describe, it, expect } from 'vitest'
import {
  classifyTrafficSource,
  normalizeReferrer,
  referrerHost,
  type TrafficSource,
} from '@/lib/traffic-source'

const SELF = 'https://paqar.my'

// ── R1: tagged arrivals win ─────────────────────────────────────────────────

describe('R1 — a referrer never reclassifies tagged traffic', () => {
  // The load-bearing rule. The running Meta experiment reads its funnel by
  // utm_source; a referrer-driven reclassification would silently restate its
  // results without anyone editing a query.
  it('keeps utm_source arrivals paid even with a Google referrer', () => {
    expect(classifyTrafficSource({ utmSource: 'meta', referrer: 'google.com' }))
      .toBe<TrafficSource>('paid')
  })

  it('keeps fbclid arrivals paid even with a Google referrer', () => {
    expect(classifyTrafficSource({ fbclid: 'IwAR123', referrer: 'google.com.my' }))
      .toBe<TrafficSource>('paid')
  })

  it('keeps every Meta utm_source in production data paid', () => {
    // The real values in ad_sessions on 2026-08-14.
    for (const utmSource of ['meta', 'fb', 'ig', 'th']) {
      expect(classifyTrafficSource({ utmSource, referrer: 'google.com' })).toBe<TrafficSource>('paid')
    }
  })

  it('keeps a tagged arrival paid with no referrer at all', () => {
    expect(classifyTrafficSource({ utmSource: 'fb' })).toBe<TrafficSource>('paid')
  })

  it('treats an AI-tagged arrival as paid rather than re-deriving it', () => {
    // 9 sessions arrived tagged utm_source=chatgpt.com. They are already
    // attributed; reclassifying them from a referrer we never recorded would
    // change how historical sessions read.
    expect(classifyTrafficSource({ utmSource: 'chatgpt.com' })).toBe<TrafficSource>('paid')
  })
})

// ── Google organic ──────────────────────────────────────────────────────────

describe('Google organic is identified where a Google referrer exists', () => {
  it('classifies a Google referrer without UTM as organic search', () => {
    expect(classifyTrafficSource({ referrer: 'google.com' })).toBe<TrafficSource>('organic_search')
  })

  it.each([
    'google.com',
    'google.com.my',      // Google Malaysia — the market Paqar serves
    'google.co.uk',
    'google.com.sg',
    'google.co.id',
    'www.google.com',     // www is stripped before matching
  ])('recognises %s', host => {
    expect(classifyTrafficSource({ referrer: host })).toBe<TrafficSource>('organic_search')
  })

  it.each(['bing.com', 'search.yahoo.com', 'duckduckgo.com', 'ecosia.org', 'yandex.ru'])(
    'recognises %s as organic search',
    host => {
      expect(classifyTrafficSource({ referrer: host })).toBe<TrafficSource>('organic_search')
    }
  )

  it('accepts a full Google search URL too, for older bundles', () => {
    expect(classifyTrafficSource({ referrer: 'https://www.google.com/search?q=harga+myvi+2020' }))
      .toBe<TrafficSource>('organic_search')
  })
})

// ── AI assistants ───────────────────────────────────────────────────────────

describe('AI assistants are their own channel', () => {
  it.each(['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai', 'copilot.microsoft.com'])(
    'treats %s as ai_assistant',
    host => expect(classifyTrafficSource({ referrer: host })).toBe<TrafficSource>('ai_assistant')
  )

  it.each(['gemini.google.com', 'bard.google.com'])(
    'treats %s as ai_assistant, not organic_search',
    host => {
      // Ordering regression: these are google. hosts and would be swallowed by
      // the search-engine prefix if AI hosts were not tested first.
      expect(classifyTrafficSource({ referrer: host })).toBe<TrafficSource>('ai_assistant')
    }
  )
})

// ── R5: absence is not evidence ─────────────────────────────────────────────

describe('R5 — a missing referrer is direct_or_unknown, never confirmed direct', () => {
  // Browsers suppress the referrer for privacy in ordinary cases, so this
  // bucket genuinely mixes typed visits, bookmarks, suppressed search visits
  // and in-app webviews. Naming it 'direct' would assert what is not known.
  it.each([undefined, null, ''])('classifies %p as direct_or_unknown', referrer => {
    expect(classifyTrafficSource({ referrer })).toBe<TrafficSource>('direct_or_unknown')
  })

  it('classifies no referrer and no tags as direct_or_unknown', () => {
    expect(classifyTrafficSource({})).toBe<TrafficSource>('direct_or_unknown')
  })

  it('classifies an unparseable referrer as direct_or_unknown rather than throwing', () => {
    expect(classifyTrafficSource({ referrer: 'javascript:void(0)' })).toBe<TrafficSource>('direct_or_unknown')
    expect(classifyTrafficSource({ referrer: 'not a url' })).toBe<TrafficSource>('direct_or_unknown')
  })

  it('never reports a plain "direct" value', () => {
    const outcomes = new Set([
      classifyTrafficSource({}),
      classifyTrafficSource({ referrer: 'google.com' }),
      classifyTrafficSource({ referrer: 'forum.lowyat.net' }),
      classifyTrafficSource({ utmSource: 'meta' }),
    ])
    expect(outcomes.has('direct' as TrafficSource)).toBe(false)
  })
})

// ── External non-search referrers ───────────────────────────────────────────

describe('external non-search referrers are referral', () => {
  it('classifies another site as referral', () => {
    expect(classifyTrafficSource({ referrer: 'forum.lowyat.net' })).toBe<TrafficSource>('referral')
  })

  it('does not mistake a lookalike host for a search engine', () => {
    expect(classifyTrafficSource({ referrer: 'notgoogle.example' })).toBe<TrafficSource>('referral')
    expect(classifyTrafficSource({ referrer: 'google.example.com' })).toBe<TrafficSource>('referral')
  })
})

// ── R3 + R4: what leaves the browser ────────────────────────────────────────

describe('R4 — only a hostname is ever transmitted or stored', () => {
  it('reduces a search URL to its hostname, discarding the query', () => {
    // The query string is what the visitor typed. It is not needed to answer
    // the channel question, so it never leaves the browser.
    expect(normalizeReferrer('https://www.google.com/search?q=harga+myvi+2020', SELF))
      .toBe('google.com')
  })

  it('discards path, query and fragment from any referrer', () => {
    expect(normalizeReferrer('https://forum.lowyat.net/topic/123?session=abc#reply', SELF))
      .toBe('forum.lowyat.net')
  })

  it('never returns anything containing a scheme, slash, query or fragment', () => {
    for (const input of [
      'https://www.google.com/search?q=x',
      'http://example.com/a/b/c#d',
      'https://sub.domain.co.uk/path?tok=secret',
    ]) {
      const out = normalizeReferrer(input, SELF)!
      expect(out).not.toMatch(/[:/?#]/)
    }
  })

  it('stores no sensitive query parameter even if one is present', () => {
    const out = normalizeReferrer('https://mail.example.com/inbox?token=SECRET&email=a@b.c', SELF)
    expect(out).toBe('mail.example.com')
    expect(out).not.toMatch(/SECRET|a@b\.c/)
  })

  it('accepts a bare hostname unchanged', () => {
    expect(normalizeReferrer('google.com', SELF)).toBe('google.com')
    expect(normalizeReferrer('www.google.com', SELF)).toBe('google.com')
  })

  it('rejects arbitrary text rather than storing it', () => {
    expect(normalizeReferrer('not a hostname', SELF)).toBeNull()
    expect(normalizeReferrer('drop table users', SELF)).toBeNull()
  })
})

describe('R3 — same-origin referrers are dropped at the source', () => {
  it('drops an internal referrer', () => {
    expect(normalizeReferrer('https://paqar.my/harga-myvi-2020', SELF)).toBeNull()
  })

  it('drops an internal referrer regardless of www', () => {
    expect(normalizeReferrer('https://www.paqar.my/varian/honda-city', SELF)).toBeNull()
    expect(normalizeReferrer('https://paqar.my/x', 'https://www.paqar.my')).toBeNull()
  })

  it('keeps a genuine external referrer', () => {
    expect(normalizeReferrer('https://www.google.com/', SELF)).toBe('google.com')
  })

  it('returns null for empty, null and undefined', () => {
    expect(normalizeReferrer('', SELF)).toBeNull()
    expect(normalizeReferrer(null, SELF)).toBeNull()
    expect(normalizeReferrer(undefined, SELF)).toBeNull()
  })
})

describe('referrerHost', () => {
  it('lowercases and strips www', () => {
    expect(referrerHost('https://WWW.Google.COM/search?q=x')).toBe('google.com')
  })

  it('returns null for input that is neither a URL nor a hostname', () => {
    expect(referrerHost('not a url')).toBeNull()
    expect(referrerHost('localhost')).toBeNull()   // no dot — not a real referrer host
    expect(referrerHost('')).toBeNull()
    expect(referrerHost(null)).toBeNull()
  })
})
