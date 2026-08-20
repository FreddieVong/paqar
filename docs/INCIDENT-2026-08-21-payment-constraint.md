# Incident: payment webhook blocked by a migration constraint

**Severity:** production write path broken (payments could not be registered)
**Detected and resolved within the same session, before 033 was applied.**

## Window

Bounded by session events, not by a clock I can read after the fact — Postgres
does not record constraint creation time.

| Event | Marker |
|---|---|
| Start | migration 032 applied successfully (`APPLIED OK`) |
| End | `ALTER TABLE ... DROP CONSTRAINT buyer_reports_current_is_released` |

Between those two points the constraint was live. The elapsed work in between
was eight database round-trips (invariant verification, then the compatibility
probe that found it), so the window is on the order of **minutes, not hours**,
on 2026-08-21.

## What broke

Migration 032 installed:

```sql
CHECK (NOT is_current OR status <> 'paid' OR released_at IS NOT NULL)
```

A new payment is `is_current = true` (column default), `status = 'paid'` the
moment the Billplz webhook lands, and `released_at = NULL` because nobody has
reviewed it yet. That is the **normal** state of a paid report awaiting review,
and the constraint forbade it.

Effect: `UPDATE buyer_reports SET status='paid'` — the exact statement
`markReportPaid` runs — failed with a check-constraint violation. Any customer
paying in the window would have had their payment accepted by Billplz and never
registered by Paqar.

## Root cause

The constraint conflated two different situations:

- the **initial state of revision 1** (paid, unreviewed — normal), and
- the **promotion of a later revision** over one the buyer already reads (must
  be released first — the thing actually worth guarding).

Only the second needs a constraint.

## Why the rehearsal missed it

`__tests__/lib/migration-032-backfill.test.ts` simulated six CHECK constraints
against production-shaped fixtures and passed. This constraint was not among
the six: it was added later, in the revisions section, and the simulation was
never updated to match.

The rehearsal tested **what I had written down**, not what the migration
actually contained. A hand-maintained list of constraints is a copy that drifts
from its source, and it drifted.

## What found it

Simulating what the **deployed application** does — insert a pending
buyer_report, then mark it paid — against the migrated schema. Not reading the
SQL, which had already been read several times without anyone noticing.

## Fix

```sql
CHECK (NOT is_current OR revision = 1 OR released_at IS NOT NULL)
```

Revision 1 may be current while unreleased. A superseding revision may not take
over until released, which preserves the guarantee that matters: an RM88
history revision cannot silently replace a report the buyer has already read.

Verified live after correcting:

| Case | Result |
|---|---|
| paid revision 1, unreleased, current | ALLOWED — a normal payment |
| revision 2, unreleased, promoted to current | BLOCKED — the guarantee |
| revision 2, released, promoted | ALLOWED |

## Corrective measures

1. Migration file corrected; live constraint definition verified to match it
   exactly via `pg_get_constraintdef`.
2. A lifecycle regression test that runs the **actual migration SQL** rather
   than a hand-copied subset of constraints — see
   `__tests__/lib/migration-lifecycle.test.ts`. This is the specific defence
   against the drift that caused the incident.
3. The deployed-app compatibility probe becomes a required step after every
   migration, not an afterthought.

## Customer impact

See the payment-window audit in the same session. Recorded there rather than
here so the number comes from evidence rather than from this document.
