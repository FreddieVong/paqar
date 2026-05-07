import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class PdrmAdapter implements DataSourceAdapter {
  readonly sourceId = 'pdrm' as const
  readonly label    = 'PDRM Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    return callScraper('pdrm', { plate }, this.sourceId, this.label)
  }
}
