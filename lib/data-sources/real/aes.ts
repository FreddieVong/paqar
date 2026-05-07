import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class AesAdapter implements DataSourceAdapter {
  readonly sourceId = 'aes' as const
  readonly label    = 'AES Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    return callScraper('aes', { plate }, this.sourceId, this.label)
  }
}
