import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class JpjStub implements DataSourceAdapter {
  readonly sourceId = 'jpj' as const
  readonly label    = 'JPJ Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['jpj'] ?? 350)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'saman1' || scenario === 'default') {
      const count  = scenario === 'saman1' ? 2 : 1
      const total  = scenario === 'saman1' ? 340 : 150
      const samans = Array.from({ length: count }, (_, i) => ({
        offence: 'Memandu melebihi had laju', date: `2026-0${i + 1}-15`,
        amount: total / count, currency: 'MYR', location: 'Jalan Duta, KL',
        discounted: (total / count) * 0.5, paymentUrl: null,
      }))
      return { ...base, status: 'hit', data: { source: 'jpj', samans } }
    }
    if (scenario === 'worst') {
      return { ...base, status: 'hit', data: { source: 'jpj', samans: [{
        offence: 'Kereta tidak insurans', date: '2025-11-20',
        amount: 500, currency: 'MYR', location: null, discounted: 250, paymentUrl: null,
      }] } }
    }
    return { ...base, status: 'clear', data: { source: 'jpj', samans: [] } }
  }
}
