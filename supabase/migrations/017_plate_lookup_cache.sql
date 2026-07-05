-- Plate → vehicle data lookup cache.
-- Each RegCheck API call costs money (RM0.81), and a car's make/model/year
-- never changes — so cache lookups permanently, keyed by plate hash (the
-- plaintext plate is never stored). A row with NULL vehicle_data records a
-- lookup that found nothing, so we don't pay repeatedly for unknown plates.

CREATE TABLE IF NOT EXISTS plate_lookup_cache (
  plate_hash   TEXT PRIMARY KEY,
  vehicle_data JSONB,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plate_lookup_cache ENABLE ROW LEVEL SECURITY;
-- Service-role access only — no client policies.
