-- Scope the plate-result cache to the visitor who created it.
--
-- THE DEFECT
--
-- /api/checks reused an existing check for a plate whenever one was complete,
-- unexpired and unpaid — keyed on plate_hash ALONE, so any two visitors who
-- checked the same registration within 24 hours were handed the SAME check id
-- AND the same claim_token. The guard in place (`checkHasPaidReport`) only
-- refused to join a check that was ALREADY paid. It did nothing about the
-- reverse order, which is the order that leaks:
--
--   1. Visitor A checks WXY1234        -> check ch_1, claim_token T
--   2. Visitor A does not pay
--   3. Visitor B checks WXY1234        -> handed ch_1 and T (ch_1 is unpaid)
--   4. Visitor B pays RM12             -> buyer_reports.check_id = ch_1
--   5. Visitor A opens /laporan-pembeli/ch_1?claim_token=T
--      -> getCheck matches, getBuyerReport(ch_1) is B's PAID report
--      -> A reads the report B paid for
--
-- A could also PATCH B's asking price through
-- /api/laporan-pembeli/{checkId}/asking-price, which authorises on the same
-- shared token.
--
-- THE FIX
--
-- Reuse is now additionally scoped to the paqar_sid session cookie, so a check
-- is only ever handed back to the visitor who created it. Two strangers
-- checking the same plate get two checks, two tokens, and no shared
-- entitlement.
--
-- Nullable, and NULL never matches: pre-existing rows carry no session and are
-- therefore never reused by anyone. That is the safe direction — the only cost
-- is one extra row the first time an old plate is re-checked.
--
-- This does NOT touch the cache that actually costs money. Vehicle lookups are
-- deduplicated by plate_lookup_cache, keyed on the plate hash and shared by
-- everyone, so a second visitor still never triggers a second paid RegCheck
-- call. Only the entitlement-bearing row is scoped.
-- SAFETY
--
-- Additive and reversible. Nullable TEXT with NO DEFAULT, which in PostgreSQL
-- is a catalogue-only change: no table rewrite, no backfill, an ACCESS
-- EXCLUSIVE lock held for microseconds.
--
-- The absence of a DEFAULT is deliberate and is the lesson of migration 021,
-- which added lookup_status with DEFAULT 'pending' and thereby stamped every
-- historical row with a status it had never been measured with — 022 had to
-- undo it. Here, existing rows must be NULL: NULL means "no owning session",
-- and getCachedCheck refuses to reuse those rows for anybody. Backfilling any
-- value would hand old checks to whichever visitor matched it.
--
-- Both statements are IF NOT EXISTS, so re-running is a no-op.
--
-- TO REVERSE:
--   DROP INDEX IF EXISTS checks_plate_session_idx;
--   ALTER TABLE checks DROP COLUMN IF EXISTS session_id;
-- Nothing else reads the column, and no other column's data depends on it.
-- Note that reversing is only needed if the COLUMN itself causes a problem:
-- rolling the application back to the previous release requires no migration
-- change at all, because the old code never references session_id.
ALTER TABLE checks
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Supports the reuse lookup: (plate_hash, session_id) filtered by status and
-- expiry, newest first.
--
-- Plain CREATE INDEX, not CONCURRENTLY. CONCURRENTLY cannot run inside a
-- transaction block, which is how migrations are applied, and it would buy
-- nothing here: `checks` holds 245 rows as of 2026-08-09, so the build is
-- sub-millisecond and the SHARE lock that briefly blocks writes is not
-- observable. Revisit only if this table reaches six figures.
--
-- Partial on session_id IS NOT NULL: the rows the query can never match are
-- also the majority of historical rows, so excluding them keeps the index
-- proportional to new traffic rather than to table size.
CREATE INDEX IF NOT EXISTS checks_plate_session_idx
  ON checks (plate_hash, session_id, created_at DESC)
  WHERE deleted_at IS NULL AND session_id IS NOT NULL;

COMMENT ON COLUMN checks.session_id IS
  'paqar_sid of the visitor who created this check. Reuse of a cached check is scoped to a matching session so a claim_token is never shared between two visitors — see migration 027. NULL on rows predating the column; NULL is never reused.';
