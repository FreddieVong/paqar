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

-- ═══════════════════════════════════════════════════════════════════════════
-- Screenshot records
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Metadata only. The object itself lives in the private bucket, and a signed
-- URL is minted per reviewer view and never persisted — a stored signed URL is
-- a credential in a database column, and it outlives the reason it was created.
CREATE TABLE IF NOT EXISTS listing_screenshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id      TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,

  -- Server-generated, random. A user-supplied filename is attacker-controlled
  -- input used as a path, which is how traversal and overwrite happen.
  storage_path  TEXT NOT NULL UNIQUE,

  -- Verified from BYTES, never from the upload's claimed type.
  mime_type     TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes         INTEGER NOT NULL CHECK (bytes > 0),
  width         INTEGER NOT NULL CHECK (width  > 0),
  height        INTEGER NOT NULL CHECK (height > 0),

  -- Same image uploaded twice is one row. Buyers screenshot the same page from
  -- two apps more often than you would expect, and OCR is metered.
  content_hash  TEXT NOT NULL,

  -- quarantined: stored but not yet validated · ready: validated, OCR may run
  -- · rejected: failed validation, delete on next sweep · extracted: OCR done
  state         TEXT NOT NULL DEFAULT 'quarantined'
                CHECK (state IN ('quarantined', 'ready', 'rejected', 'extracted')),

  -- Per-field extraction with provenance. No signed URL, ever.
  extraction    JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set at insert to created_at + 24h. Moved out to +30d once the case is
  -- released or refunded; swept either way.
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  deleted_at    TIMESTAMPTZ
);

-- One row per identical image per intake.
CREATE UNIQUE INDEX IF NOT EXISTS listing_screenshots_dedupe_idx
  ON listing_screenshots (check_id, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS listing_screenshots_check_idx
  ON listing_screenshots (check_id)
  WHERE deleted_at IS NULL;

-- The cleanup sweep's only query.
CREATE INDEX IF NOT EXISTS listing_screenshots_expiry_idx
  ON listing_screenshots (expires_at)
  WHERE deleted_at IS NULL;

ALTER TABLE listing_screenshots ENABLE ROW LEVEL SECURITY;
-- No policy, deliberately: RLS on with no permissive policy means only the
-- service role reaches this table. Buyers and reviewers both go through server
-- code that authorises first.

COMMENT ON TABLE listing_screenshots IS
  'Metadata for privately-stored listing screenshots. Never holds a signed URL — those are minted per authorised view and expire. storage_path is server-generated and random.';
COMMENT ON COLUMN listing_screenshots.state IS
  'quarantined -> ready -> extracted, or -> rejected. OCR and reviewer access require ready or later; a quarantined object has been stored but not yet proven to be an image.';
