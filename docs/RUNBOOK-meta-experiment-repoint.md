# Runbook — deploying the Meta reporting fix

**Status: PREPARED, NOT EXECUTED.**
**Decision: production stays frozen until the Meta experiment ends.**
**Amended 2026-08-13: one scoped exception. See "Amendment" below.**

---

## Amendment — 2026-08-13, scoped unfreeze (plate-lookup retry only)

**Decision by Freddie Vong, 2026-08-13 ~13:47 MYT.** Recorded before any step
was taken, as Path A requires.

**What is unfrozen:** the plate-lookup retry on branch
`fix/plate-lookup-retry`, branched from `main` so it carries nothing else.

**What stays frozen:** this runbook's own subject. `108e100` and `7ebacd5` —
the Meta reporting fix and this document — remain unmerged. The campaign is
still `ACTIVE`, so Path B remains the expected path and nothing here has been
executed.

**Why the exception was made:** 16 of the last 116 plate lookups failed (13.8%)
— 13 `provider_timeout`, 3 `provider_error` — and 3 of 8 on 2026-08-12, the
first day of paid traffic. Each is a buyer who had already typed a plate, so
the ad spend was already committed. Waiting until 19 Aug means six more days of
paying for journeys that die after the click.

**The cost of the exception, stated plainly:** the retry raises lookup success
for BOTH arms, so it does not bias the creative comparison. It does move the
campaign's absolute funnel numbers partway through the flight. When reading the
final result on 19 Aug, treat 12–13 Aug as a different regime from 13–19 Aug
for any absolute rate; the arm-vs-arm comparison is unaffected.

**Build verification:** the local production build could not be run — killed
with exit 137 (OOM) on four attempts, on a 6.5GB machine with no swap. This is
the same constraint this runbook already records as "passes in CI or on a
higher-memory machine". Vercel's build is therefore the gate. Local evidence:
1702 tests pass, `tsc --noEmit` 0 app-code errors, `next lint` clean.

**Deployment timestamp:** see "Deployment log" at the end of this document.

Nothing in this document has been run. No code was pushed, no Meta object was
touched, and `meta_ads_experiment` was not written.

Prepared 2026-08-12 on branch `fix/meta-experiment-reporting` (commit `108e100`).
Amended 2026-08-12 to reflect the freeze decision.

---

## The decision this runbook now encodes

The earlier draft of this document proposed setting `status='enabled'` and
clearing `stopped_at` so the operator would supervise the v2 campaign after
deployment. **That was wrong and has been removed.**

Production is frozen until the experiment ends, which means deployment happens
*after* the campaign has finished. A finished experiment must never be
reactivated or supervised as though it were live: enabling the operator against
it would restart daily supervision of a campaign that is over, and clearing
`stopped_at` would erase the record of when it stopped.

**The expected path therefore requires no database write at all.** See Path B.

---

## What this deploys

Two defects, fixed together because deploying either alone leaves a bad state:

1. **Reporting described a dead campaign.** `ACTIVE_CAMPAIGN` pointed at
   `carlist_vs_mudah_aug26` (stopped 2026-08-12 01:54 UTC) while the live
   experiment was `creative_test_aug26`. Both arms reported zero.
2. **The tracking detector auto-paused on a false comparison.** It compared
   Meta's **lifetime** landing-page views against Paqar's **rolling 24-hour**
   count. Once a campaign finished, that comparison could never stop being true.

## The invariant that makes every path safe

After this deploy, `resolveActiveExperiment()` compares
`ACTIVE_CAMPAIGN.metaCampaignId` (code) against
`meta_ads_experiment.meta_campaign_id` (database).

- **They disagree →** the operator does nothing at all. No Meta reads, no
  snapshots, no pause. It records `experiment_incoherent` and `/admin/ads`
  shows an amber banner.
- **Reporting is unaffected either way** — it reads `ACTIVE_CAMPAIGN` directly,
  so the dashboard is correct the moment the code is live.

This is what makes the frozen path safe. The production row names the old
Carlist campaign, so after deploying the code the configuration is **incoherent
by construction** and the operator is disabled without anyone having to disable
it. Leaving the row untouched is not neglect — it is the mechanism.

Throughout, Meta's **RM625 account spending limit** remains the primary
protection and is independent of all of this.

---

## Which path applies

Check the campaign before doing anything:

```bash
curl -s -G "https://graph.facebook.com/v21.0/120248441368300438" \
  --data-urlencode "access_token=$META_SYSTEM_USER_ACCESS_TOKEN" \
  --data-urlencode "fields=id,name,status,effective_status,start_time,stop_time" | jq
```

| `effective_status` | Path |
|---|---|
| `ACTIVE` | **Path A** — reference only, requires explicit authorization |
| `PAUSED` / `CAMPAIGN_PAUSED` / `COMPLETED` / `ARCHIVED` | **Path B** — the expected path |

As of 2026-08-12 17:16 MYT the campaign was `ACTIVE`, scheduled
`2026-08-12T12:00:00+0800` → `2026-08-19T12:00:00+0800`. Under the freeze,
deployment is expected on or after that end time, so **Path B is the expected
path** and Path A should not be used without a separate decision.

---

# PATH A — experiment still active

> **REFERENCE ONLY. DO NOT EXECUTE WITHOUT EXPLICIT AUTHORIZATION.**
>
> This path deploys code and repoints the database while the campaign is still
> spending, so that the live experiment gains a working hard stop. It is
> documented because it may become the right call if something goes wrong
> mid-flight — for example if the account cap is approached and an automated
> backstop is wanted.
>
> It contradicts the current freeze decision. Using it requires a named
> decision to unfreeze, recorded before any step is taken.

If authorized, the sequence is: deploy the code first; verify the incoherence
banner appears; then repoint the row to the v2 objects with an optimistic lock
(`and meta_campaign_id = '120248230297470438'`), setting `status='enabled'`,
`stopped_at=null`, `launched_at='2026-08-12T04:00:00+00:00'`; then verify the
operator runs clean via one manual cron call.

Object ids for that repoint are in the reference table below. The ordering rule
is identical to Path B: **code first, always** — repointing the database before
the code is deployed hands the live campaign to the *old* detector, which is the
fault being fixed.

Do not use this path merely because the campaign happens to still be running
when you reach this document. The default is to wait.

---

# PATH B — experiment finished (EXPECTED PATH)

The campaign has reached its end time or been paused. Goal: get correct
reporting deployed, capture the result, and leave the operator disabled.

**Path B requires no database write.** Steps B1–B5 include no `update`
statement, by design.

## B1. Capture final Meta results

Do this **before** deploying, and keep the output. After deployment the operator
stays disabled, so no further snapshots or daily report emails will be written
(see B5) — this capture is the durable Meta-side record.

```bash
curl -s -G "https://graph.facebook.com/v21.0/120248441368300438/insights" \
  --data-urlencode "access_token=$META_SYSTEM_USER_ACCESS_TOKEN" \
  --data-urlencode "fields=ad_id,ad_name,adset_name,spend,impressions,reach,clicks,cpm,actions" \
  --data-urlencode "level=ad" \
  --data-urlencode "date_preset=maximum" \
  --data-urlencode "limit=50" | jq
```

`date_preset=maximum` is correct **here** — the campaign is over, so lifetime is
the final total. It is only wrong inside the detector, where it was compared
against a rolling window.

Record per arm: spend, impressions, reach, clicks, `link_click`,
`landing_page_view`, and the `offsite_conversion.custom.1785260352473011` count.

- [ ] Meta figures captured and saved outside the ad account

## B2. Capture final Paqar results

Run in the Supabase SQL editor. This mirrors `getFunnelCounts()` de-duplication:
landing visits are unique per session, journey stages unique per journey.

```sql
with ev as (
  select *
  from ad_events
  where utm_campaign = 'creative_test_aug26'
    and utm_medium   = 'paid_social'
    and utm_source in ('meta','fb','ig','an','msg','{{site_source_name}}')
)
select
  utm_content as arm,
  count(distinct session_id)
    filter (where event_name = 'landing_page_view')            as landing_visits,
  count(distinct coalesce(check_id, journey_id, id::text))
    filter (where event_name = 'valuation_started')            as started_any_path,
  count(distinct coalesce(check_id, journey_id, id::text))
    filter (where event_name = 'valuation_started'
              and valuation_path = 'plate_report')             as started_report_path,
  count(distinct coalesce(check_id, journey_id, id::text))
    filter (where event_name = 'paywall_viewed')               as paywall_viewed,
  count(distinct coalesce(check_id, journey_id, id::text))
    filter (where event_name = 'valuation_completed')          as completed,
  count(*) filter (where event_name = 'purchase')              as purchases,
  coalesce(sum(amount_cents) filter (where event_name = 'purchase'), 0)
                                                               as revenue_cents
from ev
group by utm_content
order by utm_content;
```

Expect exactly two rows: `creative_b_aug26` and `mudah_carousel_aug26`.
A missing row means that arm recorded nothing — investigate before interpreting
anything.

- [ ] Paqar figures captured and saved
- [ ] Both arms present

## B3. Confirm the Meta campaign is finished or paused

```bash
curl -s -G "https://graph.facebook.com/v21.0/120248441368300438" \
  --data-urlencode "access_token=$META_SYSTEM_USER_ACCESS_TOKEN" \
  --data-urlencode "fields=id,name,status,effective_status,stop_time" | jq
```

- [ ] `effective_status` is **not** `ACTIVE`

**If it is still `ACTIVE`, stop.** Either wait for the end time, or pause it by
hand in Ads Manager as a deliberate, recorded decision. Do not proceed into a
finished-experiment path while the experiment is running, and do not pause it
from code — nothing in this codebase can, and nothing should be added that can.

## B4. Deploy the code

```bash
git checkout fix/meta-experiment-reporting
git push -u origin fix/meta-experiment-reporting
# open PR against main, merge, let Vercel deploy production
```

**Blocked until the production build passes** — see *Outstanding* below.

## B5. Verify reporting, and that the operator stayed disabled

Open `/admin/ads`:

- [ ] Amber banner: **"OPERATOR DISABLED — configuration incoherent"**
- [ ] `Active campaign (UTM)` reads `creative_test_aug26`
- [ ] `Config coherence` reads `INCOHERENT — operator disabled`
- [ ] Funnel figures are **non-zero** and match what B2 returned
- [ ] Both arms appear under "Active creatives"
- [ ] Retired creatives still show their own historical numbers

**The banner is the success condition, not a fault.** It is the operator
standing down, exactly as intended.

Confirm the operator is inert:

```bash
curl -sS -H "authorization: Bearer $ADS_OPERATOR_CRON_SECRET" \
  https://paqar.my/api/cron/meta-ads | jq
```

- [ ] Response contains `"skipped": "experiment_incoherent"`
- [ ] Response contains **no** `"rule": "tracking_broken"`
- [ ] No new `tracking_broken` row in `meta_ads_actions`

### Expected consequences of staying incoherent

Understand these before signing off — they are intended, not faults:

| Behaviour | While incoherent |
|---|---|
| `/admin/ads` funnel numbers | **Correct** — reporting reads the code config |
| Meta reads, snapshots, pause | **None** — operator fully disabled |
| **Daily report email** | **Stops.** The cron returns before the report block. This is why B1/B2 capture the final results manually. |
| `meta_ads_actions` | One `experiment_incoherent` audit row per MYT day (idempotent). Expected; not an error. |

## B6. What NOT to do in Path B

- [ ] **Do not** set `status='enabled'`
- [ ] **Do not** clear `stopped_at`
- [ ] **Do not** set `meta_campaign_id` to the v2 campaign
- [ ] **Do not** re-enable the operator
- [ ] **Do not** reactivate, unpause, restart, re-budget or edit any Meta
      campaign, ad set or ad
- [ ] **Do not** activate campaign `120248437132210438` (abandoned v1 — its UTMs
      collide with v2)

---

## Deferred: recording v2 as completed in the database

**DOCUMENTED FOR A LATER DECISION. DO NOT EXECUTE.**

If the team later decides `meta_ads_experiment` should record the v2 campaign as
the completed experiment rather than still naming Carlist, this is the exact
safe transition. It is bookkeeping only — it grants no new capability.

```sql
-- NOT PART OF PATH B. Requires its own decision.
update meta_ads_experiment
set meta_campaign_id  = '120248441368300438',
    meta_adset_id     = '120248441368430438',
    creative_a_ad_id  = '120248441369150438',  -- slot 1 → creative_b_aug26
    creative_b_ad_id  = '120248441369870438',  -- slot 2 → mudah_carousel_aug26
    status            = 'completed',
    operator_enabled  = false,                 -- stays off
    stopped_at        = '2026-08-19T04:00:00+00:00',  -- REPLACE with the real end
    launched_at       = '2026-08-12T04:00:00+00:00',
    graphic_ads_started_at = null,
    updated_at        = now()
where id = '56a934d0-38a3-4f08-96b0-f7c236637853'
  and meta_campaign_id = '120248230297470438';   -- optimistic lock
```

**Consequences that must be accepted first** — this write makes the
configuration **coherent**, which changes behaviour:

1. The amber banner disappears and the cron stops early-returning.
2. The cron resumes reading Meta and writing snapshots daily for a finished
   campaign, and the daily report email resumes.
3. It remains safe from auto-pause on two independent grounds: `stopped_at` is
   set, so the detector is skipped entirely; and even without that, detection
   requires `effective_status === 'ACTIVE'`, which a finished campaign is not.
4. It remains safe from any mutation because `operator_enabled = false` makes
   `checkMutationAllowed()` return `operator_disabled`.

`opening_spend_cents` is deliberately absent — it is the spend floor for
reconciliation and changing it double-counts. See `reconcileBudget()`.

If the noise in (2) is unwanted, **do nothing**. Leaving the row incoherent is a
valid permanent resting state, and the dashboard stays correct either way.

---

## Launching the next campaign

The sequence below is now a hard requirement, because the coherence gate
enforces it. Getting it backwards cannot break production — the operator simply
refuses to act — but it will waste a deploy cycle.

**1. Code configuration first.** In `lib/meta-ads/guards.ts`:

- add the new campaign to `CAMPAIGNS` with its `utm`, its two `creatives`, and
  its `metaCampaignId`;
- point `ACTIVE_CAMPAIGN` at it;
- append the outgoing campaign's creatives to `RETIRED_CREATIVE_TAGS` so their
  history stays readable under their own campaign via `campaignForCreative()`;
- give the new creatives **fresh tags**. Never reuse a retired tag — it merges
  two cohorts into one number, and `isUrlTagsAllowed()` will reject it anyway.

Update `__tests__/lib/meta-ads-active-experiment.test.ts`, which pins the active
campaign by name. The other suites derive from `ACTIVE_CAMPAIGN` and should not
need changes; if one does, that is a signal it has re-acquired a hard-coded
campaign.

Deploy this before creating or starting anything on Meta.

**2. Verify the gate is live.** `/admin/ads` must show the amber banner naming
the **new** expected `metaCampaignId`, and `Active campaign (UTM)` must read the
new UTM. This proves reporting has moved and the operator is standing down.

**3. Database update, with an optimistic lock.** Only after the new campaign's
Meta objects exist and their ids are known:

```sql
update meta_ads_experiment
set meta_campaign_id  = '<new campaign id>',
    meta_adset_id     = '<new ad set id>',
    creative_a_ad_id  = '<new slot 1 ad id>',
    creative_b_ad_id  = '<new slot 2 ad id>',
    status            = 'enabled',
    stopped_at        = null,
    launched_at       = '<campaign start, UTC>',
    graphic_ads_started_at = null,
    updated_at        = now()
where id = '56a934d0-38a3-4f08-96b0-f7c236637853'
  and meta_campaign_id = '<the id it holds RIGHT NOW>';   -- optimistic lock
```

The `and meta_campaign_id = ...` clause is mandatory. If the row has moved since
you read it, the update affects **0 rows** instead of silently overwriting
someone else's change. Confirm the editor reports `UPDATE 1`; if it reports
`UPDATE 0`, re-read the row and start this step again.

**4. Operator verification.** Only after the update:

- `/admin/ads` — amber banner gone, `Config coherence` reads `OK`
- run preflight from the admin page; it must pass against the new objects
- enable the operator (`Enable operator after preflight`)
- one manual cron call returns `ok: true` with a real `spendCents`, **no**
  `skipped`, and **no** `tracking_broken`
- `meta_ads_actions` shows no `tracking_broken` row; any `tracking_*` evidence
  names a date and `Asia/Kuala_Lumpur`, never "last 24h"

---

## Reference — object ids

Verified read-only against the Graph API, 2026-08-12 14:24 MYT.

**Current `meta_ads_experiment` row** (expected pre-write state):

| Column | Value |
|---|---|
| `id` | `56a934d0-38a3-4f08-96b0-f7c236637853` |
| `meta_campaign_id` | `120248230297470438` (Carlist — finished) |
| `meta_adset_id` | `120248239158460438` |
| `creative_a_ad_id` | `120248239319430438` |
| `creative_b_ad_id` | `120248239320220438` |
| `status` | `paused_by_operator` |
| `stopped_at` | `2026-08-12T01:54:06.277+00:00` |
| `opening_spend_cents` | `17430` |

If `meta_campaign_id` is not `120248230297470438`, **stop** — someone has
changed the row; re-read this runbook against the actual state first.

**The v2 experiment's Meta objects:**

| Object | Id |
|---|---|
| Campaign `PAQAR_Creative_Test_Aug26_v2` | `120248441368300438` |
| Ad set `Creative_Test_Control` | `120248441368430438` |
| Ad set `Creative_Test_Mudah` | `120248441369560438` |
| Ad `creative_b_aug26` | `120248441369150438` |
| Ad `mudah_carousel_aug26` | `120248441369870438` |

> **Never use `120248437132210438`.** That is the abandoned v1 campaign. It
> never delivered, and its ads carry UTM tags **identical** to v2, so
> activating or referencing it would make two cohorts indistinguishable in
> `ad_events`.

---

## Rollback

**Rollback never requires touching Meta.**

### Path B (the expected path)
Path B writes nothing to the database, so rollback is purely the code: revert
the deploy in Vercel ("Promote" the previous production deployment), or

```bash
git revert -m 1 <merge-commit-sha>
git push
```

That restores the prior state completely.

### If a database write was made (Path A, or the deferred transition)
Restore the row exactly:

```sql
update meta_ads_experiment
set meta_campaign_id  = '120248230297470438',
    meta_adset_id     = '120248239158460438',
    creative_a_ad_id  = '120248239319430438',
    creative_b_ad_id  = '120248239320220438',
    status            = 'paused_by_operator',
    operator_enabled  = false,
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

## Outstanding — production build UNRESOLVED

**The production build has not passed and is a blocker for B4.**

`npx next build` was OOM-killed (exit 137) on the development machine at heap
sizes 1400 / 1900 / 2200 / 2400 MB, and with `experimental: { cpus: 1,
workerThreads: false }`. That temporary config change was reverted and is not in
commit `108e100`.

The failure is **environmental, not caused by this change**: the unmodified base
commit `7802ccb` was built in a separate worktree and fails identically at exit
137. The machine had ~2.4 GB free of 6.5 GB.

What did pass on `108e100`:

| Check | Result |
|---|---|
| Full Vitest | 112 files, 1690 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx next lint` | no warnings or errors |

`tsc --noEmit` covers every changed runtime file including the admin page JSX,
and the cron tests import the real route module — but neither substitutes for a
build.

- [ ] **Production build passes in CI or on a higher-memory machine**

Do not merge or deploy until that box is ticked.

---

## Not part of this runbook

- **Do not activate campaign `120248437132210438`** (abandoned v1). Its UTMs
  collide with v2.
- **Do not change any budget, targeting, ad or campaign status** to complete
  this work. Nothing here requires it.
- **Do not declare a creative winner from partial data.** At 2026-08-12
  14:24 MYT the test had run 2h24m on RM12.45 of RM180, and the Mudah arm's
  four `valuation_started` came from two sessions. Judge the result from the
  final figures captured in B1 and B2, and only then.
