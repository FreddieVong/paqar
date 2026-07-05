-- Email leads captured from the loan calculator ("hantar kiraan ke e-mel").
-- Calculator visitors are 3-6 months pre-purchase — the email is the only way
-- to reach them when they're ready. Kept separate from model_leads because
-- those retarget emails assume a price check happened.

CREATE TABLE IF NOT EXISTS calculator_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  price_rm         INTEGER NOT NULL,
  monthly_rm       INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  retarget_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calculator_leads_email ON calculator_leads (email);

ALTER TABLE calculator_leads ENABLE ROW LEVEL SECURITY;
-- Service-role access only — no client policies.
