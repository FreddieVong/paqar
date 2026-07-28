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
-- the migration carry a real measured status and are left alone. The cutoff is
-- conservative: only rows fetched before 021 was applied.
--
-- 021 has been corrected so a fresh apply never produces this state.

UPDATE plate_lookup_cache
SET    lookup_status = NULL
WHERE  lookup_status = 'pending'
  AND  fetched_at < '2026-07-29T00:00:00Z';
