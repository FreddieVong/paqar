-- Tracks the one-question feedback email sent to REAL paying customers.
--
-- WHY
--
-- On 2026-08-04 Paqar took its first genuine payment from a stranger
-- (RM12, organic, direct traffic, under three minutes from landing to paid).
-- Every prior "sale" belonged to the founder or two friends testing, which is
-- why historical conversion rates were meaningless.
--
-- A paying customer is the only person who can say whether the report was
-- worth RM12. That answer decides pricing, the RM88 add-on, and what gets
-- built next -- and it is worth more than any amount of ad spend. Asking must
-- not depend on someone remembering to.
--
-- Nullable with NO DEFAULT, deliberately: NULL means "not yet asked", and the
-- cron treats it as the queue. A DEFAULT now() would mark every historical
-- customer as already asked and silently skip them -- the mistake migration
-- 021 made with lookup_status that 022 had to undo.

ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS feedback_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN buyer_reports.feedback_email_sent_at IS
  'When the post-purchase feedback email was sent. NULL = not yet asked; the retarget cron uses this as its queue. Set even when sending fails, so a permanently bouncing address cannot be retried forever.';
