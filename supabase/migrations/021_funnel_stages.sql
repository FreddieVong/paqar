-- Valuation funnel diagnosis.
--
-- Two problems this fixes:
--
-- 1. valuation_started fires from three entry points but valuation_completed
--    can only fire on one of them (the report path renders the teaser; the
--    other two never do). Reporting them together produced an 8.7% completion
--    rate that was mostly an artefact. valuation_path makes the funnel
--    readable per path; journey_id makes counts unique per SUBMISSION, so a
--    user checking three cars counts three times while retries of one
--    submission count once.
--
-- 2. plate_lookup_cache had no status, so "no vehicle" was inferred from
--    vehicle_data IS NULL — which cannot distinguish a genuine not-found from
--    a pending row or a failed write. lookup_status records the terminal
--    outcome explicitly.
--
-- Historical rows are deliberately left NULL. Back-filling a path from a
-- check_id (which is shared between visitors via the plate-hash cache) or a
-- status from an ambiguous null would manufacture data that was never
-- measured. NULL reports as legacy/unknown.

ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS valuation_path TEXT;
ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS journey_id     TEXT;
ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS error_stage    TEXT;
ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS error_code     TEXT;

-- Per-path funnel reads, and unique-journey counting within a path.
CREATE INDEX IF NOT EXISTS idx_ad_events_path_journey
  ON ad_events (valuation_path, journey_id)
  WHERE valuation_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_events_error
  ON ad_events (error_stage, error_code)
  WHERE error_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Explicit terminal status for a plate lookup.
--
-- New rows start `pending`. The terminal status is written in the SAME update
-- as its payload — `found` together with vehicle_data, a failure together with
-- its error_code — so a row can never claim `found` while holding no vehicle
-- data. Events are emitted only from a terminal status, never from `pending`.
--
-- Finer distinctions (network_error, malformed_response, database_error) live
-- in error_code rather than multiplying statuses.
-- ---------------------------------------------------------------------------
-- Added WITHOUT a default first, then the default set separately.
-- `ADD COLUMN ... DEFAULT` applies the default to EXISTING rows too, which
-- would stamp every historical row `pending` — a status it was never measured
-- with, and worse than NULL because `pending` is non-terminal and suppresses
-- the event entirely. Splitting the statements leaves history NULL and applies
-- the default only to rows inserted from here on.
ALTER TABLE plate_lookup_cache ADD COLUMN IF NOT EXISTS lookup_status TEXT;
ALTER TABLE plate_lookup_cache ALTER COLUMN lookup_status SET DEFAULT 'pending';
ALTER TABLE plate_lookup_cache ADD COLUMN IF NOT EXISTS error_code    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plate_lookup_cache_status_values'
  ) THEN
    ALTER TABLE plate_lookup_cache
      ADD CONSTRAINT plate_lookup_cache_status_values
      CHECK (lookup_status IS NULL OR lookup_status IN (
        'pending', 'found', 'not_found', 'provider_timeout', 'provider_error'
      ));
  END IF;
END $$;

-- NULL is permitted by the constraint solely so pre-existing rows remain
-- valid as legacy. Nothing written from here on leaves it NULL.
