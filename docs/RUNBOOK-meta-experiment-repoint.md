
---

## Amendment — 2026-08-16, the experiment is ABANDONED

**Decision by Freddie Vong, 2026-08-16 ~09:16 MYT (2026-08-16T01:16:02Z).**
Recorded before any action was taken.

**Decision:** the creative experiment is abandoned effective immediately. It is
not being waited out to its 19 August end time, and it will not be resumed.

**Why:** the integrated-buyer-decision audit
(`docs/product/INTEGRATED-BUYER-DECISION-AUDIT-2026-08-15.md`) found that paid
acquisition cannot work at the RM12 price point. Blended cash per external
customer was roughly RM115 — approximately RM71 of paid media plus RM132 of
plate lookups across 3 external customers — against RM12 of revenue. Which
creative wins is not the question that matters when the channel itself does not
close, so continuing to spend to finish the comparison buys an answer with no
decision attached to it.

**This is NOT a causal attribution.** `ad_sessions.referrer` was NULL on all
1,169 rows, the three customers are not a Meta-attributed cohort (one landed
untagged, one carried `utm_source=th`), and the spend and the customers are not
matched to the same period. The figure is sufficient to reject paid acquisition
at RM12; it is not a CAC and must never be quoted as one.

### Meta state at abandonment — no mutation was required

Read 2026-08-16T01:16Z, read-only, via the B3 command in this runbook:

| Field | Value |
|---|---|
| `id` | `120248441368300438` |
| `name` | `PAQAR_Creative_Test_Aug26_v2` |
| `status` | `PAUSED` |
| **`effective_status`** | **`PAUSED`** — B3's checkbox already satisfied |
| `start_time` | 2026-08-12T12:00:00+0800 |
| `stop_time` | 2026-08-19T12:00:00+0800 |

**The campaign was already PAUSED, so nothing was paused, edited or deleted.**
No creative, ad set, targeting or budget was touched, and no Meta write of any
kind was issued. This runbook's B3 is explicit that a campaign must not be
paused from code — "nothing in this codebase can, and nothing should be added
that can" — and that prohibition was not tested, because there was nothing to do.

**The operator cannot restart it**, on two independent grounds already in place:

- `meta_ads_experiment.status = 'paused_by_operator'` with
  `stopped_at = 2026-08-15T01:16:46.957Z`; and
- `meta_ads_experiment.meta_campaign_id = '120248230297470438'`, which is the
  older campaign and therefore disagrees with `ACTIVE_CAMPAIGN`. Per
  `lib/meta-ads/active-experiment.ts`, anything that can mutate Meta "gets
  nothing at all while the two halves disagree".

No database write was made to `meta_ads_experiment`. Path B requires none, and
abandonment does not change that.

### Final experiment results — preserved, not deleted

Meta, lifetime to 2026-08-16, read-only:

| | Spend | Impressions | Clicks | Reach | CTR |
|---|---:|---:|---:|---:|---:|
| **Campaign total** | RM110.11 | 10,358 | 628 | 7,174 | 6.06% |
| `Creative_Test_Control` | RM55.36 | 4,858 | 325 | 4,026 | 6.69% |
| `Creative_Test_Mudah` | RM54.75 | 5,500 | 303 | 3,986 | 5.51% |

CPC RM0.175 overall. Window 2026-08-12 → 2026-08-16.

**RM110.11 is the post-reset counter, not cumulative spend.** Meta's
`amount_spent` resets when the campaign spending limit changes — the defect
migration 024 exists to work around. Snapshot-derived figures at abandonment:
`meta_ads_snapshots` max `spend_cents` 20,536 (RM205.36), latest 8,934
(RM89.34), and `opening_spend_cents` 17,430 (RM174.30). A single cumulative
number requires deliberate reconciliation and is deliberately not asserted here.

Paqar-side funnel at abandonment (read-only aggregates, counts only): 2,995
`ad_events`; unique journeys `model_price` 296, `plate_report` 123,
`plate_check` 34; `paywall_viewed` 129 → `payment_form_focused` 26;
`buyer_reports` 27 paid, of which **3 external, all RM12, all carrying a
`check_id`** — every purchase Paqar has ever taken came through a plate journey.

54 snapshot rows and all `ad_events` are retained. Nothing was deleted.

### The new measurement regime

**The abandoned experiment's data must never be pooled with the plate-first
funnel.** The new regime starts at the plate-first production deployment
timestamp, recorded in the Deployment log below. Absolute rates either side of
that instant describe different products and different traffic mixes, and the
homepage change alters the funnel for both creative arms even though no Meta
object was touched.
