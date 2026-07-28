-- Corrective migration.
--
-- 021 used `ADD COLUMN lookup_status TEXT DEFAULT 'pending'`. Postgres applies
-- a column default to EXISTING rows, so every historical plate_lookup_cache
-- row was stamped `pending` — a status none of them were ever measured with.
--
-- That is worse than NULL: `pending` is non-terminal, so a cached row with no
-- vehicle_data would emit no lookup event at all, silently dropping the very
-- signal 021 exists to capture.
--
-- Restores those rows to NULL (legacy, outcome unknown). Rows written after
-- the migration carry a real measured status and are left alone.
--
-- The cutoff sits BETWEEN the newest pre-migration row (2026-07-28T08:28:09Z)
-- and the moment 021 was applied (2026-07-28T17:0x UTC). An earlier draft used
-- 2026-07-29T00:00:00Z, which is still in the FUTURE in UTC — a re-run would
-- have nulled genuinely new `pending` rows created in the meantime. Verified
-- against a real PostgreSQL: this cutoff spares them.
--
-- 021 has been corrected so a fresh apply never produces this state.

UPDATE plate_lookup_cache
SET    lookup_status = NULL
WHERE  lookup_status = 'pending'
  AND  fetched_at < '2026-07-28T12:00:00Z';
