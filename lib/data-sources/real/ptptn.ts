import type { DataSourceAdapter, SourceResult } from '../types'
import { callScraper } from './scraper-client'

export class PtptnAdapter implements DataSourceAdapter {
  readonly sourceId = 'ptptn' as const
  readonly label    = 'PTPTN'

  async check(_plate: string, ic: string): Promise<SourceResult> {
    return callScraper('ptptn', { ic }, this.sourceId, this.label)
  }
}
