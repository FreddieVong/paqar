-- Durable delivery state for the "laporan anda dah siap" email.
--
-- WHY
--
-- Since the RM29 product, payment and delivery are two moments: the receipt
-- goes out at payment (tracked since migration 026), and the report itself is
-- announced by a second email when a human releases it. That second email —
-- the one that actually delivers the product — was fired through waitUntil and
-- recorded nowhere. Success left no trace; failure left one console line in a
-- platform log.
--
-- Found on 2026-09-12: a real buyer, receipt_status = 'sent', and a Resend
-- dashboard showing no email at all for fifteen days. The question "did the
-- customer get their report?" could not be answered from the database.
--
-- Same design as 026, for the same reasons:
--
--  - NULL status, NO DEFAULT. NULL means "predates tracking / unknown", which
--    is honest. A DEFAULT 'sent' would forge history for exactly the rows this
--    was written to investigate.
--  - No attempts counter and no 'sending' state: the release is already
--    guarded by the transition log's unique index, so exactly one attempt is
--    made per release. There is nothing to claim.
--  - The provider's message id IS stored. It opens nothing and identifies the
--    email in the Resend dashboard, which is where "was it delivered?" is
--    finally answered.

ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS ready_email_status      TEXT,
  ADD COLUMN IF NOT EXISTS ready_email_kind        TEXT,
  ADD COLUMN IF NOT EXISTS ready_email_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS ready_email_last_error  TEXT,
  ADD COLUMN IF NOT EXISTS ready_email_sent_at     TIMESTAMPTZ;

COMMENT ON COLUMN buyer_reports.ready_email_status IS
  'Release email delivery state: sent | failed. NULL = released before tracking (2026-09-12) or not yet released; treat as unknown, never as sent.';

COMMENT ON COLUMN buyer_reports.ready_email_kind IS
  'Which release the latest attempt was for: first (the report) or history (the accident/claim revision).';

COMMENT ON COLUMN buyer_reports.ready_email_provider_id IS
  'Resend message id of the last successful send. Not a credential — it identifies the email in the provider dashboard.';

COMMENT ON COLUMN buyer_reports.ready_email_last_error IS
  'Short, safe reason for the last failure (missing_claim_token, resend_api_key_missing, or the provider error class). NEVER contains the claim token, the recipient address or provider credentials.';

COMMENT ON COLUMN buyer_reports.ready_email_sent_at IS
  'When the release email was last successfully handed to the provider.';

-- The operational view: released reports whose delivery email did not land.
CREATE INDEX IF NOT EXISTS idx_buyer_reports_ready_email_followup
  ON buyer_reports (ready_email_status, released_at DESC)
  WHERE status = 'paid' AND released_at IS NOT NULL;
