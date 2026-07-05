-- JomCheck add-on upgrade path: an RM12 buyer can later pay +RM88 to add the
-- accident/claim check to their existing report. The upgrade is a separate
-- Billplz bill, tracked here so the webhook can flip add_jomcheck on payment.

ALTER TABLE buyer_reports ADD COLUMN IF NOT EXISTS upgrade_bill_id TEXT;

CREATE INDEX IF NOT EXISTS idx_buyer_reports_upgrade_bill
  ON buyer_reports (upgrade_bill_id)
  WHERE upgrade_bill_id IS NOT NULL;
