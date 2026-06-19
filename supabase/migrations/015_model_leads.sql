-- Lead capture for free model-tab price checks
-- Stores email + verdict context for users who got a free verdict but didn't buy RM12 report

CREATE TABLE IF NOT EXISTS model_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  brand         text NOT NULL,
  model         text NOT NULL,
  year          text NOT NULL,
  asking_price  integer,
  verdict       text,
  listing_count integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_leads_email_idx ON model_leads (email);
CREATE INDEX IF NOT EXISTS model_leads_created_at_idx ON model_leads (created_at DESC);
