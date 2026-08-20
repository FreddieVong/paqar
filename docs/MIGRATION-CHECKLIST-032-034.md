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
