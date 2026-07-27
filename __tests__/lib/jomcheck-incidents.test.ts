// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { JOMCHECK_MODE: 'manual' } }))

import {
  parseSeverity,
  buildIncidents,
  detectMileageRollback,
  type RawClaimRow,
} from '@/lib/jomcheck'

// The exact 7 rows from the real WPH925 JomCheck report — same date of loss
// repeated across multiple claim approvals ("*Possible same incident").
const WPH925_ROWS: RawClaimRow[] = [
  { dateOfLoss: '14 Apr 2024', claimType: 'Own Damage (OD)',                                     accidentType: 'Collision',        mileage: 136086, severityRaw: 'SEVERE' },
  { dateOfLoss: '14 Apr 2024', claimType: 'Own Damage - Constructive Total Loss (OD-CTL)',       accidentType: 'Collision',        mileage: 136086, severityRaw: 'SEVERE' },
  { dateOfLoss: '14 Apr 2024', claimType: 'Own Damage (OD)',                                     accidentType: 'Own Damage (OD)',  mileage: 0,      severityRaw: 'NOT RELEVANT / NO SUM INSURED PROVIDED' },
  { dateOfLoss: '29 Dec 2017', claimType: 'Windscreen (WS)',                                     accidentType: 'Windscreen (WS)',  mileage: 0,      severityRaw: 'NOT RELEVANT / NO SUM INSURED PROVIDED' },
  { dateOfLoss: '29 Dec 2017', claimType: 'Wind Screen',                                         accidentType: 'Not Specified',    mileage: 0,      severityRaw: 'NOT RELEVANT / NO SUM INSURED PROVIDED' },
  { dateOfLoss: '03 Oct 2016', claimType: 'Windscreen (WS)',                                     accidentType: 'Windscreen (WS)',  mileage: 0,      severityRaw: 'NOT RELEVANT / NO SUM INSURED PROVIDED' },
  { dateOfLoss: '03 Oct 2016', claimType: 'Wind Screen',                                         accidentType: 'Not Specified',    mileage: 0,      severityRaw: 'NOT RELEVANT / NO SUM INSURED PROVIDED' },
]

describe('parseSeverity', () => {
  it('maps JomCheck severity bands, case-insensitive', () => {
    expect(parseSeverity('SEVERE')).toBe('severe')
    expect(parseSeverity('High')).toBe('high')
    expect(parseSeverity('medium')).toBe('medium')
    expect(parseSeverity('LOW')).toBe('low')
  })
  it('treats "no sum insured" / missing as null (not a severity)', () => {
    expect(parseSeverity('NOT RELEVANT / NO SUM INSURED PROVIDED')).toBeNull()
    expect(parseSeverity('')).toBeNull()
    expect(parseSeverity(null)).toBeNull()
  })
})

describe('buildIncidents (dedup multi-approval rows by date of loss)', () => {
  const incidents = buildIncidents(WPH925_ROWS)

  it('collapses 7 approval rows into 3 real incidents', () => {
    expect(incidents).toHaveLength(3)
  })

  it('merges the Apr-2024 collision: total-loss category, CTL flag, severe, 136,086 km', () => {
    const apr = incidents.find(i => i.dateOfLoss === '2024-04-14')!
    expect(apr.type).toBe('total_loss')
    expect(apr.constructiveTotalLoss).toBe(true)
    expect(apr.severity).toBe('severe')
    expect(apr.mileageAtClaim).toBe(136086)
    expect(apr.accidentType).toBe('Collision')
  })

  it('windscreen incidents carry no severity (no sum insured) and 0 km → null mileage', () => {
    const ws = incidents.filter(i => i.type === 'windscreen')
    expect(ws).toHaveLength(2)
    for (const w of ws) {
      expect(w.severity).toBeNull()
      expect(w.mileageAtClaim).toBeNull()
      expect(w.constructiveTotalLoss).toBe(false)
    }
  })

  it('a clean vehicle (no rows) → no incidents', () => {
    expect(buildIncidents([])).toEqual([])
  })
})

describe('detectMileageRollback', () => {
  const incidents = buildIncidents(WPH925_ROWS)

  it('flags rollback when the current odometer is below a recorded claim mileage', () => {
    const r = detectMileageRollback(incidents, 120_000) // advertised lower than the 136,086 claim
    expect(r.rolledBack).toBe(true)
    expect(r.claimMileage).toBe(136086)
  })

  it('does not flag when the odometer is at or above the highest claim mileage', () => {
    expect(detectMileageRollback(incidents, 150_000).rolledBack).toBe(false)
  })

  it('does not flag when odometer is unknown or no claim carries mileage', () => {
    expect(detectMileageRollback(incidents, null).rolledBack).toBe(false)
    expect(detectMileageRollback(buildIncidents([]), 50_000).rolledBack).toBe(false)
  })
})
