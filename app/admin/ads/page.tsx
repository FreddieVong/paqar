import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getExperiment, getFunnelCounts, latestAction, listSnapshots } from '@/lib/meta-ads/db'
import { runPreflight, type PreflightResult } from '@/lib/meta-ads/preflight'
import { VALUATION_PATHS } from '@/lib/funnel-stages'
import { buildDailyReport, computeSpendSinceLastSync, type CreativeResult } from '@/lib/meta-ads/report'
import { reconcileBudget, describeBudget } from '@/lib/meta-ads/budget'
import {
  MAX_DAILY_BUDGET_MYR, MAX_TOTAL_SPEND_MYR, ACTIVE_CREATIVE_TAGS, RETIRED_CREATIVE_TAGS,
} from '@/lib/meta-ads/guards'
import {
  adminLogin, saveMetaIds, acknowledgeManualItems, enableOperatorAfterPreflight,
  pauseEverything, disableOperator, setKillSwitch, clearKillSwitch,
} from './_actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title:  'Admin — Meta Ads Operator',
  robots: { index: false, follow: false },
}

const rm = (cents: number | null | undefined) =>
  cents == null ? '—' : `RM${(cents / 100).toFixed(2)}`

// Everything on this page is reported in MYT. Without an explicit timeZone
// these would render in UTC on Vercel and disagree with the daily report,
// which uses myatDate().
function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ms-MY', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  })
}

const CARD = 'bg-white border border-[#E5E7EB] rounded-[14px] p-5'
const H2   = 'font-heading font-bold text-[15px] text-[#111827] mb-3'
const BTN  = 'font-heading font-bold text-[14px] rounded-[10px] py-3 px-4'

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-[#F3F4F6] last:border-0">
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span className={`text-[13px] tabular-nums ${strong ? 'font-bold text-[#111827]' : 'text-[#374151]'}`}>{value}</span>
    </div>
  )
}

export default async function AdminAdsPage() {
  if (!env.ADMIN_SECRET) notFound()

  if (!isAdminAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-5">
        <form action={adminLogin} className="w-full max-w-xs bg-white border border-[#E5E7EB] rounded-[16px] p-6 space-y-4">
          <p className="font-heading font-bold text-[16px] text-[#111827]">Paqar Admin — Ads</p>
          <input
            type="password"
            name="secret"
            placeholder="Admin secret"
            autoFocus
            className="w-full border border-[#D1D5DB] rounded-[10px] px-4 py-3 text-[16px]"
          />
          <button type="submit" className={`w-full bg-[#064E4A] text-white ${BTN}`}>
            Log Masuk
          </button>
        </form>
      </div>
    )
  }

  const experiment = await getExperiment()
  // plate_report ONLY — see lib/funnel-stages.ts. Mixing entry points was the
  // original cause of the misleading 8.7% completion rate.
  const funnel     = await getFunnelCounts({ valuationPath: VALUATION_PATHS.plateReport }).catch(() => null)

  // Active creatives are scoped to the swap timestamp so retired video data,
  // and any future tag reuse, can never enter the live comparison.
  const swapAt = experiment?.graphic_ads_started_at
    ? new Date(experiment.graphic_ads_started_at) : undefined
  const activeCreativeFunnels = await Promise.all(
    ACTIVE_CREATIVE_TAGS.map(async (tag) => ({
      tag,
      funnel: await getFunnelCounts({
        utmContent: tag, since: swapAt, valuationPath: VALUATION_PATHS.plateReport,
      }).catch(() => null),
    }))
  )
  const retiredCreativeFunnels = await Promise.all(
    RETIRED_CREATIVE_TAGS.map(async (tag) => ({
      tag,
      funnel: await getFunnelCounts({
        utmContent: tag, valuationPath: VALUATION_PATHS.plateReport,
      }).catch(() => null),
    }))
  )

  const modelFunnel = await getFunnelCounts({ valuationPath: VALUATION_PATHS.modelPrice }).catch(() => null)
  const action     = experiment ? await latestAction(experiment.id).catch(() => null) : null
  const snapshots  = experiment ? await listSnapshots(experiment.id, 'campaign').catch(() => []) : []
  const adSnaps    = experiment ? await listSnapshots(experiment.id, 'ad').catch(() => []) : []

  const configured = Boolean(
    experiment?.meta_campaign_id && experiment?.meta_adset_id &&
    experiment?.creative_a_ad_id && experiment?.creative_b_ad_id
  )

  // One canonical server-side state drives both the mode and the controls.
  const operatorEnabled = experiment?.operator_enabled === true
  const mode: 'setup' | 'live' = operatorEnabled ? 'live' : 'setup'

  let preflight: PreflightResult | null = null
  if (configured && experiment) {
    preflight = await runPreflight({
      campaignId:    experiment.meta_campaign_id!,
      adSetId:       experiment.meta_adset_id!,
      creativeAAdId: experiment.creative_a_ad_id!,
      creativeBAdId: experiment.creative_b_ad_id!,
      mode,
    }).catch(() => null)
  }

  // Spend reconciliation: campaign total vs the sum of matched ad spend.
  // Unallocated spend is reported, never distributed between creatives.
  const latestAdSnaps = new Map<string, number | null>()
  for (const snap of adSnaps as Array<Record<string, unknown>>) {
    latestAdSnaps.set(String(snap.meta_object_id), snap.spend_cents as number | null)
  }
  const matchedSpend = [...latestAdSnaps.values()]
    .filter((v): v is number => typeof v === 'number')
    .reduce((a, b) => a + b, 0)
  const matchedCount = [...latestAdSnaps.values()].filter((v) => typeof v === 'number').length

  const latestSnap = snapshots[snapshots.length - 1] as
    | { spend_cents: number | null; impressions: number; link_clicks: number; captured_at_bucket: string }
    | undefined
  const totalSpend = latestSnap?.spend_cents ?? null
  const remaining  = totalSpend == null ? null : Math.max(0, MAX_TOTAL_SPEND_MYR * 100 - totalSpend)

  // Reconciled against every stored snapshot, because Meta's counter resets
  // when the spending limit changes and would otherwise under-report spend.
  const snapshotMax = (snapshots as Array<Record<string, unknown>>)
    .map((x) => x.spend_cents as number | null)
    .filter((n): n is number => typeof n === 'number')
    .reduce<number | null>((max, n) => (max == null || n > max ? n : max), null)
  const budget = reconcileBudget({
    liveCounterCents:  totalSpend,
    snapshotMaxCents:  snapshotMax,
    openingSpendCents: experiment?.opening_spend_cents ?? null,
  })

  // A DELTA between two syncs, so it needs two readings. With one snapshot it
  // is unknown — not the cumulative total, which is what it used to report.
  const prevSnap = snapshots[snapshots.length - 2] as
    | { spend_cents: number | null; captured_at?: string; captured_at_bucket?: string }
    | undefined
  const spendSinceLastSync = computeSpendSinceLastSync(totalSpend, prevSnap?.spend_cents)
  const previousSyncAt = prevSnap?.captured_at ?? prevSnap?.captured_at_bucket ?? null

  const unallocated = totalSpend == null || matchedCount === 0 ? null : totalSpend - matchedSpend
  // 2% or RM1, whichever is larger — Meta rounds per-object spend independently.
  const tolerance = totalSpend == null ? 0 : Math.max(100, Math.round(totalSpend * 0.02))
  const reconciliation =
    totalSpend == null ? 'unavailable'
    : matchedCount === 0 ? 'unavailable'
    : matchedCount < 2 ? 'partial'
    : Math.abs(unallocated ?? 0) <= tolerance ? 'complete'
    : 'mismatch'

  const critical = experiment?.critical_alert_state === 'CRITICAL_PAUSE_FAILED'

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-5 py-8">
      <div className="max-w-2xl mx-auto space-y-4">

        <h1 className="font-heading font-extrabold text-[20px] text-[#111827]">
          Meta Ads Operator
        </h1>

        {critical && (
          <div className="bg-[#FEF2F2] border-2 border-[#DC2626] rounded-[14px] p-5">
            <p className="font-heading font-extrabold text-[16px] text-[#DC2626] mb-2">
              AUTOMATIC PAUSE FAILED
            </p>
            <p className="text-[14px] text-[#7F1D1D] leading-relaxed">
              Meta delivery <strong>may still be active</strong>. Pause the campaign manually in
              Ads Manager now. The operator kill switch has been set and it will not retry.
              Meta&rsquo;s RM{MAX_TOTAL_SPEND_MYR} account spending limit remains the primary protection.
            </p>
          </div>
        )}

        {/* ── Status ─────────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Status</p>
          <Row label="Operator" value={experiment?.operator_enabled ? 'ENABLED' : 'disabled'} strong />
          <Row label="Kill switch" value={experiment?.kill_switch ? 'ACTIVE' : 'off'} strong={experiment?.kill_switch} />
          <Row label="Manual pause" value={experiment?.manual_pause ? 'YES (sticky)' : 'no'} />
          <Row label="Campaign status" value={experiment?.status ?? '—'} />
          <Row label="Daily budget" value={`RM${MAX_DAILY_BUDGET_MYR}`} />
          <Row label="Meta account spending limit" value={`RM${MAX_TOTAL_SPEND_MYR}`} strong />
          <Row label="Campaign spend (Meta)" value={rm(totalSpend)} strong />
          <Row label="Remaining under the limit" value={rm(remaining)} strong />
          <Row label="Start date" value={formatDateTime(experiment?.launched_at ?? null)} />
          <Row label="Last successful sync" value={formatDateTime(experiment?.last_successful_sync_at ?? null)} />
          <Row label="Consecutive spend failures" value={String(experiment?.consecutive_spend_failures ?? 0)} />
        </div>

        {/* ── Funnel ─────────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Paqar funnel — report path only</p>
          <p className="text-[12px] text-[#6B7280] mb-2 leading-snug">
            <code>plate_report</code> journeys, counted uniquely per submission.
            The model tab ({modelFunnel?.valuationStarted ?? 0} starts) and the
            overpriced plate tab never render the teaser, so they can never
            complete and are excluded rather than counted as failures.
          </p>
          {/* Landing visits are NOT report-path-only — they are every session.
              Pairing them with the report-path start count below reads as a
              ~4x worse landing page than reality; that exact division is what
              made the daily email recommend rewriting a headline that was
              converting fine. The all-paths row is what belongs next to it. */}
          <Row label="Landing-page visits" value={String(funnel?.landingViews ?? 0)} />
          <Row
            label="valuation_started (any path)"
            value={String(funnel?.valuationStartedAnyPath ?? 0)}
          />
          <Row label="valuation_started (report path)" value={String(funnel?.valuationStarted ?? 0)} />
          <Row label="valuation_completed" value={String(funnel?.valuationCompleted ?? 0)} />
          {/* The step that actually fails: 14 completions produced 1 payment
              form and 0 sales. These two separate "never saw the offer" from
              "saw it and left" from "engaged and balked". */}
          <Row label="  ├ paywall viewed"       value={String(funnel?.paywallViewed ?? 0)} />
          <Row label="  └ payment form focused" value={String(funnel?.paymentFormFocused ?? 0)} />
          <Row label="  ├ plate submitted" value={String(funnel?.plateSubmitted ?? 0)} />
          <Row label="  ├ lookup found" value={String(funnel?.lookupSucceeded ?? 0)} />
          <Row label="  ├ lookup not found (valid)" value={String(funnel?.lookupNotFound ?? 0)} />
          <Row label="  ├ lookup failed (technical)" value={String(funnel?.lookupFailed ?? 0)} strong={(funnel?.lookupFailed ?? 0) > 0} />
          <Row label="  └ client poll timed out" value={String(funnel?.pollTimedOut ?? 0)} strong={(funnel?.pollTimedOut ?? 0) > 0} />
          <Row label="RM12 purchases" value={String(funnel?.purchasesRm12 ?? 0)} />
          <Row label="RM100 purchases" value={String(funnel?.purchasesRm100 ?? 0)} />
          <Row label="Revenue" value={rm(funnel?.revenueCents ?? 0)} strong />
          <Row
            label="Cost per completed valuation"
            value={totalSpend && funnel?.valuationCompleted ? rm(Math.round(totalSpend / funnel.valuationCompleted)) : '—'}
          />
          <Row
            label="Cost per purchase"
            value={
              totalSpend && funnel && (funnel.purchasesRm12 + funnel.purchasesRm100) > 0
                ? rm(Math.round(totalSpend / (funnel.purchasesRm12 + funnel.purchasesRm100)))
                : '—'
            }
          />
        </div>

        {/* ── Active creatives ───────────────────────────────────── */}
        {/* Scoped to graphic_ads_started_at. Retired video results live in
            their own section below and are NEVER summed with these: creative_b
            alone carried 192 events as a video. */}
        <div className={CARD}>
          <p className={H2}>Active creatives — {ACTIVE_CREATIVE_TAGS.join(' vs ')}</p>
          {!swapAt && (
            <p className="text-[12px] text-[#B45309] mb-2 leading-relaxed">
              graphic_ads_started_at is not set. Until it is, these counts are
              unbounded in time and may include pre-swap rows.
            </p>
          )}
          {activeCreativeFunnels.map(({ tag, funnel: cf }) => (
            <div key={tag} className="py-2 border-b border-[#F3F4F6] last:border-0">
              <p className="text-[13px] font-bold text-[#111827]">{tag}</p>
              <p className="text-[12px] text-[#6B7280] tabular-nums">
                landing {cf?.landingViews ?? 0} · started {cf?.valuationStartedAnyPath ?? 0} ·
                {' '}completed {cf?.valuationCompleted ?? 0} ·
                {' '}checkout {cf?.paywallViewed ?? 0} paywall views
              </p>
            </div>
          ))}
        </div>

        {/* ── Retired creative baseline ──────────────────────────── */}
        <div className={`${CARD} opacity-75`}>
          <p className={H2}>
            Retired creative baseline — {RETIRED_CREATIVE_TAGS.join(', ')}
          </p>
          <p className="text-[12px] text-[#6B7280] mb-2 leading-relaxed">
            Historical video creatives. Shown for context and
            <strong> excluded from all current decisions</strong> — never summed
            with the active creatives above.
          </p>
          {retiredCreativeFunnels.map(({ tag, funnel: cf }) => (
            <div key={tag} className="py-2 border-b border-[#F3F4F6] last:border-0">
              <p className="text-[13px] font-bold text-[#6B7280]">{tag}</p>
              <p className="text-[12px] text-[#9CA3AF] tabular-nums">
                landing {cf?.landingViews ?? 0} · started {cf?.valuationStartedAnyPath ?? 0} ·
                {' '}completed {cf?.valuationCompleted ?? 0}
              </p>
            </div>
          ))}
        </div>

        {/* ── Per-ad snapshots ───────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Per-ad snapshots</p>
          {adSnaps.length === 0 && (
            <p className="text-[13px] text-[#6B7280]">No per-ad snapshots yet.</p>
          )}
          {(adSnaps as Array<Record<string, unknown>>).slice(-2).map((s, i) => (
            <div key={i} className="py-2 border-b border-[#F3F4F6] last:border-0">
              <p className="text-[13px] font-bold text-[#111827]">{String(s.meta_object_id)}</p>
              <p className="text-[12px] text-[#6B7280] tabular-nums">
                spend {rm(s.spend_cents as number | null)} · {String(s.impressions)} impr ·
                {' '}{String(s.link_clicks)} clicks · started {String(s.valuation_started)} ·
                {' '}completed {String(s.valuation_completed)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Pricing-promise warning ────────────────────────────── */}
        {/* Non-blocking by design: this is a claims question for a human, not
            a technical fault, and it must never gate preflight. */}
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[14px] text-[#92400E] mb-1">
            Creative claim check
          </p>
          <p className="text-[13px] text-[#78350F] leading-relaxed">
            Graphic creative mentions history checks. Confirm the ad or caption clearly
            states that accident/claim history is an optional additional check and is
            <strong> not included in the RM12 base report</strong>.
          </p>
          <p className="text-[12px] text-[#92400E] mt-2 leading-relaxed">
            The RM12 report renders “Rekod tuntutan insurans belum dapat disemak” and
            then upsells the RM88 add-on — so a buyer expecting records from a RM12
            purchase will not find them.
          </p>
        </div>

        {/* ── Spend reconciliation ───────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Spend reconciliation</p>
          {/* Authoritative: rebuilt from stored snapshots so a Meta counter
              reset cannot make an exhausted budget look available. */}
          <p className={`text-[13px] leading-relaxed mb-3 ${
            budget.status !== 'verified' || budget.overspentCents > 0
              ? 'text-[#B91C1C] font-semibold' : 'text-[#374151]'
          }`}>
            {describeBudget(budget)}
          </p>
          <Row label="Campaign spend (Meta counter)" value={rm(totalSpend)} />
          <Row label="Matched ad spend" value={matchedCount === 0 ? '—' : rm(matchedSpend)} />
          <Row label="Unallocated" value={rm(unallocated)} />
          <Row label="Status" value={reconciliation} strong />
          <p className="text-[12px] text-[#6B7280] mt-2 leading-snug">
            {reconciliation === 'unavailable'
              ? 'Meta has not returned ad-level spend yet, so campaign spend cannot be attributed to a creative.'
              : reconciliation === 'complete'
                ? 'Campaign spend matches the sum of both ads within rounding tolerance.'
                : reconciliation === 'partial'
                  ? 'Only some ads returned spend. The remainder is unattributed and is never split between creatives.'
                  : 'Campaign spend and matched ad spend disagree beyond tolerance. Unallocated spend is shown as-is, not distributed.'}
          </p>
        </div>

        {/* ── Preflight ──────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>{mode === 'live' ? 'Live campaign health' : 'Setup preflight'}</p>
          <p className="text-[12px] text-[#6B7280] mb-3 leading-snug">
            {mode === 'live'
              ? 'The operator is enabled, so these are live-state checks — an ACTIVE campaign is expected.'
              : 'Pre-activation checks — a PAUSED campaign is expected.'}
          </p>
          {!configured && (
            <p className="text-[13px] text-[#6B7280] mb-3">
              Enter the Meta object IDs below first.
            </p>
          )}
          {preflight && (
            <>
              {preflight.checks.map((c) => (
                <div key={c.id} className="py-2 border-b border-[#F3F4F6] last:border-0">
                  <p className="text-[13px]">
                    <span className={
                      c.status === 'pass' ? 'text-[#059669]'
                      : c.status === 'fail' ? 'text-[#DC2626]' : 'text-[#B45309]'
                    }>
                      {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '!'}
                    </span>{' '}
                    <span className="font-semibold text-[#111827]">{c.label}</span>
                  </p>
                  <p className="text-[12px] text-[#6B7280] leading-snug">{c.detail}</p>
                </div>
              ))}
              {preflight.requiresAck && !experiment?.preflight_acknowledged_at && (
                <form action={acknowledgeManualItems} className="mt-4">
                  <button type="submit" className={`w-full bg-[#B45309] text-white ${BTN}`}>
                    Acknowledge {preflight.manualItems.length} manual item(s)
                  </button>
                </form>
              )}
              {experiment?.preflight_acknowledged_at && (
                <p className="text-[12px] text-[#6B7280] mt-3">
                  Manual items acknowledged {formatDateTime(experiment.preflight_acknowledged_at)}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Meta object IDs ────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Meta object IDs</p>
          <p className="text-[12px] text-[#6B7280] mb-3 leading-snug">
            Created by hand in Ads Manager. This page never creates Meta objects.
          </p>
          <form action={saveMetaIds} className="space-y-2">
            {[
              ['campaignId',    'Campaign ID',    experiment?.meta_campaign_id],
              ['adSetId',       'Ad set ID',      experiment?.meta_adset_id],
              ['creativeAAdId', `Ad ID — active slot 1 (${ACTIVE_CREATIVE_TAGS[0]})`, experiment?.creative_a_ad_id],
              ['creativeBAdId', `Ad ID — active slot 2 (${ACTIVE_CREATIVE_TAGS[1]})`, experiment?.creative_b_ad_id],
            ].map(([name, label, value]) => (
              <label key={name as string} className="block">
                <span className="text-[12px] text-[#6B7280]">{label as string}</span>
                <input
                  name={name as string}
                  defaultValue={(value as string) ?? ''}
                  className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2.5 text-[16px] tabular-nums"
                />
              </label>
            ))}
            <button type="submit" className={`w-full bg-[#374151] text-white ${BTN}`}>
              Save IDs
            </button>
          </form>
        </div>

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Controls</p>
          <p className="text-[12px] text-[#6B7280] mb-3 leading-snug">
            Enabling the operator does <strong>not</strong> start Meta delivery. The campaign is
            activated and paused by hand in Ads Manager. The operator can only read, and pause.
          </p>
          <div className="space-y-2">
            {operatorEnabled ? (
              <div className="w-full bg-[#ECFDF5] border border-[#059669] text-[#065F46] rounded-[10px] py-3 px-4 text-[14px] font-heading font-bold text-center">
                Operator enabled
              </div>
            ) : (
              <form action={enableOperatorAfterPreflight}>
                <button
                  type="submit"
                  disabled={!configured || experiment?.kill_switch}
                  className={`w-full bg-[#064E4A] text-white disabled:bg-[#D1D5DB] ${BTN}`}
                >
                  Enable operator after preflight
                </button>
              </form>
            )}
            <form action={pauseEverything}>
              <button type="submit" className={`w-full bg-[#DC2626] text-white ${BTN}`}>
                Pause everything
              </button>
            </form>
            <form action={disableOperator}>
              <button type="submit" className={`w-full bg-white border border-[#D1D5DB] text-[#374151] ${BTN}`}>
                Disable operator
              </button>
            </form>
            {experiment?.kill_switch ? (
              <form action={clearKillSwitch}>
                <button type="submit" className={`w-full bg-white border border-[#B45309] text-[#B45309] ${BTN}`}>
                  Clear kill switch
                </button>
              </form>
            ) : (
              <form action={setKillSwitch}>
                <button type="submit" className={`w-full bg-[#111827] text-white ${BTN}`}>
                  Kill switch
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Latest action ──────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Latest operator action</p>
          {action ? (
            <>
              <Row label="When" value={formatDateTime((action as { occurred_at: string }).occurred_at)} />
              <Row label="Rule" value={String((action as { rule: string }).rule)} />
              <Row label="Action" value={String((action as { action: string }).action)} strong />
              <Row label="Success" value={(action as { success: boolean }).success ? 'yes' : 'no'} />
              <p className="text-[12px] text-[#6B7280] mt-2 leading-snug">
                {String((action as { response_summary: string }).response_summary ?? '')}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[#6B7280]">No actions recorded.</p>
          )}
        </div>

        {/* ── Daily report ───────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Daily report</p>
          <pre className="text-[12px] leading-relaxed text-[#111827] whitespace-pre-wrap font-mono">
            {buildDailyReport({
              dayNumber:       dayNumber(experiment?.launched_at ?? null),
              spendSinceLastSyncCents: spendSinceLastSync,
              previousSyncAt,
              totalSpendCents: totalSpend,
              impressions:     latestSnap?.impressions ?? 0,
              linkClicks:      latestSnap?.link_clicks ?? 0,
              funnel:          funnel ?? emptyFunnel(),
              creativeA:       creativeFrom(adSnaps, experiment?.creative_a_ad_id ?? null, 'A'),
              creativeB:       creativeFrom(adSnaps, experiment?.creative_b_ad_id ?? null, 'B'),
            })}
          </pre>
        </div>

      </div>
    </div>
  )
}

function dayNumber(launchedAt: string | null): number {
  if (!launchedAt) return 0
  const days = Math.floor((Date.now() - new Date(launchedAt).getTime()) / 86_400_000)
  return days + 1
}

function emptyFunnel() {
  return {
    landingViews: 0, valuationStarted: 0, valuationStartedAnyPath: 0, valuationCompleted: 0,
    purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
  }
}

function creativeFrom(
  snaps: Array<Record<string, unknown>>,
  adId: string | null,
  label: string
): CreativeResult {
  // Ad IDs are compared as strings throughout — they exceed Number.MAX_SAFE_INTEGER.
  const rows = snaps.filter((s) => String(s.meta_object_id) === String(adId))
  const last = rows[rows.length - 1]
  const spend = (last?.spend_cents as number | null) ?? null
  return {
    label,
    adId,
    deliveryStatus: last && spend != null ? 'available' : 'unavailable',
    spendCents:  spend,
    impressions: (last?.impressions as number | null) ?? null,
    linkClicks:  (last?.link_clicks as number | null) ?? null,
    funnel: {
      landingViews:       (last?.paqar_landing_views as number | null) ?? 0,
      valuationStarted:   (last?.valuation_started as number | null) ?? 0,
      // Legacy snapshots (pre-023) have no all-paths count. Falling back to the
      // report-path number understates it, but inventing one would be worse —
      // and the fallback is never larger than the truth, so it cannot turn a
      // healthy landing page into a false alarm the way the reverse did.
      valuationStartedAnyPath:
        (last?.valuation_started_any_path as number | null)
        ?? (last?.valuation_started as number | null) ?? 0,
      valuationCompleted: (last?.valuation_completed as number | null) ?? 0,
      purchasesRm12:      (last?.purchases_rm12 as number | null) ?? 0,
      purchasesRm100:     (last?.purchases_rm100 as number | null) ?? 0,
      revenueCents:       (last?.revenue_cents as number | null) ?? 0,
    },
  }
}
