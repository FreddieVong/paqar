// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { META_GRAPH_API_VERSION: 'v25.0' } }))

import {
  VALUATION_PATHS, COMPLETABLE_PATHS, canComplete,
  LOOKUP_STATUSES, isTerminalLookupStatus, eventForLookupStatus,
  ERROR_CODES, ERROR_STAGES,
} from '@/lib/funnel-stages'
import { eventId } from '@/lib/attribution'

describe('path discrimination', () => {
  it('only the report path can complete', () => {
    expect(canComplete(VALUATION_PATHS.plateReport)).toBe(true)
    expect(canComplete(VALUATION_PATHS.modelPrice)).toBe(false)
    expect(canComplete(VALUATION_PATHS.plateCheck)).toBe(false)
    expect(COMPLETABLE_PATHS).toEqual([VALUATION_PATHS.plateReport])
  })

  it('treats a legacy row with no path as not completable rather than guessing', () => {
    expect(canComplete(null)).toBe(false)
    expect(canComplete(undefined)).toBe(false)
  })
})

describe('lookup status → event mapping', () => {
  it('never emits an event from a pending status', () => {
    // pending is not terminal: the row may still be in flight. Emitting from
    // it would report a not-yet-finished lookup as an outcome.
    expect(isTerminalLookupStatus(LOOKUP_STATUSES.pending)).toBe(false)
    expect(eventForLookupStatus(LOOKUP_STATUSES.pending)).toBeNull()
  })

  it('treats not_found as a VALID outcome, not a failure', () => {
    const m = eventForLookupStatus(LOOKUP_STATUSES.notFound)
    expect(m?.event).toBe('plate_lookup_not_found')
    expect(m?.errorCode).toBe(ERROR_CODES.vehicleNotFound)
    // Crucially NOT the technical-failure event.
    expect(m?.event).not.toBe('plate_lookup_failed')
  })

  it('reserves plate_lookup_failed for technical failures', () => {
    for (const s of [LOOKUP_STATUSES.providerTimeout, LOOKUP_STATUSES.providerError]) {
      const m = eventForLookupStatus(s)
      expect(m?.event).toBe('plate_lookup_failed')
      expect(m?.errorStage).toBe(ERROR_STAGES.plateLookup)
    }
    expect(eventForLookupStatus(LOOKUP_STATUSES.providerTimeout)?.errorCode)
      .toBe(ERROR_CODES.providerTimeout)
  })

  it('maps found to success with no error fields', () => {
    const m = eventForLookupStatus(LOOKUP_STATUSES.found)
    expect(m?.event).toBe('plate_lookup_succeeded')
    expect(m?.errorCode).toBeUndefined()
  })

  it('every terminal status other than pending is terminal', () => {
    for (const s of [LOOKUP_STATUSES.found, LOOKUP_STATUSES.notFound,
                     LOOKUP_STATUSES.providerTimeout, LOOKUP_STATUSES.providerError]) {
      expect(isTerminalLookupStatus(s)).toBe(true)
    }
  })
})

describe('journey identity in event ids', () => {
  it('collapses retries of ONE submission', () => {
    expect(eventId.plateSubmitted('sid_1', 'journey_1'))
      .toBe(eventId.plateSubmitted('sid_1', 'journey_1'))
  })

  it('keeps THREE different cars as three journeys in one session', () => {
    // The critical case: a session is not a journey. Checking three cars must
    // count three times.
    const ids = ['j1', 'j2', 'j3'].map((j) => eventId.plateSubmitted('sid_1', j))
    expect(new Set(ids).size).toBe(3)
  })

  it('emits one poll timeout per check, however many times it fires', () => {
    expect(eventId.pollTimedOut('ch_1')).toBe(eventId.pollTimedOut('ch_1'))
    expect(eventId.pollTimedOut('ch_1')).not.toBe(eventId.pollTimedOut('ch_2'))
  })

  it('separates lookup outcomes by stage so success and failure cannot collide', () => {
    const ok   = eventId.plateLookup('plate_lookup_succeeded', 'j1', 'hash1')
    const nf   = eventId.plateLookup('plate_lookup_not_found', 'j1', 'hash1')
    const fail = eventId.plateLookup('plate_lookup_failed',    'j1', 'hash1')
    expect(new Set([ok, nf, fail]).size).toBe(3)
  })

  it('re-checking the same plate in a NEW journey is a new event', () => {
    expect(eventId.plateLookup('plate_lookup_succeeded', 'j1', 'hash1'))
      .not.toBe(eventId.plateLookup('plate_lookup_succeeded', 'j2', 'hash1'))
  })
})

describe('legacy rows are never guessed into an outcome', () => {
  it('a null status is not terminal, so it emits nothing', () => {
    // Pre-021 cache rows have no recorded outcome. Defaulting them to
    // not_found would report a provider failure or an interrupted write as
    // "no such vehicle".
    expect(isTerminalLookupStatus(null)).toBe(false)
    expect(isTerminalLookupStatus(undefined)).toBe(false)
  })

  it('pending is likewise silent', () => {
    // ADD COLUMN ... DEFAULT stamped every historical row `pending`;
    // migration 022 restored them to NULL. Either way: no event.
    expect(isTerminalLookupStatus(LOOKUP_STATUSES.pending)).toBe(false)
    expect(eventForLookupStatus(LOOKUP_STATUSES.pending)).toBeNull()
  })
})
