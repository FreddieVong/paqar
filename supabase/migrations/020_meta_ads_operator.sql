-- Meta Ads operator: attribution + read-only performance tracking for the
-- first paid experiment (RM210, 7 days, FB+IG Malaysia).
--
-- Applied and verified against a real PostgreSQL instance (PGlite), including
-- 10 negative tests confirming 020_verify.sql detects a missing table, a
-- missing column, each dropped unique constraint, a dropped foreign key,
-- disabled RLS, and a too-narrow snapshot key.
--
-- Still run 020_verify.sql in the Supabase SQL Editor after applying this —
-- only that proves it against YOUR database — and confirm it reports
-- ALL CHECKS PASSED before enabling the operator or spending anything.
--
-- Why attribution can't live on `checks`: app/api/checks/route.ts returns a
-- CACHED check row for a plate someone already looked up, so one check row is
-- shared between visitors. Storing UTMs there would give a second visitor the
-- first visitor's creative. Attribution is therefore anchored to a first-party
-- session cookie (paqar_sid) instead.

-- ---------------------------------------------------------------------------
-- ad_sessions — immutable first-touch attribution, one row per paqar_sid.
-- Meta strips query parameters on later navigations, so this row is the only
-- place the original creative survives. utm_* and fbclid are written once and
-- never overwritten; fbc/fbp may fill a NULL later because Meta's pixel sets
-- _fbc/_fbp a moment after the landing request.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_sessions (
  session_id    TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  utm_term      TEXT,
  fbclid        TEXT,
  fbc           TEXT,
  fbp           TEXT,
  landing_path  TEXT,
  referrer      TEXT
);

CREATE INDEX IF NOT EXISTS idx_ad_sessions_utm_source
  ON ad_sessions (utm_source, utm_content)
  WHERE utm_source IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ad_events — the Paqar-side funnel log, and the source of truth for the
-- experiment. Attribution columns are denormalised copies resolved from
-- ad_sessions at insert time so every funnel query is one GROUP BY.
--
-- UNIQUE(event_name, event_id) is the whole idempotency story. event_id is
-- DERIVED (see lib/attribution.ts), never random — so a page refresh, a
-- re-rendered /selesai, a Billplz webhook retry and a client retry all
-- recompute the same value and collide here instead of double-counting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,
  event_name      TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  fbclid          TEXT,
  fbc             TEXT,
  fbp             TEXT,
  check_id        TEXT,
  buyer_report_id UUID,
  bill_id         TEXT,
  amount_cents    INTEGER,
  path            TEXT,
  capi_sent_at    TIMESTAMPTZ,
  UNIQUE (event_name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_events_session   ON ad_events (session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ad_events_funnel    ON ad_events (utm_source, utm_content, event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ad_events_check     ON ad_events (check_id) WHERE check_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- checkout_attributions — attribution captured at BILL CREATION, so a purchase
-- can be attributed from the Billplz webhook alone. The customer who pays and
-- immediately closes the tab never reaches /selesai; without this row that sale
-- would be unattributable. Never infer attribution from paid_at proximity.
--
-- Covers both bill types: the RM12/RM100 bill (buyer_reports.billplz_bill_id)
-- and the +RM88 upgrade bill (buyer_reports.upgrade_bill_id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_attributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billplz_bill_id     TEXT NOT NULL UNIQUE,
  buyer_report_id     UUID,
  check_id            TEXT,
  paqar_sid           TEXT,
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  utm_content         TEXT,
  utm_term            TEXT,
  fbclid              TEXT,
  fbc                 TEXT,
  fbp                 TEXT,
  product             TEXT NOT NULL,
  amount_cents        INTEGER NOT NULL,
  checkout_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_attributions_report ON checkout_attributions (buyer_report_id);
CREATE INDEX IF NOT EXISTS idx_checkout_attributions_sid    ON checkout_attributions (paqar_sid);

-- ---------------------------------------------------------------------------
-- buyer_reports: the +RM88 upgrade previously recorded only add_jomcheck=true,
-- with no amount and no timestamp — so upgrade revenue had no row-level record
-- and could not be assigned to a reporting day.
-- ---------------------------------------------------------------------------
ALTER TABLE buyer_reports ADD COLUMN IF NOT EXISTS upgrade_paid_at      TIMESTAMPTZ;
ALTER TABLE buyer_reports ADD COLUMN IF NOT EXISTS upgrade_amount_cents INTEGER;

-- ---------------------------------------------------------------------------
-- meta_ads_experiment — single row. Meta objects are created and activated by
-- hand in Ads Manager; this table only records their IDs and the operator's
-- own state. operator_enabled does NOT start Meta delivery.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_ads_experiment (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id          TEXT,
  meta_adset_id             TEXT,
  creative_a_ad_id          TEXT,
  creative_b_ad_id          TEXT,
  status                    TEXT NOT NULL DEFAULT 'draft',
  daily_budget_cents        INTEGER NOT NULL DEFAULT 3000,
  spend_cap_cents           INTEGER NOT NULL DEFAULT 21000,
  launched_at               TIMESTAMPTZ,
  stopped_at                TIMESTAMPTZ,
  manual_pause              BOOLEAN NOT NULL DEFAULT false,
  operator_enabled          BOOLEAN NOT NULL DEFAULT false,
  kill_switch               BOOLEAN NOT NULL DEFAULT false,
  last_successful_sync_at   TIMESTAMPTZ,
  consecutive_spend_failures INTEGER NOT NULL DEFAULT 0,
  preflight_acknowledged_at TIMESTAMPTZ,
  critical_alert_state      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- meta_ads_snapshots — one row per six-hour cron bucket per Meta object.
-- Keyed on the BUCKET, not report_date: the cron runs 4x/day and all four
-- snapshots must survive. report_date (Asia/Kuala_Lumpur) is for reporting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_ads_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id        UUID REFERENCES meta_ads_experiment(id),
  captured_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at_bucket   TIMESTAMPTZ NOT NULL,
  report_date          DATE NOT NULL,
  level                TEXT NOT NULL,
  meta_object_id       TEXT NOT NULL,
  spend_cents          INTEGER,
  impressions          INTEGER,
  reach                INTEGER,
  video_views          INTEGER,
  link_clicks          INTEGER,
  landing_page_views   INTEGER,
  paqar_landing_views  INTEGER,
  valuation_started    INTEGER,
  valuation_completed  INTEGER,
  purchases_rm12       INTEGER,
  purchases_rm100      INTEGER,
  revenue_cents        INTEGER,
  UNIQUE (captured_at_bucket, meta_object_id, level)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_snapshots_date ON meta_ads_snapshots (report_date, level);

-- ---------------------------------------------------------------------------
-- meta_ads_actions — every operator decision. idempotency_key UNIQUE is the
-- mechanism: a duplicate cron invocation collides instead of acting twice.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_ads_actions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id    UUID REFERENCES meta_ads_experiment(id),
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  rule             TEXT NOT NULL,
  action           TEXT NOT NULL,
  success          BOOLEAN NOT NULL,
  response_summary TEXT,
  idempotency_key  TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_actions_recent ON meta_ads_actions (occurred_at DESC);

ALTER TABLE ad_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_experiment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_actions      ENABLE ROW LEVEL SECURITY;
-- Service-role access only — no client policies.
