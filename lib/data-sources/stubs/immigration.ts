import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class ImmigrationStub implements DataSourceAdapter {
  readonly sourceId = 'immigration' as const
  readonly label    = 'Immigration Blacklist'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['immigration'] ?? 800)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'black') {
      return { ...base, status: 'hit', data: {
        source: 'immigration', blacklisted: true,
        reason: 'Outstanding court order — contact Immigration Dept',
      } }
    }
    return { ...base, status: 'clear', data: { source: 'immigration', blacklisted: false, reason: null } }
  }
}
