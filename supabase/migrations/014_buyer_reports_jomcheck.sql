ALTER TABLE buyer_reports
  ADD COLUMN add_jomcheck        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN jomcheck_status     TEXT        NOT NULL DEFAULT 'not_requested',
  ADD COLUMN jomcheck_data       JSONB,
  ADD COLUMN jomcheck_checked_at TIMESTAMPTZ,
  ADD COLUMN jomcheck_error      TEXT;

-- Valid jomcheck_status values: not_requested | pending | success | failed
