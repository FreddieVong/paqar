import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class LocalCouncilsAdapter implements DataSourceAdapter {
  readonly sourceId = 'local_councils' as const
  readonly label    = 'Majlis Tempatan'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    return callScraper('local_councils', { plate }, this.sourceId, this.label)
  }
}
