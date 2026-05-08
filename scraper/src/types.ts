export interface SamanRecord {
  offence:    string
  date:       string   // YYYY-MM-DD
  amount:     number
  currency:   string
  location:   string | null
  discounted: number | null
  paymentUrl: string | null
}

export type ScraperStatus = 'clear' | 'hit' | 'unavailable' | 'requires_user_action'

export interface SamanResult {
  status:  ScraperStatus
  samans?: SamanRecord[]
  error?:  string
  debug?:  string   // partial HTML for selector debugging
}

export interface BlacklistResult {
  status:      ScraperStatus
  blacklisted?: boolean
  reason?:     string | null
  outstanding?: number | null
  error?:      string
  debug?:      string
}

export type ScraperResult = SamanResult | BlacklistResult
