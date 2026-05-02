import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class LhdnStub implements DataSourceAdapter {
  readonly sourceId = 'lhdn' as const
  readonly label    = 'LHDN'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['lhdn'] ?? 950)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'partial' || scenario === 'worst') {
      return { ...base, status: 'unavailable', data: null,
        errorMessage: 'LHDN portal is currently unavailable' }
    }
    return { ...base, status: 'clear', data: { source: 'lhdn', blacklisted: false } }
  }
}
