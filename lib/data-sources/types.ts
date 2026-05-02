import type { SourceData } from '@/types/api'

export type Country  = 'MY' | 'ID' | 'TH'
export type SourceId =
  | 'pdrm' | 'jpj' | 'aes' | 'local_councils'
  | 'immigration' | 'lhdn' | 'ptptn'

/**
 * 'pending'     — pre-check state, matches DB schema
 * 'partial'     — within-source partial: the source responded but data is incomplete
 *                 (e.g. PDRM returned results for 2 of 3 states).
 *                 NOT cross-source partial — missing sources are 'unavailable' or 'timeout'.
 */
export type SourceStatus =
  | 'pending' | 'clear' | 'hit'
  | 'unavailable' | 'timeout' | 'partial' | 'error'

export interface SourceResult {
  source:       SourceId
  status:       SourceStatus
  label:        string
  data:         SourceData | null
  errorMessage: string | null
  checkedAt:    Date
}

export interface DataSourceAdapter {
  readonly sourceId: SourceId
  readonly label:    string
  /**
   * Adapters NEVER retry internally.
   * Retries are the responsibility of the API route.
   */
  check(plate: string, ic: string): Promise<SourceResult>
}
