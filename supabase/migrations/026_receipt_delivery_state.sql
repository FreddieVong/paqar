-- Durable delivery state for the purchase receipt.
--
-- WHY
--
-- The Billplz webhook called sendReceiptEmail() without awaiting it and
-- without waitUntil(), then returned. On a serverless runtime the instance can
-- be frozen the moment the response is written, so the send could be cut off
-- mid-flight and nothing anywhere would record that it happened.
--
-- That matters more than it sounds. A buyer purchases anonymously (no account
-- is required). The report is reachable only via ?claim_token=, which is not
-- persisted in their browser, and getUserBuyerReports() lists reports by
-- checks.user_id — which an anonymous check never has. So the receipt is the
-- ONLY durable copy of the access URL. Losing it silently means the customer
-- has paid and has no route back to what they bought, and Paqar cannot tell.
--
-- waitUntil() extends the function's lifetime; it does not guarantee delivery.
-- Delivery needs a state a human can see and retry, which is what this adds.
--
-- Nullable with NO DEFAULT on receipt_status, deliberately, following the
-- lesson recorded in migrations 021/022 and 025: NULL means "predates this
-- migration / unknown", which is honest. A DEFAULT 'sent' would forge history
-- for the purchases this was written to investigate, and a DEFAULT 'pending'
-- would queue every historical row for a resend.

ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS receipt_status     TEXT,
  ADD COLUMN IF NOT EXISTS receipt_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_last_error TEXT,
  ADD COLUMN IF NOT EXISTS receipt_sent_at    TIMESTAMPTZ;

COMMENT ON COLUMN buyer_reports.receipt_status IS
  'Receipt delivery state: pending | sending | sent | failed. NULL = row predates receipt tracking (2026-08-05); treat as unknown, not as sent.';

COMMENT ON COLUMN buyer_reports.receipt_attempts IS
  'Number of delivery attempts. Incremented on every attempt including retries, so a permanently failing address is visible rather than retried forever.';

COMMENT ON COLUMN buyer_reports.receipt_last_error IS
  'Short, safe reason for the last failure (e.g. missing_claim_token, or the provider error class). NEVER contains the claim token, the recipient address or provider credentials.';

COMMENT ON COLUMN buyer_reports.receipt_sent_at IS
  'When a receipt was last successfully delivered. Used together with receipt_status to make a resend idempotent.';

-- The operational queue: paid purchases whose receipt did not land.
CREATE INDEX IF NOT EXISTS idx_buyer_reports_receipt_followup
  ON buyer_reports (receipt_status, paid_at DESC)
  WHERE status = 'paid';
