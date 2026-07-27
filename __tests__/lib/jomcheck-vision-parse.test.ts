// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseVisionRows } from '@/lib/jomcheck/vision-parse'

describe('parseVisionRows', () => {
  it('parses a clean {rows:[...]} payload from the vision model', () => {
    const raw = JSON.stringify({
      rows: [
        { dateOfLoss: '14 Apr 2024', claimType: 'Own Damage (OD)', accidentType: 'Collision', mileage: 136086, severity: 'SEVERE' },
        { dateOfLoss: '29 Dec 2017', claimType: 'Windscreen (WS)', accidentType: 'Windscreen (WS)', mileage: 0, severity: 'NOT RELEVANT / NO SUM INSURED PROVIDED' },
      ],
    })
    const rows = parseVisionRows(raw)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      dateOfLoss: '14 Apr 2024', claimType: 'Own Damage (OD)', accidentType: 'Collision', mileage: 136086, severityRaw: 'SEVERE',
    })
    expect(rows[1]!.mileage).toBe(0)
  })

  it('tolerates markdown code fences and leading prose', () => {
    const raw = 'Here are the rows:\n```json\n{"rows":[{"claimType":"Own Damage (OD)","accidentType":"Collision","mileage":"136,086","severity":"Severe"}]}\n```'
    const rows = parseVisionRows(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.mileage).toBe(136086) // "136,086" → 136086
    expect(rows[0]!.severityRaw).toBe('Severe')
  })

  it('accepts a bare top-level array', () => {
    const raw = '[{"claimType":"Windscreen (WS)","accidentType":"Not Specified","mileage":null,"severity":null}]'
    const rows = parseVisionRows(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.mileage).toBeNull()
    expect(rows[0]!.severityRaw).toBeNull()
  })

  it('drops rows with no claim/accident type and returns [] on junk', () => {
    expect(parseVisionRows('{"rows":[{"mileage":123}]}')).toEqual([])
    expect(parseVisionRows('not json at all')).toEqual([])
    expect(parseVisionRows('')).toEqual([])
  })
})
