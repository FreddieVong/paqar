import type { SourceKey } from './api'

export interface Check {
  id: string
  user_id: string | null
  vehicle_id: string | null
  country: string
  status: 'pending' | 'running' | 'complete' | 'expired'
  claim_token: string | null
  idempotency_key: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  plate_encrypted: string | null
}

export interface CheckResult {
  id: string
  check_id: string
  source: SourceKey
  status: 'pending' | 'clear' | 'hit' | 'unavailable' | 'timeout' | 'partial' | 'error'
  label: string
  data: unknown | null
  error_message: string | null
  attempt_count: number
  created_at: string
  checked_at: string | null
}

export interface Vehicle {
  id: string
  user_id: string
  plate_hash: string
  label: string | null
  country: string
  created_at: string
  updated_at: string
}

export type DocType = 'roadtax' | 'insurance' | 'driving_licence'

export interface DocumentExpiry {
  id: string
  user_id: string
  vehicle_id: string | null
  document_type: DocType
  expires_on: string   // ISO 8601 date "YYYY-MM-DD"
  created_at: string
  updated_at: string
}

export interface BuyerReport {
  id:              string
  check_id:        string
  buyer_email:     string
  status:          'pending' | 'paid' | 'expired'
  billplz_bill_id: string | null
  amount_cents:       number
  asking_price_rm:    number | null
  claimed_mileage_km: number | null
  listing_url:        string | null
  paid_at:            string | null
  created_at:         string
  updated_at:         string
}

export interface SellerTrustCard {
  id:              string
  check_id:        string
  seller_email:    string
  public_token:    string
  plate_plain:     string | null
  status:          'pending' | 'paid' | 'expired'
  billplz_bill_id: string | null
  amount_cents:    number
  paid_at:         string | null
  expires_at:      string | null
  created_at:      string
  updated_at:      string
}
