-- Draf Paqar: the reviewer's boxes, pre-filled.
--
-- WHY
--
-- The RM29 product is a human reading the advert and writing a note. The note
-- is also the slowest part of each review and the easiest place to miss what
-- the numbers already show — on 2026-09-12 a real order was advertised as a
-- 2020 and registered in 2019, and the note never said so.
--
-- Code now finds the issues, a model drafts the words, a validator refuses
-- anything the facts do not support, and the result is stored HERE so the
-- queue renders it without a model call per page load. The reviewer reads,
-- edits and sends; nothing in this column reaches a buyer on its own.
--
-- review_draft_error holds the reason when there is no draft (no API key,
-- model failure, validator rejection) so the card can say why the boxes are
-- empty. Both nullable, no defaults: NULL means "not generated".

ALTER TABLE buyer_reports
  ADD COLUMN IF NOT EXISTS review_draft              JSONB,
  ADD COLUMN IF NOT EXISTS review_draft_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_draft_error        TEXT;

COMMENT ON COLUMN buyer_reports.review_draft IS
  'Draf Paqar (lib/review-draft): issues, corrections, note, finalDecision, nextAction, sellerQuestions. A starting point for the human reviewer — never sent to a buyer directly.';

COMMENT ON COLUMN buyer_reports.review_draft_generated_at IS
  'When review_draft was last written. Regenerating replaces it.';

COMMENT ON COLUMN buyer_reports.review_draft_error IS
  'Why there is no usable draft (no_api_key, model_failed: …, rejected: …). Cleared when a draft is saved. Never contains advert or buyer text.';
