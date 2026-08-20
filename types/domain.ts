import type { ReviewStatus, RefundStatus } from '@/lib/report-workflow'

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
  /** Null when the buyer identified the car by brand/model/year instead. */
  plate_encrypted: string | null
  /**
   * The advert the buyer is considering, pasted at intake (migration 032).
   *
   * Stored as text and NEVER parsed — a human opens it. That is what lets
   * Paqar cover Carlist and Facebook Marketplace, neither of which any scraper
   * here can reach: Carlist returns 403 behind Cloudflare, and getting past
   * that is bypassing an access control.
   *
   * NOTE: this is NOT buyer_reports.listing_url, a dormant column from
   * migration 004 that nothing has ever written. This is the source of truth.
   */
  listing_url?: string | null
  /** Free text: what the buyer is worried about. The reviewer's brief. */
  buyer_concern?: string | null
  /**
   * Car identity from intake (migration 032).
   *
   * These are what let the plate become optional: they identify the car for
   * free, so the RM0.81 provider lookup no longer has to run before payment
   * just to learn a model the buyer was already reading off an advert.
   */
  brand?: string | null
  model?: string | null
  year?:  string | null
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
  /**
   * When a human released this report to the buyer (migration 032).
   *
   * NULL means still under review, and the report page MUST withhold
   * BuyerReportContent — see mayRenderReport in lib/report-release.ts. Absent
   * on rows predating the column, which that function treats as unreleased.
   */
  released_at?:        string | null
  /** The human judgement RM29 actually buys. Rendered atop a released report. */
  reviewer_note?:      string | null
  /**
   * Workflow state (migration 032). Independent of `status`, which is payment,
   * and of `refund_status`. released_at stays authoritative for ACCESS —
   * see isReportAccessible in lib/report-workflow.
   */
  review_status?:      ReviewStatus | null
  refund_status?:      RefundStatus | null
  review_started_at?:  string | null
  refund_required_at?: string | null
  refund_completed_at?: string | null
  reviewer_id?:        string | null
  /** Reviewer decisions applied over the draft. Never overwrites evidence. */
  reviewed_overrides?: Record<string, unknown> | null
  refund_amount_cents?: number | null
  refund_reason_code?: string | null
  /** External reference proving money actually moved. Required to mark refunded. */
  refund_reference?:   string | null
  /** Audited provider re-lookups after a reviewer corrected the plate. Max 1. */
  identity_recheck_count?: number | null
  /** 1 = original RM29 decision · 2 = history-enhanced revision (migration 032). */
  revision?:    number | null
  supersedes_id?: string | null
  /** The revision the buyer reads. Exactly one per check. */
  is_current?:  boolean | null
  corrected_plate_hash?:   string | null
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
