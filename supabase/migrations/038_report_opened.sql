-- Did the buyer open their released report?
--
-- WHY
--
-- Asked twice on 2026-09-12 about one buyer, answered both times with a
-- PostHog query. The report page knows the moment it renders a released
-- report to someone holding the credential; it records that here, and the
-- queue shows "Belum dibuka" or "Dibuka 3×, terakhir 10:12" under each
-- released row. That line is what the e-mail and WhatsApp lines above it
-- exist to make true, and "belum dibuka" a day after release is the cue to
-- pick up the phone.
--
-- The reviewer's own admin preview is never counted. NULL = not yet.

ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count      INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN buyer_reports.first_opened_at IS
  'First time the buyer rendered the RELEASED report with a valid credential. Admin previews are not counted. NULL = not yet.';
COMMENT ON COLUMN buyer_reports.last_opened_at IS
  'Most recent such open.';
COMMENT ON COLUMN buyer_reports.open_count IS
  'How many such opens. Best-effort (read-then-write); off by one under a two-tab race at worst.';
