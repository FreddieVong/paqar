-- Add lead email capture columns to checks table
-- Used for retargeting users who checked a plate but didn't pay for the report

ALTER TABLE checks ADD COLUMN IF NOT EXISTS lead_email         text;
ALTER TABLE checks ADD COLUMN IF NOT EXISTS lead_email_sent_at timestamptz;
