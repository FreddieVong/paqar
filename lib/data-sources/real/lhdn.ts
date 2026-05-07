import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class LhdnAdapter implements DataSourceAdapter {
  readonly sourceId = 'lhdn' as const
  readonly label    = 'LHDN'

  async check(_plate: string, ic: string): Promise<SourceResult> {
    return callScraper('lhdn', { ic }, this.sourceId, this.label)
  }
}
