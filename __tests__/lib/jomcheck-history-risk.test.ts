// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ env: { JOMCHECK_MODE: 'manual' } }))

import {
  assessHistoryRisk,
  buildIncidents,
  buildResultFromIncidents,
  type JomCheckResult,
  type JomCheckIncident,
  type RawClaimRow,
} from '@/lib/jomcheck'

function incident(overrides: Partial<JomCheckIncident>): JomCheckIncident {
  return {
    dateOfLoss: '2023-01-01', type: 'accident', accidentType: 'Collision',
    mileageAtClaim: null, severity: null, constructiveTotalLoss: false, ...overrides,
  }
}

function resultFrom(incidents: JomCheckIncident[]): JomCheckResult {
  return buildResultFromIncidents('ABC123', incidents)
}

// The real WPH925 report: severe collision + OD-CTL, recorded at 136,086 km.
const WPH925_ROWS: RawClaimRow[] = [
  { dateOfLoss: '14 Apr 2024', claimType: 'Own Damage (OD)',                               accidentType: 'Collision', mileage: 136086, severityRaw: 'SEVERE' },
  { dateOfLoss: '14 Apr 2024', claimType: 'Own Damage - Constructive Total Loss (OD-CTL)', accidentType: 'Collision', mileage: 136086, severityRaw: 'SEVERE' },
]

describe('assessHistoryRisk', () => {
  it('elevates a constructive-total-loss finding as "rosak teruk"', () => {
    const result = buildResultFromIncidents('WPH925', buildIncidents(WPH925_ROWS))
    const risk = assessHistoryRisk(result, null)
    expect(risk.severe).toBe(true)
    expect(risk.headline).toBe('Kereta ini pernah rosak teruk')
    expect(risk.reasons.some(r => /total loss/i.test(r))).toBe(true)
  })

  it('adds a rollback reason when current odometer is below a claim mileage', () => {
    const result = buildResultFromIncidents('WPH925', buildIncidents(WPH925_ROWS))
    const risk = assessHistoryRisk(result, 100_000) // < 136,086
    expect(risk.severe).toBe(true)
    expect(risk.reasons.some(r => /dipusing/i.test(r))).toBe(true)
    expect(risk.reasons.some(r => r.includes('136,086'))).toBe(true)
  })

  it('flags a total_loss category even without per-incident detail', () => {
    const result = resultFrom([incident({ type: 'total_loss', accidentType: null })])
    const risk = assessHistoryRisk(result, null)
    expect(risk.severe).toBe(true)
    expect(risk.headline).toBe('Kereta ini pernah rosak teruk')
  })

  it('elevates a SEVERE-band accident as "accident teruk"', () => {
    const result = resultFrom([incident({ severity: 'severe', mileageAtClaim: 80_000 })])
    const risk = assessHistoryRisk(result, 90_000) // above claim → no rollback
    expect(risk.severe).toBe(true)
    expect(risk.headline).toBe('Kereta ini pernah accident teruk')
  })

  it('elevates rollback alone (meter dipusing) when nothing else is severe', () => {
    const result = resultFrom([incident({ severity: 'low', mileageAtClaim: 95_000 })])
    const risk = assessHistoryRisk(result, 78_000) // < 95,000 → rollback
    expect(risk.severe).toBe(true)
    expect(risk.headline).toBe('Meter kereta ini mungkin dipusing balik')
  })

  it('does NOT elevate a merely "high" (non-severe) claim with no rollback', () => {
    const result = resultFrom([incident({ severity: 'high', mileageAtClaim: 60_000 })])
    const risk = assessHistoryRisk(result, 90_000) // above claim → no rollback
    expect(risk.severe).toBe(false)
    expect(risk.headline).toBe('')
  })

  it('does NOT elevate a windscreen-only history', () => {
    const result = resultFrom([incident({ type: 'windscreen', accidentType: null })])
    expect(assessHistoryRisk(result, 50_000).severe).toBe(false)
  })

  it('is safe for a clean result and for null', () => {
    const clean = buildResultFromIncidents('ABC123', [])
    expect(assessHistoryRisk(clean, 50_000).severe).toBe(false)
    expect(assessHistoryRisk(null, 50_000).severe).toBe(false)
  })
})
