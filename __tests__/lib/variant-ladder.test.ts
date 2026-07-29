import { describe, it, expect } from 'vitest'
import { buildVariantLadder, ladderSpreadRm } from '@/lib/variant-ladder'

describe('buildVariantLadder', () => {
  // Real 2025 Perodua Alza rows from vehicle_valuations.
  it('orders a real model cheapest-first with correct step-ups', () => {
    const ladder = buildVariantLadder([
      { variant: 'H',  wm_new_pr: 68000 },
      { variant: 'X',  wm_new_pr: 62500 },
      { variant: 'AV', wm_new_pr: 75500 },
    ])
    expect(ladder).toEqual([
      { variant: 'X',  newPriceRm: 62500, stepUpRm: null },
      { variant: 'H',  newPriceRm: 68000, stepUpRm: 5500 },
      { variant: 'AV', newPriceRm: 75500, stepUpRm: 7500 },
    ])
  })

  // Real 2025 Proton X50 rows.
  it('handles a five-rung ladder', () => {
    const ladder = buildVariantLadder([
      { variant: 'TGDI FLAGSHIP', wm_new_pr: 113300 },
      { variant: 'STANDARD',      wm_new_pr: 86300 },
      { variant: 'EXECUTIVE',     wm_new_pr: 93300 },
      { variant: 'PREMIUM',       wm_new_pr: 101800 },
    ])
    expect(ladder.map(r => r.variant)).toEqual(['STANDARD', 'EXECUTIVE', 'PREMIUM', 'TGDI FLAGSHIP'])
    expect(ladder.map(r => r.stepUpRm)).toEqual([null, 7000, 8500, 11500])
  })

  it('keeps the cheapest price when a variant appears under several NVICs', () => {
    const ladder = buildVariantLadder([
      { variant: 'X', wm_new_pr: 64000 },
      { variant: 'X', wm_new_pr: 62500 },
      { variant: 'H', wm_new_pr: 68000 },
    ])
    expect(ladder).toHaveLength(2)
    expect(ladder[0]).toEqual({ variant: 'X', newPriceRm: 62500, stepUpRm: null })
  })

  it('accepts string prices, as the DB returns numerics', () => {
    const ladder = buildVariantLadder([
      { variant: 'E', wm_new_pr: '89600' },
      { variant: 'G', wm_new_pr: '95500' },
    ])
    expect(ladder[1]).toEqual({ variant: 'G', newPriceRm: 95500, stepUpRm: 5900 })
  })

  it('drops junk rows rather than letting them fake a rung', () => {
    // The table is known to carry RM0 and near-zero rows.
    const ladder = buildVariantLadder([
      { variant: 'X',       wm_new_pr: 62500 },
      { variant: 'JUNK',    wm_new_pr: 0 },
      { variant: 'BAD',     wm_new_pr: 'not-a-number' },
      { variant: '',        wm_new_pr: 70000 },
      { variant: 'AV',      wm_new_pr: 75500 },
    ])
    expect(ladder.map(r => r.variant)).toEqual(['X', 'AV'])
  })

  // Real Perodua Myvi 2025 rows: the table lists the safety-pack SKU
  // separately, which rendered as two "G" rungs at different prices.
  it('collapses safety-pack SKUs into the trim, keeping the entry price', () => {
    const ladder = buildVariantLadder([
      { variant: 'G (WITHOUT PSDA)', wm_new_pr: 46500 },
      { variant: 'G',               wm_new_pr: 48500 },
      { variant: 'AV',              wm_new_pr: 52700 },
    ])
    expect(ladder.map(r => r.variant)).toEqual(['G', 'AV'])
    expect(ladder[0]!.newPriceRm).toBe(46500)
  })

  it('returns an empty ladder for no usable rows', () => {
    expect(buildVariantLadder([])).toEqual([])
    expect(buildVariantLadder([{ variant: 'X', wm_new_pr: 0 }])).toEqual([])
  })

  it('gives the single variant no step-up', () => {
    const ladder = buildVariantLadder([{ variant: 'ONLY', wm_new_pr: 50000 }])
    expect(ladder).toEqual([{ variant: 'ONLY', newPriceRm: 50000, stepUpRm: null }])
  })
})

describe('ladderSpreadRm', () => {
  it('reports the gap between cheapest and dearest trim', () => {
    const ladder = buildVariantLadder([
      { variant: 'X',  wm_new_pr: 62500 },
      { variant: 'H',  wm_new_pr: 68000 },
      { variant: 'AV', wm_new_pr: 75500 },
    ])
    expect(ladderSpreadRm(ladder)).toBe(13000)
  })

  it('returns null when there is nothing to compare', () => {
    expect(ladderSpreadRm([])).toBeNull()
    expect(ladderSpreadRm(buildVariantLadder([{ variant: 'ONLY', wm_new_pr: 50000 }]))).toBeNull()
  })
})
