-- Scoped storage policies for listing-screenshots, and a screenshot record.
--
-- ── WHY 033 AND NOT AN EDIT TO 032 ─────────────────────────────────────────
--
-- 032 is still unapplied, but the storage POLICIES in the previous session were
-- applied by hand to the live project. Anything correcting already-applied state
-- must be a new migration, or a clean install and the live database diverge
-- while both claim to have "run 032".
--
-- ── A CORRECTION TO WHAT WAS PREVIOUSLY CLAIMED ────────────────────────────
--
-- The two live policies were described as a landmine that would "silently
-- disable future buckets". That was reasoning from the policy NAME and from an
-- assumption about semantics, and it is wrong in an important way:
--
--   CREATE POLICY ... FOR SELECT USING (false)
--
-- is PERMISSIVE by default. Postgres grants access when ANY permissive policy
-- passes, so a permissive policy returning false GRANTS NOTHING AND DENIES
-- NOTHING. It cannot disable a future bucket, because a future bucket would
-- have no grant either way. The live policies are therefore no-ops that look
-- like security — which is its own problem, but not the one that was stated.
--
-- They are still replaced, for two reasons that survive the correction:
--   1. They are unscoped, so they describe intent about one bucket while
--      applying to all of storage.objects.
--   2. A no-op that reads as a control is worse than no control, because the
--      next person to audit this stops when they see it.
--
-- ── THE MODEL THIS ESTABLISHES ─────────────────────────────────────────────
--
-- public = false is NOT the whole boundary, and must not be described as such.
-- The boundary is four things:
--
--   1. bucket public = false        no unsigned URL serves an object
--   2. RLS on, no permissive grant  anon/authenticated get nothing by default
--   3. a RESTRICTIVE floor          scoped to this bucket, so that a future
--                                   careless permissive policy CANNOT open it
--   4. service_role server-side     the single intended door, never in a browser
--
-- Item 3 is the one worth adding. Restrictive policies AND with everything
-- else, so they are a floor rather than a grant: if someone later adds a
-- permissive "allow authenticated read" across storage.objects, this still
-- refuses for this bucket. Scoped by bucket_id so it can never affect another.

BEGIN;

-- Idempotent: drop-then-create is the only reliable shape, since CREATE POLICY
-- has no IF NOT EXISTS.
DROP POLICY IF EXISTS "listing-screenshots: no anon read"  ON storage.objects;
DROP POLICY IF EXISTS "listing-screenshots: no anon write" ON storage.objects;
DROP POLICY IF EXISTS "listing_screenshots_deny_client_roles" ON storage.objects;

-- The floor. `bucket_id <> '...'` rather than `= '...'`: a restrictive policy
-- must PASS for rows it does not govern, or it would deny every other bucket —
-- exactly the unscoped failure this migration exists to remove.
CREATE POLICY "listing_screenshots_deny_client_roles"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING      ( bucket_id <> 'listing-screenshots' )
  WITH CHECK ( bucket_id <> 'listing-screenshots' );

COMMIT;

-- Screenshot RECORDS live in 034, alongside listing_intake.
--
-- They were originally defined here keyed on check_id. That was wrong: a
-- screenshot is uploaded BEFORE a check exists — the whole point of the intake
-- entity — so keying it on check_id would have required a nullable owner and a
-- second nullable owner after conversion. Neither migration is applied, so the
-- table moves rather than acquiring a column to paper over the ordering.

-- ═══════════════════════════════════════════════════════════════════════════
-- Decision impact — extending report_feedback, not duplicating it
-- ═══════════════════════════════════════════════════════════════════════════
--
-- report_feedback (013) already stores post-report responses, but its answer is
-- a boolean `helpful`. The question that actually measures market fit is not
-- whether a report was liked — it is whether it CHANGED WHAT THE BUYER DID:
--
--   teruskan_beli · runding_harga · tak_jadi_beli · belum_pasti · tidak_membantu
--
-- "Bought anyway" and "walked away" are both successes for the product and are
-- indistinguishable under a boolean. So the column is added here rather than a
-- second feedback table being created: one subsystem, one place to query.
--
-- `helpful` becomes nullable, because a decision-impact answer is a complete
-- response on its own and forcing a boolean alongside it would invent data.
ALTER TABLE report_feedback
  ADD COLUMN IF NOT EXISTS decision_impact  TEXT,
  ADD COLUMN IF NOT EXISTS buyer_report_id  UUID REFERENCES buyer_reports(id) ON DELETE SET NULL,
  -- WHICH revision the buyer was answering about. After an RM88 upgrade the
  -- decision may change again, and an answer about revision 1 must not be read
  -- as an answer about revision 2.
  ADD COLUMN IF NOT EXISTS revision         INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE report_feedback ALTER COLUMN helpful DROP NOT NULL;

ALTER TABLE report_feedback DROP CONSTRAINT IF EXISTS report_feedback_decision_impact_values;
ALTER TABLE report_feedback ADD CONSTRAINT report_feedback_decision_impact_values
  CHECK (decision_impact IS NULL OR decision_impact IN (
    'teruskan_beli', 'runding_harga', 'tak_jadi_beli', 'belum_pasti', 'tidak_membantu'
  ));

-- One answer per check per revision, so a buyer changing their mind UPDATES
-- rather than appending. Without this an idempotent upsert is impossible and
-- the aggregate double-counts anyone who tapped twice.
CREATE UNIQUE INDEX IF NOT EXISTS report_feedback_one_per_revision_idx
  ON report_feedback (check_id, COALESCE(revision, 1))
  WHERE decision_impact IS NOT NULL;

COMMENT ON COLUMN report_feedback.decision_impact IS
  'Did the report change what the buyer did? Both tak_jadi_beli and runding_harga are product successes — a boolean cannot express that, which is why this column exists alongside `helpful` rather than reusing it.';
