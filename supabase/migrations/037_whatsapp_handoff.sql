-- WhatsApp hand-off for a released report.
--
-- WHY
--
-- E-mail is the delivery channel and it is not enough. On 2026-09-12 a buyer
-- paid at 05:46; the "laporan siap" e-mail was delivered at 09:36; by 13:38
-- they had come back to the site twice and never opened it. Hotmail's junk
-- folder, most likely. In Malaysia a WhatsApp gets read.
--
-- The buyer may now leave a number on the waiting screen (stored in the
-- existing buyer_phone column, same normalisation as checkout). When the
-- report is released, the queue shows a button that opens WhatsApp with the
-- message written; the operator presses send. This column records the tap,
-- so the row can show "✓ WhatsApp dihantar 09:41" and nobody is messaged
-- twice. NULL = not yet.

ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN buyer_reports.whatsapp_sent_at IS
  'When the operator tapped "WhatsApp pembeli" for the released report. The send itself is by hand from their phone; this records the hand-off.';
