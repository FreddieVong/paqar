-- Ensures each user has at most one non-deleted entry per document type.
-- Required for upsert on (user_id, document_type).
create unique index document_expiries_user_type_unique
  on document_expiries(user_id, document_type)
  where deleted_at is null;
