import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getExperiment, getFunnelCounts, latestAction, listSnapshots } from '@/lib/meta-ads/db'
import { runPreflight, type PreflightResult } from '@/lib/meta-ads/preflight'
import { buildDailyReport, type CreativeResult } from '@/lib/meta-ads/report'
import {
  MAX_DAILY_BUDGET_MYR, MAX_TOTAL_SPEND_MYR, CREATIVE_UTM_CONTENT,
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

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ms-MY', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
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
  const funnel     = await getFunnelCounts().catch(() => null)
  const action     = experiment ? await latestAction(experiment.id).catch(() => null) : null
  const snapshots  = experiment ? await listSnapshots(experiment.id, 'campaign').catch(() => []) : []
  const adSnaps    = experiment ? await listSnapshots(experiment.id, 'ad').catch(() => []) : []

  const configured = Boolean(
    experiment?.meta_campaign_id && experiment?.meta_adset_id &&
    experiment?.creative_a_ad_id && experiment?.creative_b_ad_id
  )

  let preflight: PreflightResult | null = null
  if (configured && experiment) {
    preflight = await runPreflight({
      campaignId:    experiment.meta_campaign_id!,
      adSetId:       experiment.meta_adset_id!,
      creativeAAdId: experiment.creative_a_ad_id!,
      creativeBAdId: experiment.creative_b_ad_id!,
    }).catch(() => null)
  }

  const latestSnap = snapshots[snapshots.length - 1] as
    | { spend_cents: number | null; impressions: number; link_clicks: number; captured_at_bucket: string }
    | undefined
  const totalSpend = latestSnap?.spend_cents ?? null
  const remaining  = totalSpend == null ? null : Math.max(0, MAX_TOTAL_SPEND_MYR * 100 - totalSpend)

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
              Meta&rsquo;s RM{MAX_TOTAL_SPEND_MYR} campaign spending limit remains the primary protection.
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
          <Row label="Daily budget limit" value={`RM${MAX_DAILY_BUDGET_MYR}`} />
          <Row label="Campaign spending limit" value={`RM${MAX_TOTAL_SPEND_MYR}`} />
          <Row label="Total spend" value={rm(totalSpend)} strong />
          <Row label="Remaining" value={rm(remaining)} strong />
          <Row label="Start date" value={formatDateTime(experiment?.launched_at ?? null)} />
          <Row label="Last successful sync" value={formatDateTime(experiment?.last_successful_sync_at ?? null)} />
          <Row label="Consecutive spend failures" value={String(experiment?.consecutive_spend_failures ?? 0)} />
        </div>

        {/* ── Funnel ─────────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Paqar funnel (source of truth)</p>
          <Row label="Landing-page visits" value={String(funnel?.landingViews ?? 0)} />
          <Row label="valuation_started" value={String(funnel?.valuationStarted ?? 0)} />
          <Row label="valuation_completed" value={String(funnel?.valuationCompleted ?? 0)} />
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

        {/* ── Creatives ──────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Creatives</p>
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

        {/* ── Preflight ──────────────────────────────────────────── */}
        <div className={CARD}>
          <p className={H2}>Preflight</p>
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
              ['creativeAAdId', `Ad ID — ${CREATIVE_UTM_CONTENT.a}`, experiment?.creative_a_ad_id],
              ['creativeBAdId', `Ad ID — ${CREATIVE_UTM_CONTENT.b}`, experiment?.creative_b_ad_id],
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
            <form action={enableOperatorAfterPreflight}>
              <button
                type="submit"
                disabled={!configured || experiment?.kill_switch}
                className={`w-full bg-[#064E4A] text-white disabled:bg-[#D1D5DB] ${BTN}`}
              >
                Enable operator after preflight
              </button>
            </form>
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
              spendTodayCents: 0,
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
    landingViews: 0, valuationStarted: 0, valuationCompleted: 0,
    purchasesRm12: 0, purchasesRm100: 0, revenueCents: 0,
  }
}

function creativeFrom(
  snaps: Array<Record<string, unknown>>,
  adId: string | null,
  label: string
): CreativeResult {
  const rows = snaps.filter((s) => s.meta_object_id === adId)
  const last = rows[rows.length - 1]
  return {
    label,
    spendCents:  (last?.spend_cents as number | null) ?? 0,
    impressions: (last?.impressions as number | null) ?? 0,
    linkClicks:  (last?.link_clicks as number | null) ?? 0,
    funnel: {
      landingViews:       (last?.paqar_landing_views as number | null) ?? 0,
      valuationStarted:   (last?.valuation_started as number | null) ?? 0,
      valuationCompleted: (last?.valuation_completed as number | null) ?? 0,
      purchasesRm12:      (last?.purchases_rm12 as number | null) ?? 0,
      purchasesRm100:     (last?.purchases_rm100 as number | null) ?? 0,
      revenueCents:       (last?.revenue_cents as number | null) ?? 0,
    },
  }
}
