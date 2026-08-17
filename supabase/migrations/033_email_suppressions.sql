-- Who has told Paqar to stop e-mailing them.
--
-- WHY THIS EXISTS
--
-- Until now there was no way to say no. The retarget e-mail carried no opt-out
-- of any kind, and eight people had already received it. The privacy notice
-- says an address is collected "apabila anda membuat akaun atau membuat
-- pembayaran" — but captureLeadOnBlur stores it the moment a valid-looking
-- address loses focus, before either has happened. Adding the link without
-- somewhere to record the answer would have been theatre.
--
-- NORMALISED EMAIL AS THE KEY, not a user id: the people this protects mostly
-- have no account. Lowercased and trimmed by the caller so "A@x.com " and
-- "a@x.com" cannot both be stored and half-honoured.
--
-- NO DELETE PATH BY DESIGN. A suppression is only ever added. Re-subscribing
-- is a deliberate act that should go through a person, not a row edit.
CREATE TABLE IF NOT EXISTS email_suppressions (
  email        TEXT PRIMARY KEY,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Which surface recorded it. Low-cardinality and free of anything private.
  source       TEXT NOT NULL DEFAULT 'unsubscribe_link'
);

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
-- Service-role only, like every other table here. The unsubscribe route runs
-- server-side; nothing client-side may read who has opted out.

COMMENT ON TABLE email_suppressions IS
  'Addresses that must never be e-mailed again. Checked by every send path; a check that errors must fail CLOSED and skip the send.';
