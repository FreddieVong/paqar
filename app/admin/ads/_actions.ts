'use server'

import { revalidatePath } from 'next/cache'
import { isAdminSecretValid, isAdminAuthenticated, setAdminCookie } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getExperiment, updateExperiment, recordAction } from '@/lib/meta-ads/db'
import { runPreflight } from '@/lib/meta-ads/preflight'
import { pauseCampaign, MetaApiError, redactMeta } from '@/lib/meta-ads/client'
import { alertPauseFailed } from '@/lib/meta-ads/alerts'

const PATH = '/admin/ads'

export async function adminLogin(formData: FormData): Promise<void> {
  const secret = String(formData.get('secret') ?? '')
  if (!isAdminSecretValid(secret)) return
  setAdminCookie()
  revalidatePath(PATH)
}

function requireAdmin(): void {
  if (!isAdminAuthenticated()) throw new Error('Unauthorized')
}

/** Records the IDs of the campaign built by hand in Ads Manager. */
export async function saveMetaIds(formData: FormData): Promise<void> {
  requireAdmin()

  const patch = {
    meta_campaign_id: String(formData.get('campaignId') ?? '').trim() || null,
    meta_adset_id:    String(formData.get('adSetId') ?? '').trim() || null,
    creative_a_ad_id: String(formData.get('creativeAAdId') ?? '').trim() || null,
    creative_b_ad_id: String(formData.get('creativeBAdId') ?? '').trim() || null,
    // Changing the objects invalidates any previous acknowledgement.
    preflight_acknowledged_at: null,
  }

  const existing = await getExperiment()
  if (existing) {
    await updateExperiment(existing.id, patch)
  } else {
    const supabase = createServiceClient()
    const { error } = await supabase.from('meta_ads_experiment').insert(patch)
    if (error) throw error
  }
  revalidatePath(PATH)
}

/**
 * Acknowledges the preflight items Meta could not confirm automatically.
 * Required before the operator can be enabled when any `manual` item exists —
 * unreadable configuration is never silently accepted.
 */
export async function acknowledgeManualItems(): Promise<void> {
  requireAdmin()
  const experiment = await getExperiment()
  if (!experiment) return
  await updateExperiment(experiment.id, {
    preflight_acknowledged_at: new Date().toISOString(),
  })
  revalidatePath(PATH)
}

/**
 * Enables the operator. This does NOT start Meta delivery — the campaign is
 * activated by hand in Ads Manager. It only permits the operator to read and,
 * if a hard stop fires, to pause.
 *
 * Preflight is re-run here rather than trusting whatever the page rendered.
 */
export async function enableOperatorAfterPreflight(): Promise<void> {
  requireAdmin()

  const experiment = await getExperiment()
  if (!experiment) throw new Error('No experiment configured')
  if (!experiment.meta_campaign_id || !experiment.meta_adset_id ||
      !experiment.creative_a_ad_id || !experiment.creative_b_ad_id) {
    throw new Error('Meta object IDs are incomplete')
  }
  if (experiment.kill_switch) throw new Error('Kill switch is active')

  const result = await runPreflight({
    campaignId:    experiment.meta_campaign_id,
    adSetId:       experiment.meta_adset_id,
    creativeAAdId: experiment.creative_a_ad_id,
    creativeBAdId: experiment.creative_b_ad_id,
  })

  if (!result.passed) {
    throw new Error(`Preflight failed: ${result.failures.map((f) => f.label).join(', ')}`)
  }
  if (result.requiresAck && !experiment.preflight_acknowledged_at) {
    throw new Error('Manual checklist items must be acknowledged before enabling')
  }

  await updateExperiment(experiment.id, {
    operator_enabled: true,
    status:           'enabled',
    launched_at:      experiment.launched_at ?? new Date().toISOString(),
  })

  await recordAction({
    experimentId:    experiment.id,
    rule:            'admin_enable',
    action:          'operator_enabled',
    success:         true,
    responseSummary: `Enabled after preflight. ${result.checks.filter((c) => c.status === 'pass').length} checks passed, ${result.manualItems.length} acknowledged manually.`,
    idempotencyKey:  `admin_enable:${experiment.id}:${Date.now()}`,
  }).catch(() => false)

  revalidatePath(PATH)
}

/**
 * Explicit human pause. Deliberately bypasses the kill switch: the kill switch
 * exists to stop the OPERATOR acting on its own, and pausing is the safe
 * direction. After a failed automatic pause this is the button that works.
 */
export async function pauseEverything(): Promise<void> {
  requireAdmin()

  const experiment = await getExperiment()
  if (!experiment?.meta_campaign_id) throw new Error('No campaign configured')

  // Sticky: nothing in the codebase sets manual_pause back to false.
  await updateExperiment(experiment.id, {
    manual_pause: true,
    stopped_at:   new Date().toISOString(),
  })

  try {
    await pauseCampaign(experiment.meta_campaign_id)
    await updateExperiment(experiment.id, {
      status:               'paused_manually',
      critical_alert_state: null,
    })
    await recordAction({
      experimentId:    experiment.id,
      rule:            'admin_pause',
      action:          'pause_campaign',
      success:         true,
      responseSummary: 'Paused manually from /admin/ads',
      idempotencyKey:  `admin_pause:${experiment.id}:${Date.now()}`,
    }).catch(() => false)
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : redactMeta(String(err))
    await updateExperiment(experiment.id, {
      critical_alert_state: 'CRITICAL_PAUSE_FAILED',
      status:               'pause_failed',
    })
    await recordAction({
      experimentId:    experiment.id,
      rule:            'admin_pause',
      action:          'CRITICAL_PAUSE_FAILED',
      success:         false,
      responseSummary: `Manual pause failed: ${message}`,
      idempotencyKey:  `admin_pause_failed:${experiment.id}:${Date.now()}`,
    }).catch(() => false)
    await alertPauseFailed({
      rule:       'admin_pause',
      detail:     'A manual pause from /admin/ads failed.',
      error:      message,
      campaignId: experiment.meta_campaign_id,
    })
  }

  revalidatePath(PATH)
}

export async function disableOperator(): Promise<void> {
  requireAdmin()
  const experiment = await getExperiment()
  if (!experiment) return
  await updateExperiment(experiment.id, { operator_enabled: false, status: 'disabled' })
  revalidatePath(PATH)
}

/** Blocks every automatic Meta mutation until explicitly cleared. */
export async function setKillSwitch(): Promise<void> {
  requireAdmin()
  const experiment = await getExperiment()
  if (!experiment) return
  await updateExperiment(experiment.id, {
    kill_switch:      true,
    operator_enabled: false,
    status:           'kill_switch',
  })
  revalidatePath(PATH)
}

export async function clearKillSwitch(): Promise<void> {
  requireAdmin()
  const experiment = await getExperiment()
  if (!experiment) return
  // Clearing the kill switch never re-enables the operator or un-pauses
  // anything — both remain separate, deliberate human actions.
  await updateExperiment(experiment.id, {
    kill_switch:          false,
    critical_alert_state: null,
    status:               'disabled',
  })
  revalidatePath(PATH)
}
