import 'server-only'
import { ACTIVE_CAMPAIGN } from '@/lib/meta-ads/guards'

/**
 * The single answer to "which experiment is live right now".
 *
 * THE DEFECT THIS EXISTS TO PREVENT. Campaign identity was split in two:
 *
 *   lib/meta-ads/guards.ts    utm_campaign + creative tags   (ANALYTICS)
 *   meta_ads_experiment row   Meta campaign / ad set / ads   (CONTROL PLANE)
 *
 * Nothing compared them. On 2026-08-12 the live experiment was
 * PAQAR_Creative_Test_Aug26_v2 (120248441368300438) while both still named the
 * finished Carlist campaign, and the two halves failed in opposite directions
 * at the same time:
 *
 *   - reporting described a campaign that had stopped, so both live arms
 *     reported zero on the dashboard and in the daily email; and
 *   - the operator supervised that same stopped campaign, so the live one had
 *     no hard stop at all and a stale lifetime figure auto-paused a campaign
 *     on evidence that could no longer be true.
 *
 * The fix is not "update both". It is to make disagreement REFUSE TO RESOLVE.
 * Reporting reads ACTIVE_CAMPAIGN directly and is therefore correct the moment
 * the code deploys; anything that can MUTATE Meta, pair an ad id with a
 * creative tag, or write a snapshot must come through here first and gets
 * nothing at all while the two halves disagree.
 *
 * That asymmetry is deliberate. Reading the wrong campaign produces a wrong
 * number; acting on the wrong campaign spends or destroys real money.
 */

export type ExperimentCoherence =
  | {
      coherent: true
      /** The Meta campaign the operator may read, snapshot and pause. */
      metaCampaignId: string
      utmCampaign:    string
      creativeTags:   readonly [string, string]
    }
  | {
      coherent: false
      reason:   string
      expectedMetaCampaignId: string
      actualMetaCampaignId:   string | null
    }

/**
 * Compares the experiment row against the active campaign config.
 *
 * A missing row, a null campaign id and a campaign id belonging to some other
 * campaign are all the same answer: incoherent. There is deliberately no
 * "assume it's fine" branch — that assumption is what let a stale row point
 * the operator at the wrong campaign for a week.
 */
export function resolveActiveExperiment(
  row: { meta_campaign_id: string | null } | null
): ExperimentCoherence {
  const expected = ACTIVE_CAMPAIGN.metaCampaignId
  const actual   = row?.meta_campaign_id?.trim() || null

  if (actual === expected) {
    return {
      coherent:       true,
      metaCampaignId: expected,
      utmCampaign:    ACTIVE_CAMPAIGN.utm,
      creativeTags:   ACTIVE_CAMPAIGN.creatives,
    }
  }

  const reason = actual === null
    ? `meta_ads_experiment has no meta_campaign_id, but the active campaign `
      + `${ACTIVE_CAMPAIGN.utm} is Meta campaign ${expected}. `
      + `Nothing will be reported against Meta or paused until the row names it.`
    : `meta_ads_experiment.meta_campaign_id is ${actual}, but the active `
      + `campaign ${ACTIVE_CAMPAIGN.utm} is Meta campaign ${expected}. `
      + `The operator is disabled until the row is repointed.`

  return {
    coherent: false,
    reason,
    expectedMetaCampaignId: expected,
    actualMetaCampaignId:   actual,
  }
}
