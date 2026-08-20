-- Anonymous, expiring listing intake — and the screenshots that belong to it.
--
-- ── WHY NOT JUST CREATE THE CHECK EARLIER ──────────────────────────────────
--
-- A buyer uploads screenshots before Paqar knows what car it is, and coverage
-- cannot run until extraction has. So something must own those bytes before a
-- check can exist.
--
-- Creating a placeholder `checks` row instead would have three costs, and the
-- first is the one that matters: `checks` IS the funnel. Every conversion
-- figure Paqar has — start rate, completion rate, the 65%/0% split that
-- justified the whole plate-first rewrite — counts rows in that table. Filling
-- it with abandoned uploads would corrupt the measurements this experiment
-- exists to produce, and it would do so invisibly. It would also force
-- brand/model/year to become nullable, weakening a constraint that currently
-- guarantees a check identifies a car.
--
-- So intake is its own entity, with its own lifecycle and its own expiry, and
-- a check is created only when there is genuinely a car to check.
--
-- ── OWNERSHIP ──────────────────────────────────────────────────────────────
--
-- Anonymous but not unauthenticated. A UUID in a URL is a name, not a
-- credential — anyone who guesses or is shown one could read another buyer's
-- uploads. Every intake carries a secret token; only its SHA-256 is stored, so
-- a database leak does not hand over live credentials, and the raw token exists
-- only in the buyer's browser and in the request that presents it.
--
-- This is deliberately STRICTER than the existing checks.claim_token, which is
-- stored raw. New surface gets the better pattern; changing the old one is a
-- separate migration with a compatibility story.

CREATE TABLE IF NOT EXISTS listing_intake (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SHA-256 of the ownership token. NEVER the token itself.
  token_hash  TEXT NOT NULL UNIQUE,

  -- Accepted for ANY legitimate https listing, including sources Paqar cannot
  -- fetch (Carlist, Facebook). A human opens those during review — storing the
  -- URL is what makes that possible, and refusing to store what we cannot fetch
  -- would discard the product's main advantage.
  listing_url TEXT,

  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'extracting', 'ready', 'converted', 'expired')),

  -- Per-field value + provenance + confidence, merged across URL extraction,
  -- screenshot OCR and buyer edits. Provenance is preserved rather than
  -- flattened: a buyer edit changes the chosen value without turning it into a
  -- verified one.
  extracted   JSONB,

  -- Set exactly once, when the intake becomes a real check.
  converted_check_id TEXT REFERENCES checks(id) ON DELETE SET NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- A converted intake names its check; an unconverted one must not.
ALTER TABLE listing_intake DROP CONSTRAINT IF EXISTS listing_intake_conversion_consistent;
ALTER TABLE listing_intake ADD CONSTRAINT listing_intake_conversion_consistent
  CHECK ((status = 'converted') = (converted_check_id IS NOT NULL));

-- One intake per check, so a double-submitted payment cannot produce two
-- checks from one intake. This is the idempotency guarantee, at the level
-- where a race is actually decided.
CREATE UNIQUE INDEX IF NOT EXISTS listing_intake_converted_check_idx
  ON listing_intake (converted_check_id)
  WHERE converted_check_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_intake_expiry_idx
  ON listing_intake (expires_at)
  WHERE status <> 'converted';

ALTER TABLE listing_intake ENABLE ROW LEVEL SECURITY;
-- No policy: service role only. Ownership is proven by presenting the token to
-- server code, not by a database role.

COMMENT ON TABLE listing_intake IS
  'Anonymous pre-check intake. Exists so screenshots and extraction can happen before a car is identified, without polluting `checks` — which is the funnel every Paqar conversion metric counts.';
COMMENT ON COLUMN listing_intake.token_hash IS
  'SHA-256 of the ownership token. The raw token is never stored or logged; a UUID alone is a name, not a credential.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Screenshots — owned by the intake, resolvable from the check after conversion
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ONE owner, not two. Keying on both intake_id and check_id would create
-- competing nullable ownership and two ways to ask the same question. The
-- reviewer resolves check -> listing_intake.converted_check_id -> screenshots,
-- which is one join and cannot disagree with itself.
CREATE TABLE IF NOT EXISTS listing_screenshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id     UUID NOT NULL REFERENCES listing_intake(id) ON DELETE CASCADE,

  -- Server-generated and random. A user-supplied filename is attacker-
  -- controlled input deciding where bytes land.
  storage_path  TEXT NOT NULL UNIQUE,

  -- Verified from BYTES, never from the upload's claimed type.
  mime_type     TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes         INTEGER NOT NULL CHECK (bytes > 0),
  width         INTEGER NOT NULL CHECK (width  > 0),
  height        INTEGER NOT NULL CHECK (height > 0),
  content_hash  TEXT NOT NULL,

  state         TEXT NOT NULL DEFAULT 'ready'
                CHECK (state IN ('quarantined', 'ready', 'rejected', 'extracted')),

  -- Per-image OCR result. Never a signed URL: that is a bearer credential, and
  -- in a column it outlives the request that justified it.
  extraction    JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  deleted_at    TIMESTAMPTZ
);

-- Same image twice is one row. Buyers screenshot the same page from two apps
-- more often than expected, and OCR is metered per image.
CREATE UNIQUE INDEX IF NOT EXISTS listing_screenshots_dedupe_idx
  ON listing_screenshots (intake_id, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS listing_screenshots_intake_idx
  ON listing_screenshots (intake_id)
  WHERE deleted_at IS NULL;

-- The cleanup sweep's only query.
CREATE INDEX IF NOT EXISTS listing_screenshots_expiry_idx
  ON listing_screenshots (expires_at)
  WHERE deleted_at IS NULL;

ALTER TABLE listing_screenshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE listing_screenshots IS
  'Privately-stored listing screenshots, owned by listing_intake. Never holds a signed URL. storage_path is server-generated and random.';
