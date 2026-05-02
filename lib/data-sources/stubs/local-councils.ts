import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class LocalCouncilsStub implements DataSourceAdapter {
  readonly sourceId = 'local_councils' as const
  readonly label    = 'Local Councils'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['local_councils'] ?? 650)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const

    if (scenario === 'timeout') {
      return { ...base, status: 'timeout', data: null, errorMessage: 'Source did not respond in time' }
    }
    if (scenario === 'worst') {
      return { ...base, status: 'hit', errorMessage: null, data: {
        source: 'local_councils', council: 'DBKL', samans: [{
          offence: 'Letak kereta tanpa tiket', date: '2026-03-01',
          amount: 100, currency: 'MYR', location: 'Jalan Imbi, KL', discounted: 50, paymentUrl: null,
        }],
      } }
    }
    return { ...base, status: 'clear', data: { source: 'local_councils', council: 'DBKL', samans: [] }, errorMessage: null }
  }
}
