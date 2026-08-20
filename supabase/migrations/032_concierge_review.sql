-- The concierge release gate: intake context in, human sign-off out.
--
-- ── WHY ────────────────────────────────────────────────────────────────────
--
-- Paqar's paid report was machine-generated and delivered the instant Billplz
-- confirmed payment. That is what a tester was right to object to: a median of
-- at most fifteen Mudah adverts, sold to someone who could read the same
-- adverts for free.
--
-- The RM29 product makes a different promise — "disemak oleh manusia sebelum
-- dihantar" — and that is only true if an unreviewed report is genuinely
-- UNREACHABLE. This migration carries the state that makes it so.
--
-- ── BACKWARD COMPATIBILITY ─────────────────────────────────────────────────
--
-- Additive only, except for two NOT NULL drops (a widening). The currently
-- deployed application keeps working after this is applied: it always supplies
-- a plate, never reads the new columns, and every added column is nullable or
-- defaulted. Apply the migration FIRST, deploy the application SECOND.
--
-- ── NOT YET APPLIED. DO NOT EDIT AFTER IT IS. ──────────────────────────────
--
-- This file is still being changed as workstreams land, so it must not be
-- applied to any database until the schema work is finished and it is frozen.
-- Editing an applied migration makes migration history a fiction: two
-- databases that both "ran 032" would hold different schemas, and nothing
-- would say so. Once applied, every further change goes in 033 onward.
--
-- ── LEGACY DATA ────────────────────────────────────────────────────────────
--
-- The backfill at the end of this file is the part that most needs review
-- before freezing: buyer_reports already holds paid rows from the pre-review
-- product, and the new NOT NULL defaults would silently describe them as
-- 'pending' review — putting historical orders into a queue that will never be
-- worked. See section 4.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. INTAKE CONTEXT — collected BEFORE payment
-- ═══════════════════════════════════════════════════════════════════════════
--
-- On `checks` because that row exists at intake, whereas buyer_reports is not
-- created until checkout. ONE copy — the review queue joins rather than
-- carrying a duplicate that can drift.
--
-- NOTE: buyer_reports.listing_url (migration 004) is NOT this field. It is a
-- dormant column from an earlier intake design that nothing has ever written.
-- Left in place, but it is not the source of truth.
ALTER TABLE checks
  ADD COLUMN IF NOT EXISTS listing_url   TEXT,
  ADD COLUMN IF NOT EXISTS buyer_concern TEXT,
  ADD COLUMN IF NOT EXISTS brand         TEXT,
  ADD COLUMN IF NOT EXISTS model         TEXT,
  ADD COLUMN IF NOT EXISTS year          TEXT;

-- The plate stops being mandatory.
--
-- It was the only way to identify a car, so it was required, and identifying
-- the car cost RM0.81 of provider credit on every stranger — spent before
-- anyone paid anything. The buyer is reading an advert that already states the
-- model and year, so asking for those identifies the car for nothing and the
-- provider call moves after payment, where it verifies the seller's claim
-- instead of repeating what the buyer already knew.
ALTER TABLE checks ALTER COLUMN plate_encrypted DROP NOT NULL;
ALTER TABLE checks ALTER COLUMN plate_hash      DROP NOT NULL;

COMMENT ON COLUMN checks.listing_url IS
  'The advert the buyer is considering, pasted at intake. Stored as text and NEVER parsed by the report pipeline — a human opens it. This is what lets Paqar cover Carlist and Facebook Marketplace, which no scraper here can reach.';
COMMENT ON COLUMN checks.buyer_concern IS
  'Free text: what the buyer is worried about. The reviewer brief, and the richest product signal this experiment produces.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REVIEW STATE — separate from payment, separate from refund
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THREE INDEPENDENT AXES, deliberately not collapsed into one column:
--
--   status         (existing) pending | paid | expired   — did money arrive?
--   review_status             pending | in_review | released | unable_to_complete
--   refund_status             not_required | required | processing | refunded | failed
--
-- They are independent because they genuinely are: a paid order can be
-- unreleased, a released order can later be refunded, and an unable_to_complete
-- order is paid, unreleased and refund-required all at once. Folding them into
-- one enum produces a cross-product of states that cannot all be expressed, and
-- the first thing to break is the one case that matters — money taken for a
-- report that was never delivered.
--
-- `released_at` REMAINS THE AUTHORITATIVE ACCESS GATE. review_status is the
-- workflow; released_at is the fact. A report is readable only when payment is
-- valid AND review_status = 'released' AND released_at IS NOT NULL. Keeping the
-- timestamp authoritative means the gate already shipped and tested in
-- lib/report-release.ts stays correct, and a workflow bug cannot open it.
ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS review_status     TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS refund_status     TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_required_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id       TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_note     TEXT,
  -- Reviewer corrections to the DRAFT. Never overwrites source evidence:
  -- extracted values, provider records and buyer edits are all preserved
  -- separately, and this holds only what the reviewer decided instead.
  ADD COLUMN IF NOT EXISTS reviewed_overrides JSONB,
  -- Refund bookkeeping. Billplz API v3 exposes no refund endpoint, so the
  -- money movement is manual; these columns exist so it cannot be forgotten or
  -- double-paid, NOT to imply automation.
  ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS refund_reason_code  TEXT,
  ADD COLUMN IF NOT EXISTS refund_reference    TEXT,
  -- Audited identity rechecks. A provider/listing mismatch usually means a
  -- mistyped plate or a misread screenshot, so the reviewer gets ONE corrected
  -- re-lookup before the order is written off as unresolvable. Counted rather
  -- than boolean so the audit shows how many RM0.81 calls an order consumed.
  ADD COLUMN IF NOT EXISTS identity_recheck_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrected_plate_hash   TEXT;

COMMENT ON COLUMN buyer_reports.released_at IS
  'When a human released this report. THE ACCESS GATE: null means the report page must withhold BuyerReportContent entirely. No default — a default would release every row on creation, the exact failure being designed out.';
COMMENT ON COLUMN buyer_reports.review_status IS
  'Workflow state. released_at remains authoritative for ACCESS; this drives the queue. unable_to_complete means the draft could not be corrected into something truthful — the only valid outcome there is refund, never release.';
COMMENT ON COLUMN buyer_reports.refund_status IS
  'Independent of review_status. Billplz has no refund API, so refunded means a human moved money and recorded the reference — never merely that a flag was set.';
COMMENT ON COLUMN buyer_reports.identity_recheck_count IS
  'Audited provider re-lookups after a reviewer corrected the plate. Capped at MAX_IDENTITY_RECHECKS in lib/release-validation — each costs RM0.81, and a plate that keeps disagreeing is not converging on anything.';

COMMENT ON COLUMN buyer_reports.reviewed_overrides IS
  'Reviewer decisions applied over the automated draft at rebuild time. Source evidence (extraction, provider records, buyer edits) is preserved elsewhere and never rewritten.';

-- ── Legal values ───────────────────────────────────────────────────────────
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_review_status_values;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_review_status_values
  CHECK (review_status IN ('pending', 'in_review', 'released', 'unable_to_complete'));

ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_refund_status_values;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_refund_status_values
  CHECK (refund_status IN ('not_required', 'required', 'processing', 'refunded', 'failed'));

-- ── The invariants the application must never be able to violate ───────────
--
-- Expressed in the database because they protect money and truthfulness, and
-- because an application-only guarantee is one forgotten code path away from
-- being false. The server operations are idempotent as well; this is the floor,
-- not the whole defence.

-- Released means released: the workflow state and the access gate agree, always.
-- Without this, a bug could set one and not the other, and which one is
-- authoritative would stop being a decision and start being a race.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_release_consistent;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_release_consistent
  CHECK ((review_status = 'released') = (released_at IS NOT NULL));

-- A report that could not be completed must never be readable, whatever else
-- happened to it.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_unable_not_released;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_unable_not_released
  CHECK (review_status <> 'unable_to_complete' OR released_at IS NULL);

-- A refund is only "completed" with a timestamp AND an external reference. The
-- reference is what distinguishes money actually returned from a flag someone
-- flipped, which is the distinction this whole workflow exists to preserve.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_refund_completed_evidence;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_refund_completed_evidence
  CHECK (
    refund_status <> 'refunded'
    OR (refund_completed_at IS NOT NULL AND refund_reference IS NOT NULL AND refund_amount_cents IS NOT NULL)
  );

-- Anything past 'required' must record when it was required.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_refund_required_stamped;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_refund_required_stamped
  CHECK (refund_status = 'not_required' OR refund_required_at IS NOT NULL);

-- Only a PAID order can be reviewed, released or refunded. Nothing downstream
-- of money may happen to a row where money never arrived.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_workflow_requires_payment;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_workflow_requires_payment
  CHECK (
    status = 'paid'
    OR (review_status = 'pending' AND refund_status = 'not_required')
  );

-- A released report must carry the human judgement it is sold on. An empty
-- note means the buyer received the machine output a cheaper competitor
-- already sells.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_released_has_note;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_released_has_note
  CHECK (review_status <> 'released' OR (reviewer_note IS NOT NULL AND length(btrim(reviewer_note)) > 0));

-- The recheck budget is a spend cap, so it is enforced here as well as in
-- lib/release-validation. Application-only limits on money are one forgotten
-- branch away from being advisory.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_identity_recheck_bounded;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_identity_recheck_bounded
  CHECK (identity_recheck_count >= 0 AND identity_recheck_count <= 1);

-- The review queue's only hot query: unreleased paid rows, oldest first.
CREATE INDEX IF NOT EXISTS buyer_reports_pending_review_idx
  ON buyer_reports (paid_at)
  WHERE status = 'paid' AND released_at IS NULL;

CREATE INDEX IF NOT EXISTS buyer_reports_refund_due_idx
  ON buyer_reports (refund_required_at)
  WHERE refund_status IN ('required', 'processing', 'failed');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. TRANSITION AUDIT — every state change, append only
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A status column records where a row IS. This records how it got there, which
-- is what an argument about a refund or a bad release actually needs. Append
-- only: no update or delete policy is granted, and corrections are new rows.
CREATE TABLE IF NOT EXISTS report_state_transitions (
  id              BIGSERIAL PRIMARY KEY,
  buyer_report_id UUID NOT NULL REFERENCES buyer_reports(id) ON DELETE CASCADE,
  -- 'review' | 'refund'. Which axis moved.
  axis            TEXT NOT NULL CHECK (axis IN ('review', 'refund')),
  from_state      TEXT,
  to_state        TEXT NOT NULL,
  -- Who, and why. reason_code is low-cardinality by intent so corrections can
  -- be counted; note carries the specifics.
  actor           TEXT,
  reason_code     TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_state_transitions_report_idx
  ON report_state_transitions (buyer_report_id, created_at DESC);

-- One transition INTO a terminal money/access state, ever.
--
-- This is the double-release and double-refund guard, and it is a unique index
-- rather than application logic because both failures move money or publish an
-- unreviewed report, and both are the kind of thing a webhook retry or a
-- double-tapped phone produces at exactly the wrong moment.
CREATE UNIQUE INDEX IF NOT EXISTS report_state_transitions_once_idx
  ON report_state_transitions (buyer_report_id, axis, to_state)
  WHERE to_state IN ('released', 'refunded');

ALTER TABLE report_state_transitions ENABLE ROW LEVEL SECURITY;
-- No policy is created deliberately: with RLS enabled and no policy, only the
-- service role reaches this table. Buyers must never read or write an audit log.

COMMENT ON TABLE report_state_transitions IS
  'Append-only audit of every review/refund state change. The unique partial index makes a second release or a second refund impossible at the database level, not merely unlikely.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3b. REVISIONS — a second review must not take the first one away
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The RM88 history add-on sends the report back for a SECOND human review: the
-- reviewer reconciles claim records against recorded mileage and the seller's
-- statements, then issues an updated decision and next action. That review
-- takes time.
--
-- Reopening the released row would make the buyer's existing report vanish
-- while they wait — they paid RM29 for a decision, read it, paid RM88 more, and
-- would be left with nothing readable. So a revision is a NEW row, and the
-- released one stays current until the new one is released.
--
--   revision          1 for the original, 2 for the history-enhanced version
--   supersedes_id     the revision this replaces
--   is_current        exactly one true per check, flipped atomically at release
--
-- is_current is what every read path resolves, so promotion is a single
-- statement rather than a sequence a failure can interrupt halfway.
ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS revision      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES buyer_reports(id),
  ADD COLUMN IF NOT EXISTS is_current    BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN buyer_reports.is_current IS
  'The revision a buyer reads. Exactly one per check_id. Flipped atomically when a later revision is released, so the earlier report never disappears while its replacement is still under review.';

-- Exactly one current revision per check, enforced rather than assumed: two
-- would make "which report does this buyer see" a race.
CREATE UNIQUE INDEX IF NOT EXISTS buyer_reports_one_current_idx
  ON buyer_reports (check_id)
  WHERE is_current AND status = 'paid';

-- A revision beyond the first must say what it replaces.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_revision_chain;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_revision_chain
  CHECK (revision = 1 OR supersedes_id IS NOT NULL);

-- A revision may only become current once a human has released it. Without
-- this, promoting an unreviewed revision would replace a good report with a
-- draft — the precise failure the release gate exists to prevent, arriving
-- through a side door.
ALTER TABLE buyer_reports DROP CONSTRAINT IF EXISTS buyer_reports_current_is_released;
ALTER TABLE buyer_reports ADD CONSTRAINT buyer_reports_current_is_released
  CHECK (NOT is_current OR status <> 'paid' OR released_at IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LEGACY BACKFILL — historical orders predate the review product
-- ═══════════════════════════════════════════════════════════════════════════
--
-- buyer_reports holds paid rows from before human review existed. Those buyers
-- already received their report the instant Billplz confirmed payment, so they
-- are DELIVERED — but the column defaults above would describe them as
-- review_status = 'pending', dropping every historical order into a review
-- queue that will never be worked and whose 24-hour promise is years expired.
--
-- They are marked released, back-dated to when they were actually delivered.
-- That is the truthful record: a human did not review them, but the buyer did
-- receive them, and 'released' is the state that means "the buyer can read
-- this". The reviewer_note records honestly that no review took place, which
-- also satisfies the released-rows-must-carry-a-note CHECK without inventing a
-- human judgement that never happened.
--
-- ORDER MATTERS: this must run BEFORE the CHECK constraints above would be
-- validated against it. Postgres validates on ADD CONSTRAINT, so the
-- constraints are already in place by the time this executes — hence the
-- backfill sets released_at and review_status together, exactly as the
-- release-consistency CHECK requires.
UPDATE buyer_reports
SET
  review_status = 'released',
  released_at   = COALESCE(paid_at, created_at, now()),
  reviewer_note = COALESCE(
    reviewer_note,
    'Laporan ini dihantar sebelum Paqar memperkenalkan semakan manusia. Ia dijana automatik dan tidak disemak oleh manusia.'
  )
WHERE status = 'paid'
  AND released_at IS NULL
  AND review_status = 'pending';

-- Unpaid and expired legacy rows need nothing: the defaults already describe
-- them correctly (pending review, no refund owed), and the
-- workflow_requires_payment CHECK permits exactly that combination.

-- Sanity: after this migration no paid row may sit in a state the application
-- cannot represent. Raises loudly rather than leaving a silent inconsistency.
DO $$
DECLARE stranded INTEGER;
BEGIN
  SELECT count(*) INTO stranded
  FROM buyer_reports
  WHERE status = 'paid'
    AND review_status = 'released'
    AND released_at IS NULL;

  IF stranded > 0 THEN
    RAISE EXCEPTION 'Backfill left % paid rows released with no released_at', stranded;
  END IF;
END $$;
