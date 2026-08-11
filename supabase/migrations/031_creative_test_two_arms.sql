-- Durable record of the creative-treatment test's Meta objects.
--
-- WHY A NEW TABLE RATHER THAN COLUMNS ON meta_ads_experiment
--
-- meta_ads_experiment is the operator's supervision record: the cron reads it
-- to decide when to hard-stop, and it holds ONE campaign and ONE ad set. The
-- operator deliberately does NOT supervise this campaign — its hard stop cannot
-- pause it, and the per-ad-set lifetime budgets are the real ceiling. Adding
-- meta_adset_b_id to that table would imply supervision that does not exist,
-- which is exactly the kind of quiet false premise that got a healthy campaign
-- paused once already.
--
-- Numbered 031, not 030: the unshipped feat/paywall-variant-experiment branch
-- already owns 030, and a knowing collision is not worth the saved digit.
--
-- Every id here is recorded at creation, while the object is PAUSED. Nothing in
-- this schema records or implies activation — that remains a human action in
-- Ads Manager with no code path behind it.

CREATE TABLE IF NOT EXISTS meta_creative_test_objects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- utm_campaign, so the row joins directly to ad_events without a lookup.
  campaign_utm          TEXT        NOT NULL UNIQUE,
  meta_campaign_id      TEXT        NOT NULL,

  -- Arm A: the control. Arm B: the challenger. Named for the ARM, never for a
  -- creative: creative identity lives in utm_content, and confusing a column
  -- name with a creative identity is the defect guards.ts warns about at
  -- length.
  arm_a_name            TEXT        NOT NULL,
  arm_a_utm_content     TEXT        NOT NULL,
  arm_a_adset_id        TEXT        NOT NULL,
  arm_a_creative_id     TEXT        NOT NULL,
  arm_a_ad_id           TEXT        NOT NULL,

  arm_b_name            TEXT        NOT NULL,
  arm_b_utm_content     TEXT        NOT NULL,
  arm_b_adset_id        TEXT        NOT NULL,
  arm_b_creative_id     TEXT        NOT NULL,
  arm_b_ad_id           TEXT        NOT NULL,

  -- The Custom Conversion both arms optimise toward. Stored so a later reader
  -- can tell WHICH conversion the numbers were produced under, rather than
  -- assuming it was the one configured today.
  custom_conversion_id  TEXT        NOT NULL,

  -- Per-arm lifetime budget in cents, as sent. The committed maximum is twice
  -- this, and it is the only Meta-enforced ceiling on this campaign.
  lifetime_budget_cents INTEGER     NOT NULL CHECK (lifetime_budget_cents > 0),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Set by hand after a human activates in Ads Manager. NULL means never
  -- started, which is the state every row begins in and the state this
  -- codebase can never change.
  activated_at          TIMESTAMPTZ,

  -- Free text: which native A/B mechanism was configured, and by whom. NULL
  -- until that is done. Activation without it is the one thing the brief
  -- forbids outright, so it is recorded rather than assumed.
  ab_test_note          TEXT,

  CONSTRAINT arms_are_distinct CHECK (
    arm_a_adset_id    <> arm_b_adset_id AND
    arm_a_ad_id       <> arm_b_ad_id    AND
    arm_a_creative_id <> arm_b_creative_id AND
    arm_a_utm_content <> arm_b_utm_content
  )
);

COMMENT ON TABLE meta_creative_test_objects IS
  'Meta objects for the creative-treatment test. Created PAUSED; activation is manual and unrecorded by any code path.';
