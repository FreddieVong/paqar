import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class PtptnStub implements DataSourceAdapter {
  readonly sourceId = 'ptptn' as const
  readonly label    = 'PTPTN'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS['ptptn'] ?? 1100)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'partial') {
      return { ...base, status: 'unavailable', data: null,
        errorMessage: 'PTPTN portal is currently unavailable' }
    }
    return { ...base, status: 'clear', data: { source: 'ptptn', blacklisted: false, outstanding: null } }
  }
}
