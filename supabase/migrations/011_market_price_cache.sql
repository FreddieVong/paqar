-- Cache for Mudah market listing prices, keyed by make+model+year
-- Refreshed every 7 days per model to keep scraping volume low

CREATE TABLE IF NOT EXISTS market_price_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make       text NOT NULL,
  model      text NOT NULL,
  year       text NOT NULL,
  listings   jsonb NOT NULL DEFAULT '[]',
  search_url text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(make, model, year)
);
