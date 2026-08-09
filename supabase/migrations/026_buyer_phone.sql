-- Phone number captured at checkout, for follow-up.
--
-- WHY
--
-- Four strangers generated a Billplz bill in July and abandoned it. Following
-- them up was only possible by email, because Billplz recorded mobile=none on
-- every one. In Malaysia WhatsApp reaches people that email does not, and the
-- reply rate difference is large enough to matter when the entire warm list is
-- four people.
--
-- Nullable, and the field is OPTIONAL in the form. Checkout currently converts
-- roughly 1% of paywall views; a required field would trade a real sale for a
-- follow-up channel, which is the wrong way round.
ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

COMMENT ON COLUMN buyer_reports.buyer_phone IS
  'Normalised Malaysian mobile (60XXXXXXXXX) captured at checkout, or NULL. Optional by design — never block a payment for it.';
