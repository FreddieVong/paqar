export interface Check {
  id: string
  user_id: string | null
  vehicle_id: string | null
  country: string
  status: 'pending' | 'running' | 'complete' | 'expired'
  claim_token: string | null
  idempotency_key: string | null
  /**
   * paqar_sid of the visitor who created the check. Scopes cache reuse so a
   * claim_token is never handed to a second visitor — migration 027. Null on
   * rows predating the column, and null never matches.
   */
  session_id?: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  plate_encrypted: string | null
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
  /**
   * Normalised Malaysian mobile (60XXXXXXXXX) captured at checkout, or null.
   * Optional by design (migration 026) — a required field would trade a real
   * sale for a follow-up channel. Absent on rows created before the column.
   */
  buyer_phone?:    string | null
  status:          'pending' | 'paid' | 'expired'
  billplz_bill_id: string | null
  amount_cents:       number
  asking_price_rm:    number | null
  claimed_mileage_km: number | null
  listing_url:        string | null
  vehicleapi_data:    Record<string, unknown> | null
  add_jomcheck:        boolean
  jomcheck_status:     'not_requested' | 'pending' | 'success' | 'failed'
  jomcheck_data:       Record<string, unknown> | null
  jomcheck_checked_at: string | null
  /**
   * The outstanding +RM88 upgrade bill. Both fields were used by the DB layer
   * without ever being declared here, so nothing type-checked the reuse path.
   */
  upgrade_bill_id?:    string | null
  /** Its Billplz payment URL (migration 028). Null on rows predating it. */
  upgrade_bill_url?:   string | null
  upgrade_paid_at?:    string | null
  upgrade_amount_cents?: number | null
  jomcheck_error:      string | null
  paid_at:            string | null
  // Receipt delivery (migration 026). receipt_status is null on rows that
  // predate tracking — treat that as unknown, never as sent.
  receipt_status?:     'pending' | 'sending' | 'sent' | 'failed' | null
  receipt_attempts?:   number | null
  receipt_last_error?: string | null
  receipt_sent_at?:    string | null
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
