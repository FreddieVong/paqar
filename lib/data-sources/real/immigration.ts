import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class ImmigrationAdapter implements DataSourceAdapter {
  readonly sourceId = 'immigration' as const
  readonly label    = 'Immigration Blacklist'

  async check(_plate: string, ic: string): Promise<SourceResult> {
    return callScraper('immigration', { ic }, this.sourceId, this.label)
  }
}
