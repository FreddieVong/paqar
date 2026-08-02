-- Experiment accounting the operator cannot safely derive from Meta.
--
-- WHY A MIGRATION IS REQUIRED
--
-- meta_ads_experiment has no JSONB or settings column (020), and no other
-- table is a safe home for experiment state. Environment variables were
-- rejected: the application cannot write them, so graphic_ads_started_at
-- could never be stamped at the moment of the swap, and the value would sit
-- outside the audit trail that every other operator decision lives in.
--
-- WHY THESE THREE
--
-- graphic_ads_started_at -- the video creatives (creative_a/creative_b) and
--   the graphic creatives (creative_c/creative_d) must never be summed.
--   Tag separation alone is not sufficient: a stray pre-swap test row carrying
--   a new tag, or any future tag reuse, would leak into the live comparison.
--   Active-creative queries filter occurred_at >= this timestamp.
--
-- experiment_started_at / opening_spend_cents -- Meta's amount_spent counter
--   RESETS when the campaign spending limit changes. On 2026-08-02 it read
--   RM27.23 while the last stored snapshot showed RM186.80 cumulative, so a
--   naive read reported ~RM182 remaining against a RM210 allowance that had
--   in fact already been exceeded (~RM214). Cumulative spend must therefore be
--   reconstructed from Paqar's own snapshots plus a recorded opening balance,
--   never from the live counter alone.
--
-- All three are NULLABLE with NO DEFAULT, deliberately.
--
-- NULL means "not recorded" and is handled explicitly by the readers; it is
-- never treated as zero, and never guessed. Migration 021 added a column with
-- DEFAULT 'pending' and silently stamped 26 historical rows with a status that
-- had never been measured, which migration 022 had to undo. A DEFAULT 0 on
-- opening_spend_cents would repeat that mistake in the most expensive place
-- available: it would assert that no prior spend occurred.

ALTER TABLE meta_ads_experiment
  ADD COLUMN IF NOT EXISTS graphic_ads_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS experiment_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_spend_cents    INTEGER;

COMMENT ON COLUMN meta_ads_experiment.graphic_ads_started_at IS
  'When the graphic creatives (creative_c/creative_d) went live. Active-creative reporting counts only ad_events at or after this instant, so retired video data and pre-swap test rows can never enter the comparison. NULL = not yet swapped.';

COMMENT ON COLUMN meta_ads_experiment.experiment_started_at IS
  'Start of the accounting window for cumulative spend. NULL = fall back to the earliest stored snapshot.';

COMMENT ON COLUMN meta_ads_experiment.opening_spend_cents IS
  'Manually reconciled spend that occurred BEFORE the accounting window, e.g. spend lost to a Meta counter reset. Added to snapshot-derived spend. NULL = unknown, which forces a reconciliation warning rather than an optimistic remaining figure.';
