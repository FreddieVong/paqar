import type { Check, CheckResult } from './domain'

export type SourceData =
  | { source: 'pdrm';           samans: SamanRecord[] }
  | { source: 'jpj';            samans: SamanRecord[] }
  | { source: 'aes';            samans: SamanRecord[] }
  | { source: 'local_councils'; samans: SamanRecord[]; council: string }
  | { source: 'immigration';    blacklisted: boolean; reason: string | null }
  | { source: 'lhdn';           blacklisted: boolean }
  | { source: 'ptptn';          blacklisted: boolean; outstanding: number | null }

export interface SamanRecord {
  offence:    string
  /** ISO 8601: "2026-04-15". All adapters must normalise to this format. */
  date:       string
  amount:     number
  /** Always 'MYR' in MVP. IDR/THB supported in Year 2. */
  currency:   string
  location:   string | null
  discounted: number | null
  /** Always null in stub phase. Real URLs arrive in Phase 2. */
  paymentUrl: null
}

export interface CreateCheckRequest {
  plate: string
  ic: string
  idempotencyKey?: string
}

export interface CreateCheckResponse {
  checkId: string
  claimToken: string
}

export interface PollCheckResponse {
  check: Check
  results: CheckResult[]
}
