-- Track retarget emails sent to model-tab lead captures
ALTER TABLE model_leads ADD COLUMN IF NOT EXISTS retarget_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS model_leads_retarget_idx ON model_leads (retarget_sent_at, created_at);
