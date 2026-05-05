import type { Check, CheckResult } from './domain'

export type SourceData =
  | { source: 'pdrm';           samans: SamanRecord[] }
  | { source: 'jpj';            samans: SamanRecord[] }
  | { source: 'aes';            samans: SamanRecord[] }
  | { source: 'local_councils'; samans: SamanRecord[]; council: string }
  | { source: 'immigration';    blacklisted: boolean; reason: string | null }
  | { source: 'lhdn';           blacklisted: boolean }
  | { source: 'ptptn';          blacklisted: boolean; outstanding: number | null }

/** The closed set of data source identifiers. Derived from the SourceData union. */
export type SourceKey = SourceData['source']
// Resolves to: 'pdrm' | 'jpj' | 'aes' | 'local_councils' | 'immigration' | 'lhdn' | 'ptptn'

export interface SamanRecord {
  offence:    string
  /** ISO 8601: "2026-04-15". All adapters must normalise to this format. */
  date:       string
  amount:     number
  /** Always 'MYR' in MVP. IDR/THB supported in Year 2. */
  currency:   string
  location:   string | null
  discounted: number | null
  /** Payment URL. Always null in stub phase; real adapters populate in Phase 2. */
  paymentUrl: string | null
}

export type CheckMode = 'owner' | 'buyer'

export interface CreateCheckRequest {
  plate: string
  ic: string
  idempotencyKey?: string
  mode?: CheckMode
}

export interface CreateCheckResponse {
  checkId: string
  claimToken: string
}

export interface PollCheckResponse {
  check: Check
  results: CheckResult[]
}
