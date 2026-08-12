# Runbook — repointing the Meta operator at the live experiment

**Status: PREPARED, NOT EXECUTED. Production freeze is active.**
Nothing in this document has been run. No code was pushed, no Meta object was
touched, and `meta_ads_experiment` was not written.

Prepared 2026-08-12 on branch `fix/meta-experiment-reporting`.

---

## What this deploys

Two defects, fixed together because deploying either alone leaves a bad state:

1. **Reporting described a dead campaign.** `ACTIVE_CAMPAIGN` pointed at
   `carlist_vs_mudah_aug26` (stopped 2026-08-12 01:54 UTC) while the live
   experiment was `creative_test_aug26`. Both live arms reported zero.
2. **The tracking detector auto-paused on a false comparison.** It compared
   Meta's **lifetime** landing-page views against Paqar's **rolling 24-hour**
   count. Once a campaign finished, that comparison could never stop being true.

## The invariant that makes the order safe

After this deploy, `resolveActiveExperiment()` compares
`ACTIVE_CAMPAIGN.metaCampaignId` (code) against
`meta_ads_experiment.meta_campaign_id` (database).

- **They disagree →** the operator does nothing at all. No Meta reads, no
  snapshots, no pause. It records `experiment_incoherent` and the admin page
  shows an amber banner.
- **Reporting is unaffected either way** — it reads `ACTIVE_CAMPAIGN` directly,
  so the dashboard and daily email are correct the moment the code is live.

This is what removes the dangerous window. Between the code deploy and the
database update, the live campaign is **not** connected to any detector, broken
or otherwise, because an incoherent configuration disables the operator
entirely. There is no ordering in which the live campaign meets the old
detector.

Throughout, Meta's **RM625 account spending limit** remains the primary
protection and is independent of all of this.

---

## Step 1 — Deploy the code FIRST

```bash
git checkout fix/meta-experiment-reporting
git push -u origin fix/meta-experiment-reporting
# open PR against main, merge, let Vercel deploy production
```

**Do not update the database first.** Doing so would hand the live campaign to
the *old* detector, which would compare its lifetime figures against a rolling
window — the exact fault being fixed.

### Verify the deploy before touching anything else

Open `/admin/ads`:

- [ ] Amber banner: **"OPERATOR DISABLED — configuration incoherent"**
- [ ] `Active campaign (UTM)` reads `creative_test_aug26`
- [ ] `Config coherence` reads `INCOHERENT — operator disabled`
- [ ] The funnel figures are **non-zero** and match the arms
      (`creative_b_aug26`, `mudah_carousel_aug26`)

Seeing the banner is the success condition, not a problem: it proves the
coherence gate is live and the operator is standing down.

---

## Step 2 — Pre-write values to verify

Before writing anything, confirm the row you are about to change.

```sql
-- Expect exactly one row.
select id,
       meta_campaign_id,
       meta_adset_id,
       creative_a_ad_id,
       creative_b_ad_id,
       status,
       launched_at,
       stopped_at,
       opening_spend_cents,
       graphic_ads_started_at
from meta_ads_experiment
order by created_at asc;
```

Expected **current** values (verified read-only 2026-08-12 14:24 MYT):

| Column | Current value |
|---|---|
| `id` | `56a934d0-38a3-4f08-96b0-f7c236637853` |
| `meta_campaign_id` | `120248230297470438` (Carlist — finished) |
| `meta_adset_id` | `120248239158460438` |
| `creative_a_ad_id` | `120248239319430438` |
| `creative_b_ad_id` | `120248239320220438` |
| `status` | `paused_by_operator` |
| `stopped_at` | `2026-08-12T01:54:06.277+00:00` |
| `opening_spend_cents` | `17430` |

**If `meta_campaign_id` is not `120248230297470438`, STOP.** Someone else has
changed the row; re-read this runbook against the actual state first.

Target Meta objects (verified read-only against the Graph API, same timestamp):

| Object | Id | State |
|---|---|---|
| Campaign `PAQAR_Creative_Test_Aug26_v2` | `120248441368300438` | ACTIVE |
| Ad set `Creative_Test_Control` | `120248441368430438` | ACTIVE, RM90 lifetime |
| Ad set `Creative_Test_Mudah` | `120248441369560438` | ACTIVE, RM90 lifetime |
| Ad `creative_b_aug26` | `120248441369150438` | ACTIVE |
| Ad `mudah_carousel_aug26` | `120248441369870438` | ACTIVE |

> **Never use `120248437132210438`.** That is the abandoned v1 campaign. It
> never delivered, and its ads carry UTM tags **identical** to v2, so activating
> or referencing it would make two cohorts indistinguishable in `ad_events`.

`meta_adset_id` holds a single ad set but this experiment has two. Record the
**Control** ad set; nothing in the operator path reads it for a spend decision,
and the campaign-level id is what governs pause and spend.

---

## Step 3 — The database update

Supabase migrations are manual here: paste into the dashboard SQL editor.

```sql
update meta_ads_experiment
set meta_campaign_id  = '120248441368300438',
    meta_adset_id     = '120248441368430438',
    creative_a_ad_id  = '120248441369150438',  -- slot 1 → creative_b_aug26
    creative_b_ad_id  = '120248441369870438',  -- slot 2 → mudah_carousel_aug26
    status            = 'enabled',
    stopped_at        = null,
    launched_at       = '2026-08-12T04:00:00+00:00',  -- 12:00 MYT, campaign start
    graphic_ads_started_at = null,
    updated_at        = now()
where id = '56a934d0-38a3-4f08-96b0-f7c236637853'
  and meta_campaign_id = '120248230297470438';   -- optimistic lock
```

The `and meta_campaign_id = ...` clause is the safety: if the row already moved,
the update affects **0 rows** instead of overwriting someone else's change.
Confirm the editor reports `UPDATE 1`.

Notes on the individual columns:

- `status`/`stopped_at` — the row still carries the false `tracking_broken`
  pause from 2026-08-12 01:54. Left as-is, the new "already stopped" guard would
  correctly refuse to supervise the live campaign forever.
- `launched_at` — drives the daily report's day number. The v2 campaign started
  12:00 MYT = 04:00 UTC on 2026-08-12.
- `graphic_ads_started_at` — a cutoff for the *previous* creative swap. Null,
  because this campaign's tags (`*_aug26`) are new and cannot collide with
  history.
- `opening_spend_cents` — **do not touch.** It is the spend floor for
  reconciliation; changing it double-counts. See `reconcileBudget()`.

### Alternative: the admin UI path (runs preflight)

The SQL above is the exact, auditable change. The equivalent through the UI also
runs `runPreflight()` against the new objects, which is worth having:

1. `/admin/ads` → **Save Meta IDs** with the five ids from the table above.
2. Review the preflight result. It now expects `utm_campaign=creative_test_aug26`
   and the `*_aug26` creative tags, so it should pass against the v2 ads —
   whereas against the old Carlist ads it would correctly fail.
3. **Enable operator after preflight.**

Note this path sets `status='enabled'` but preserves any existing `launched_at`
(`experiment.launched_at ?? now`), so if the day number in the daily report
matters, still set `launched_at` explicitly with the SQL above. It also does not
clear `stopped_at`, which the detector gate reads — so clear that in SQL either
way.

### Do NOT run

```sql
-- WRONG: v1 is abandoned and its UTMs collide with v2.
update meta_ads_experiment set meta_campaign_id = '120248437132210438';
```

---

## Step 4 — Post-write verification

**4a. The banner clears.** Reload `/admin/ads`:

- [ ] Amber incoherence banner is **gone**
- [ ] `Config coherence` reads `OK`
- [ ] `Campaign spend (Meta)` shows a real figure for the v2 campaign
- [ ] Both live arms appear under "Active creatives" with non-zero numbers
- [ ] Retired creatives still show their historical numbers (they are now read
      under their own campaigns, not the active one)

**4b. Confirm the row.**

```sql
select meta_campaign_id, status, stopped_at, launched_at
from meta_ads_experiment
where id = '56a934d0-38a3-4f08-96b0-f7c236637853';
-- expect 120248441368300438 / enabled / null / 2026-08-12 04:00+00
```

**4c. Exercise the operator once, deliberately.**

```bash
curl -sS -H "authorization: Bearer $ADS_OPERATOR_CRON_SECRET" \
  https://paqar.my/api/cron/meta-ads | jq
```

Expected: `ok: true`, a real `spendCents`, and **no** `skipped` field.

- [ ] Response contains **no** `"skipped": "experiment_incoherent"`
- [ ] Response contains **no** `"rule": "tracking_broken"`

**4d. Confirm the false positive is dead.**

```sql
select occurred_at, rule, action, response_summary
from meta_ads_actions
order by occurred_at desc
limit 10;
```

- [ ] No new `tracking_broken` row
- [ ] If any `tracking_*` row appears, its evidence names a date and
      `Asia/Kuala_Lumpur` — never the phrase "last 24h"

**4e. Sanity-check the numbers against Ads Manager.** The detector now reports a
named calendar day, so the Meta figure in any evidence string can be checked
directly in Ads Manager with the date filter set to that day.

---

## Rollback

**Rollback is safe at every point, and never requires touching Meta.**

### If Step 1 (code) looks wrong
Revert the deploy in Vercel ("Promote" the previous production deployment), or:

```bash
git revert -m 1 <merge-commit-sha>
git push
```
The database is untouched at this point, so this fully restores the prior state.

### If Step 3 (database) looks wrong
Restore the row exactly:

```sql
update meta_ads_experiment
set meta_campaign_id  = '120248230297470438',
    meta_adset_id     = '120248239158460438',
    creative_a_ad_id  = '120248239319430438',
    creative_b_ad_id  = '120248239320220438',
    status            = 'paused_by_operator',
    stopped_at        = '2026-08-12T01:54:06.277+00:00',
    launched_at       = '2026-07-26T15:36:40.229+00:00',
    graphic_ads_started_at = '2026-08-03T16:35:41+00:00',
    updated_at        = now()
where id = '56a934d0-38a3-4f08-96b0-f7c236637853';
```

This returns the configuration to incoherent, which **disables the operator** —
a safe resting state, not a broken one. Reporting stays correct.

### Emergency stop, independent of all of the above
1. Set `kill_switch = true` on the experiment row — short-circuits the cron
   before any Meta call.
2. Pause the campaign by hand in Ads Manager.
3. Meta's RM625 account spending limit is the backstop and depends on none of
   this code.

---

## Why there is no dangerous window

| Point in time | Live campaign supervised by | Reporting |
|---|---|---|
| Before deploy | nothing (operator watches the finished Carlist campaign) | wrong campaign |
| After Step 1, before Step 3 | **nothing — operator disabled by incoherence** | **correct** |
| After Step 3 | the **fixed** detector | correct |

The live campaign is never connected to the old detector, in any ordering.
The one property that must hold — deploy code before touching the row — is the
only sequencing requirement in this document.

---

## Not part of this runbook

- **Do not activate campaign `120248437132210438`** (abandoned v1). Its UTMs
  collide with v2.
- **Do not change any budget, targeting, ad or campaign status** to complete
  this work. Nothing here requires it.
- **Do not declare a creative winner.** As of 2026-08-12 14:24 MYT the test had
  run 2h24m on RM12.45 of RM180, and the Mudah arm's four `valuation_started`
  came from two sessions. That is insufficient data, not a result.
