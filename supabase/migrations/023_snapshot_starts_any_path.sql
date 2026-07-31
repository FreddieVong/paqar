-- Snapshots recorded only report-path valuation starts, but the landing-page
-- and creative-cost rates are computed against ALL landing sessions. Dividing
-- a path-filtered numerator by an unfiltered denominator reported a landing
-- page converting at ~42% as "4.6% — the page is not delivering what the ad
-- promised", and the daily email recommended rewriting a headline that was
-- working.
--
-- Nullable on purpose. Snapshots taken before this column existed genuinely do
-- not know their all-paths count, and a DEFAULT would silently invent one --
-- the same mistake migration 021 made with lookup_status, which 022 had to
-- undo. Readers fall back to valuation_started and label the row as legacy.
ALTER TABLE meta_ads_snapshots
  ADD COLUMN IF NOT EXISTS valuation_started_any_path INTEGER;

COMMENT ON COLUMN meta_ads_snapshots.valuation_started_any_path IS
  'Unique valuation journeys started on ANY path (plate_report, model_price, plate_check). Pairs with paqar_landing_views for landing-page and cost-per-start rates. NULL on snapshots predating this column.';
