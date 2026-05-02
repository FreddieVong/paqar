import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class AesStub implements DataSourceAdapter {
  readonly sourceId = 'aes' as const
  readonly label    = 'AES Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['aes'] ?? 500)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'saman1') {
      return { ...base, status: 'hit', data: { source: 'aes', samans: [{
        offence: 'Melebihi had laju (AES Kamera)', date: '2026-02-03',
        amount: 150, currency: 'MYR', location: 'Km 42, Lebuhraya PLUS', discounted: 75, paymentUrl: null,
      }] } }
    }
    return { ...base, status: 'clear', data: { source: 'aes', samans: [] } }
  }
}
