import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class PdrmStub implements DataSourceAdapter {
  readonly sourceId = 'pdrm' as const
  readonly label    = 'PDRM Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['pdrm'] ?? 200)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'worst') {
      return { ...base, status: 'hit', data: { source: 'pdrm', samans: [{
        offence: 'Melebihi had laju', date: '2026-01-10', amount: 300,
        currency: 'MYR', location: 'Lebuhraya PLUS KL-Ipoh', discounted: 150, paymentUrl: null,
      }] } }
    }
    return { ...base, status: 'clear', data: { source: 'pdrm', samans: [] } }
  }
}
