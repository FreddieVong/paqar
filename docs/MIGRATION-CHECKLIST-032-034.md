# Applying migrations 032 → 034

**None of these are applied anywhere.** Apply in order, in the Supabase SQL
Editor of project `eqkqpavasxihhtcugenm`. `supabase db push` does not work on
this project — paste the file contents.

Apply the **database first, then deploy the application.** All three are
backward-compatible with the currently deployed code: it never reads the new
columns or tables, and the only non-additive change (dropping two NOT NULLs) is
a widening.

---

## Order and content

| # | File | Adds |
|---|---|---|
| 032 | `032_concierge_review.sql` | review/refund state machine on `buyer_reports`, `report_state_transitions`, intake columns on `checks`, plate NOT NULL dropped, legacy backfill |
| 033 | `033_screenshot_storage_policies.sql` | scoped storage policy, `report_feedback` decision-impact columns |
| 034 | `034_listing_intake.sql` | `listing_intake`, `listing_screenshots` |

034 references `checks(id)`, which 032 alters — so the order matters.

---

## Live audit — read-only, 2026-08-21

Taken from the production database before anything was applied. These numbers
decide whether the migration is safe, and they are what the backfill rehearsal
in `__tests__/lib/migration-032-backfill.test.ts` is built on.

| Fact | Value | Why it matters |
|---|---|---|
| `buyer_reports` rows | 70 (27 paid, 43 pending, 0 expired) | 27 rows the backfill touches |
| paid rows with NULL `paid_at` | **0** | `COALESCE` never reaches `now()`; back-dating is deterministic |
| paid rows with NULL `created_at` | 0 | second fallback also unused |
| `amount_cents` values present | 100, 1200, 1900, 10000 | no 2900 yet — RM29 is not deployed |
| `checks` rows | 643, **0** with NULL `plate_encrypted` | `DROP NOT NULL` is a pure widening; no existing row changes |
| `checks` with NULL `session_id` | 246 | pre-027 rows; unaffected |
| `report_feedback` rows | 11, **0** with NULL `helpful` | the rollback's `SET NOT NULL` would currently succeed |
| `listing_intake` / `listing_screenshots` / `report_state_transitions` | absent | 034 and 032 genuinely unapplied |
| `buyer_reports.review_status` / `released_at` / `purchaser_id` / `revision` | absent | 032 genuinely unapplied |

Foreign-key types verified: `buyer_reports.id` is `uuid` and `checks.id` is
`text`, matching the `UUID` and `TEXT` references declared in 032/033/034.

**One oddity worth a look, unrelated to migrating:** `amount_cents` includes a
row at **100** (RM1). Migration 003 set the column default to 1900 (RM19), which
explains those. Neither blocks anything; flagged because a RM1 paid row will be
back-filled as a released report like any other.

## Before applying

Confirm the current live policy state, since 033 replaces policies applied by
hand in an earlier session:

```sql
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
```

Expect two rows named `listing-screenshots: no anon read` / `… no anon write`,
both **PERMISSIVE**. If either says **RESTRICTIVE**, stop and report it — the
analysis behind 033 assumed permissive, and a restrictive one would already be
denying more than intended.

Also confirm nothing has changed since the audit:

```sql
SELECT count(*) FILTER (WHERE status='paid')                        AS paid,
       count(*) FILTER (WHERE status='paid' AND paid_at IS NULL)    AS paid_no_timestamp
FROM buyer_reports;
-- expected: paid = 27, paid_no_timestamp = 0
-- If paid_no_timestamp > 0, the backfill will use created_at for those rows.
-- Still correct, just no longer the rehearsed path.

SELECT count(*) FROM checks WHERE plate_encrypted IS NULL;   -- expected 0
```

---

## After each file

**After 032** — the backfill is the risky part:

```sql
-- Zero rows expected. Any result means the backfill left an unreadable order.
SELECT count(*) FROM buyer_reports
WHERE status='paid' AND review_status='released' AND released_at IS NULL;

-- Historical paid orders should now read as released.
SELECT review_status, count(*) FROM buyer_reports WHERE status='paid'
GROUP BY review_status;
```

**After 033:**

```sql
-- Exactly one row, RESTRICTIVE, roles {anon,authenticated}, scoped.
SELECT policyname, cmd, permissive, roles, qual FROM pg_policies
WHERE schemaname='storage' AND tablename='objects';
```

**After 034:**

```sql
SELECT tablename FROM pg_tables
WHERE tablename IN ('listing_intake','listing_screenshots');   -- 2 rows
```

---

## Rollback

Backward in reverse order. **034 and 033 are clean; 032 is not.**

**034** — safe, drops only new tables:
```sql
DROP TABLE IF EXISTS listing_screenshots;
DROP TABLE IF EXISTS listing_intake;
```

**033** — restores the previous (no-op) policies:
```sql
DROP POLICY IF EXISTS "listing_screenshots_deny_client_roles" ON storage.objects;
ALTER TABLE report_feedback
  DROP COLUMN IF EXISTS decision_impact,
  DROP COLUMN IF EXISTS buyer_report_id,
  DROP COLUMN IF EXISTS revision,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE report_feedback ALTER COLUMN helpful SET NOT NULL;   -- fails if any NULL exists
```

**032 — NOT CLEANLY REVERSIBLE.** The backfill overwrites `review_status`,
`released_at` and `reviewer_note` on historical rows, and the previous values
are not recorded anywhere. Dropping the columns discards that data
irreversibly; it does not restore a prior state, because there was none.

Restoring the plate NOT NULLs also fails outright once any plateless check
exists — which happens as soon as the new intake flow runs.

**So take a backup before 032, and treat rollback as restore-from-backup rather
than a DOWN migration.** Supabase → Database → Backups.

### Exactly what must be backed up

The irreversible loss is confined to two tables. A full project backup is
simplest, but if you want a targeted safety net, these two capture everything
032 overwrites or widens:

```sql
CREATE TABLE backup_buyer_reports_pre032 AS SELECT * FROM buyer_reports;
CREATE TABLE backup_checks_pre032        AS SELECT * FROM checks;
```

70 and 643 rows respectively — seconds to run, trivial to keep.

`report_feedback` (11 rows) is only touched by 033, which IS cleanly
reversible, so it needs no snapshot. Storage objects are untouched by all three
migrations.

To restore `buyer_reports` after a failed 032:

```sql
-- Only meaningful if 032's columns still exist; drop them first if rolling back fully.
UPDATE buyer_reports b SET
  status = k.status, paid_at = k.paid_at, updated_at = k.updated_at
FROM backup_buyer_reports_pre032 k WHERE b.id = k.id;
```

---

## Not in this checklist

`vercel.json` is unchanged. The screenshot-cleanup cron is **not scheduled** —
adding it is a deployment decision. Until it is, run it manually:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://paqar.my/api/cron/screenshot-cleanup
```

---

## Standing caveat

**Migration 033's policy has never been verified against live infrastructure.**
The security matrix run in previous sessions tested the OLD hand-applied
policies. The restrictive scoped policy is reasoned about and unit-tested, and
its behaviour against the real bucket is unproven until 033 is applied and the
matrix re-run.
