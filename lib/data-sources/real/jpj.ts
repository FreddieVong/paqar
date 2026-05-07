import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class JpjAdapter implements DataSourceAdapter {
  readonly sourceId = 'jpj' as const
  readonly label    = 'JPJ Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    return callScraper('jpj', { plate }, this.sourceId, this.label)
  }
}
