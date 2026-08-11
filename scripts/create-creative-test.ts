/**
 * Creates the creative-treatment test's Meta objects — ALL PAUSED.
 *
 *   npx tsx scripts/create-creative-test.ts            # dry run, POSTs nothing
 *   npx tsx scripts/create-creative-test.ts --confirm  # creates
 *   ... --confirm --resume                            # continues a part-way run
 *
 * Requires NODE_OPTIONS="--conditions=react-server" so `server-only` resolves
 * to its empty module. That is not a bypass: it makes the script import the
 * REAL lib/meta-ads/client, so every guard, every URL check and the
 * SpendAuthorisation gate apply exactly as they do in the app. A script that
 * called Graph directly would be a second implementation with none of them.
 *
 * WHAT THIS SCRIPT CANNOT DO
 *
 * Activate anything. There is no code path, here or anywhere in this codebase,
 * that sets a Meta object to a delivering state. Every object it creates is
 * created PAUSED and stays that way until a human starts it in Ads Manager,
 * after a native randomised A/B split has been configured.
 *
 * FAIL-CLOSED CONDITIONS, all checked BEFORE anything is created:
 *   - META_VALUATION_STARTED_CUSTOM_CONVERSION_ID unset
 *   - that conversion not readable, or not actually a valuation_started rule
 *   - reconciled spend + RM180 over the allowance
 *   - a campaign of this name already exists (unless --resume, which is
 *     refused the moment any ad exists)
 *   - any source creative unreadable
 */
import { readFileSync } from 'fs'

// .env.local is not loaded by node; scripts here expect exported vars. Reading
// it directly keeps the invocation a single command.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(line)
    if (m?.[1]) process.env[m[1]] ??= (m[2] ?? '').replace(/^["']|["']$/g, '')
  }
} catch { /* env already exported */ }

const CONFIRM = process.argv.includes('--confirm')
const RESUME  = process.argv.includes('--resume')

async function main() {
  const [
    { createCampaignPaused, createAdSetPaused, createAdCreative, createAdPaused, collectLinks },
    { getCampaignSpendCents, listCampaigns, listAdSetsInCampaign, listAdsInAdSet, metaGetRaw },
    guards,
    { runExperimentPreflight },
  ] = await Promise.all([
    import('../lib/meta-ads/client'),
    import('../lib/meta-ads/insights').then(async (m) => ({
      ...m, metaGetRaw: (await import('../lib/meta-ads/client')).metaGet,
    })),
    import('../lib/meta-ads/guards'),
    import('../lib/meta-ads/experiment-preflight'),
  ])

  const CAMPAIGN = guards.CAMPAIGNS.creativeTestAug26
  const CAMPAIGN_NAME = 'PAQAR_Creative_Test_Aug26'
  const DESTINATION = 'https://paqar.my/'

  const ARMS = [
    { name: 'Creative_Test_Control', sourceCreativeId: '1073929188497763', utmContent: CAMPAIGN.creatives[0] },
    { name: 'Creative_Test_Mudah',   sourceCreativeId: '1045607771212021', utmContent: CAMPAIGN.creatives[1] },
  ] as const

  const stop = (why: string): never => {
    console.error(`\n✗ STOPPED — ${why}\n  Nothing was created.`)
    process.exit(1)
  }

  console.log(CONFIRM ? '=== CREATE (--confirm) ===' : '=== DRY RUN — nothing will be POSTed ===')

  // --- 1. The optimisation target, required and verified ------------------
  const ccId = process.env.META_VALUATION_STARTED_CUSTOM_CONVERSION_ID
  if (!ccId) {
    stop('META_VALUATION_STARTED_CUSTOM_CONVERSION_ID is not set.\n'
      + '  Create the Custom Conversion "PAQAR | VALUATION STARTED" with rule\n'
      + '  Lead AND paqar_step=valuation_started, then set this variable.\n'
      + '  There is deliberately no fallback: the account\'s other conversion fires on\n'
      + '  valuation_completed, which model_price and plate_check cannot reach at all.')
  }

  const cc = await metaGetRaw<{ id: string; name?: string; rule?: string; is_archived?: boolean }>(
    ccId!, { fields: 'id,name,rule,custom_event_type,is_archived' }).catch((e) => {
      stop(`custom conversion ${ccId} is not readable: ${e instanceof Error ? e.message : e}`)
    })
  console.log(`\ncustom conversion  ${cc!.id}  ${cc!.name}`)
  console.log(`  rule  ${cc!.rule}`)
  if (cc!.is_archived) stop(`custom conversion ${ccId} is archived`)
  if (!String(cc!.rule ?? '').includes(guards.OPTIMISATION_EVENT)) {
    stop(`custom conversion ${ccId} does not filter ${guards.OPTIMISATION_EVENT}.\n`
      + `  rule = ${cc!.rule}\n`
      + '  Pointing the test at the wrong conversion would optimise both arms toward\n'
      + '  an event most traffic cannot fire. Fix the conversion, do not proceed.')
  }

  // --- 2. Spend, reconciled from insights rather than Meta's counter -------
  const campaigns = await listCampaigns()
  const existing = campaigns.find((c) => c.name === CAMPAIGN_NAME)

  /**
   * RESUME, bounded deliberately.
   *
   * Creation spans seven objects and Meta can reject the fourth after
   * accepting the third, which is exactly what happened once. Without this the
   * only ways forward are a delete verb — which this codebase must never have —
   * or hand-deleting in Ads Manager.
   *
   * The bound is what makes it safe: a campaign is only reused if it holds
   * ZERO ads. An ad set with no ad cannot deliver at any budget, so resuming
   * onto one can never restart something that was already spending. The moment
   * a single ad exists, this refuses and the operator has to look.
   */
  let campaignId: string | null = null
  if (existing) {
    if (!RESUME) {
      stop(`a campaign named ${CAMPAIGN_NAME} already exists (${existing.id}).\n`
        + '  This script is not a duplicator. If a previous run failed part-way,\n'
        + '  re-run with --resume; it will refuse if any ad already exists.')
    }
    const sets = await listAdSetsInCampaign(existing.id)
    let ads = 0
    for (const s of sets) ads += (await listAdsInAdSet(s.id)).length
    if (ads > 0) {
      stop(`${CAMPAIGN_NAME} (${existing.id}) already holds ${ads} ad(s).\n`
        + '  Resume only continues a run that never got as far as an ad.')
    }
    campaignId = existing.id
    console.log(`\nRESUMING ${CAMPAIGN_NAME} (${campaignId}) — `
      + `${sets.length} ad set(s) present, 0 ads, nothing can deliver.`)
  }

  let cumulativeCents = 0
  console.log('\nreconciled lifetime spend')
  for (const c of campaigns) {
    const cents = await getCampaignSpendCents(c.id)
    if (cents == null) {
      stop(`spend for campaign ${c.name} (${c.id}) is unreadable.\n`
        + '  An unreadable figure is never treated as zero — that is how an experiment\n'
        + '  runs past its allowance unchallenged.')
    }
    cumulativeCents += cents!
    console.log(`  ${String(c.name).padEnd(48)} RM${(cents! / 100).toFixed(2)}`)
  }
  const commitmentCents = guards.MAX_NEW_COMMITMENT_CENTS
  console.log(`  ${'RECONCILED TOTAL'.padEnd(48)} RM${(cumulativeCents / 100).toFixed(2)}`)
  console.log(`  ${'this test commits'.padEnd(48)} RM${(commitmentCents / 100).toFixed(2)}`)
  console.log(`  ${'projected'.padEnd(48)} RM${((cumulativeCents + commitmentCents) / 100).toFixed(2)}`)
  console.log(`  ${'allowance'.padEnd(48)} RM${guards.MAX_TOTAL_SPEND_MYR}.00`)

  const authorisation = guards.authoriseNewSpend(
    { status: 'verified', cumulativeCents }, commitmentCents)
  if (!authorisation) {
    stop(`RM${(commitmentCents / 100).toFixed(2)} on top of RM${(cumulativeCents / 100).toFixed(2)} `
      + `exceeds the RM${guards.MAX_TOTAL_SPEND_MYR} allowance.`)
  }

  // --- 3. Fresh creative specs from the same assets ------------------------
  /**
   * Rewrites every destination to the bare URL, preserving all asset fields.
   *
   * Also drops image_url wherever image_hash is present. Meta RETURNS both when
   * you read a creative but REJECTS both on create — "ObjectStorySpecRedundant:
   * Only one of image_url and image_hash should be specified". image_hash is
   * the one kept: it is a stable reference to the already-uploaded asset, while
   * image_url is a rendered CDN link that can expire.
   */
  const cleanSpec = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(cleanSpec)
    if (!node || typeof node !== 'object') return node
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if ((k === 'link' || k === 'link_url') && typeof v === 'string') out[k] = DESTINATION
      else out[k] = cleanSpec(v)
    }
    if ('image_hash' in out && 'image_url' in out) delete out.image_url
    return out
  }

  const start = new Date(Date.now() + 10 * 60_000)
  const end   = new Date(start.getTime() + guards.TEST_DURATION_DAYS * 86_400_000)

  const specs: Record<string, Record<string, unknown>> = {}
  for (const arm of ARMS) {
    const src = await metaGetRaw<{ object_story_spec?: Record<string, unknown> }>(
      arm.sourceCreativeId, { fields: 'object_story_spec' }).catch(() => null)
    if (!src?.object_story_spec) stop(`source creative ${arm.sourceCreativeId} has no object_story_spec`)
    const spec = cleanSpec(src!.object_story_spec) as Record<string, unknown>
    specs[arm.name] = spec
    console.log(`\n${arm.name}  (assets from ${arm.sourceCreativeId})`)
    console.log(`  destinations after cleaning: ${JSON.stringify(collectLinks(spec))}`)
    console.log(`  url_tags: utm_source=${guards.META_SOURCE_MACRO}&utm_medium=${guards.REQUIRED_UTM.utm_medium}`
      + `&utm_campaign=${CAMPAIGN.utm}&utm_content=${arm.utmContent}`)
  }

  const urlTagsFor = (content: string) =>
    `utm_source=${guards.META_SOURCE_MACRO}&utm_medium=${guards.REQUIRED_UTM.utm_medium}`
    + `&utm_campaign=${CAMPAIGN.utm}&utm_content=${content}`

  const targeting = {
    geo_locations: { countries: [guards.ALLOWED_COUNTRY] },
    age_min: guards.APPROVED_AGE_MIN,
    age_max: guards.APPROVED_AGE_MAX,
    // ON, identically on both arms. The experiment needs identical audience
    // CONFIGURATION, not identical realised delivery — and these creatives are
    // being judged in the environment we would actually run them in.
    targeting_automation: { advantage_audience: guards.ADVANTAGE_AUDIENCE_REQUIRED },
  }

  console.log('\nad set configuration, identical for both arms')
  console.log(`  lifetime_budget   ${guards.MAX_ADSET_LIFETIME_BUDGET_CENTS} cents`)
  console.log(`  schedule          ${start.toISOString()} -> ${end.toISOString()}`)
  console.log(`  optimization_goal ${guards.APPROVED_OPTIMISATION_GOAL}`)
  console.log(`  billing_event     ${guards.APPROVED_BILLING_EVENT}`)
  console.log(`  bid_strategy      ${guards.APPROVED_BID_STRATEGY}`)
  console.log(`  promoted_object   custom_conversion_id=${ccId}`)
  console.log(`  targeting         ${JSON.stringify(targeting)}`)

  if (!CONFIRM) {
    console.log('\nDry run complete. Nothing was created. Re-run with --confirm.')
    return
  }

  // --- 4. Create, PAUSED ---------------------------------------------------
  /**
   * Announced before the POST, not after.
   *
   * recordAction is deliberately NOT used: meta_ads_actions.experiment_id is a
   * non-null foreign key into the supervised experiment, and this campaign is
   * deliberately outside that supervision. Forcing a row in would assert a
   * relationship that does not exist. The terminal trace plus the
   * meta_creative_test_objects row written below are the durable record.
   */
  const announce = (what: string) => console.log(`  -> POST ${what}`)

  let campaign: { id: string }
  if (campaignId) {
    campaign = { id: campaignId }
    console.log(`\ncampaign  ${campaign.id}  PAUSED  (reused)`)
  } else {
    announce(`campaign ${CAMPAIGN_NAME}`)
    campaign = await createCampaignPaused({ name: CAMPAIGN_NAME, objective: 'OUTCOME_SALES' })
    console.log(`\ncampaign  ${campaign.id}  PAUSED`)
  }
  // Ad sets already present from an interrupted run, matched by cell name.
  const existingSets = campaignId ? await listAdSetsInCampaign(campaign.id) : []

  const created: Array<{ arm: typeof ARMS[number]; adSetId: string; creativeId: string; adId: string }> = []
  for (const arm of ARMS) {
    const already = existingSets.find((s) => s.name === arm.name)
    if (already) console.log(`  ${arm.name.padEnd(24)} ad set reused ${already.id}`)
    else announce(`ad set ${arm.name}`)
    const adSet = already ? { id: already.id } : await createAdSetPaused({
      name: arm.name,
      campaignId: campaign.id,
      lifetimeBudgetCents: guards.MAX_ADSET_LIFETIME_BUDGET_CENTS,
      startTimeIso: start.toISOString(),
      endTimeIso:   end.toISOString(),
      promotedObject: { custom_conversion_id: ccId! },
      targeting,
      expectedCustomConversionId: ccId!,
    }, authorisation!)

    announce(`creative ${arm.utmContent}`)
    const creative = await createAdCreative({
      name:             arm.utmContent,
      objectStorySpec:  specs[arm.name]!,
      urlTags:          urlTagsFor(arm.utmContent),
      expectedCampaign: CAMPAIGN.utm,
      expectedContent:  arm.utmContent,
    })

    announce(`ad ${arm.utmContent}`)
    const ad = await createAdPaused({
      name: arm.utmContent, adSetId: adSet.id, creativeId: creative.id,
    })

    created.push({ arm, adSetId: adSet.id, creativeId: creative.id, adId: ad.id })
    console.log(`  ${arm.name.padEnd(24)} adset=${adSet.id} creative=${creative.id} ad=${ad.id}  PAUSED`)
  }

  // Persist before verifying: if verification throws, the ids must not be lost.
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error: saveErr } = await sb.from('meta_creative_test_objects').insert({
    campaign_utm:          CAMPAIGN.utm,
    meta_campaign_id:      campaign.id,
    arm_a_name:            created[0]!.arm.name,
    arm_a_utm_content:     created[0]!.arm.utmContent,
    arm_a_adset_id:        created[0]!.adSetId,
    arm_a_creative_id:     created[0]!.creativeId,
    arm_a_ad_id:           created[0]!.adId,
    arm_b_name:            created[1]!.arm.name,
    arm_b_utm_content:     created[1]!.arm.utmContent,
    arm_b_adset_id:        created[1]!.adSetId,
    arm_b_creative_id:     created[1]!.creativeId,
    arm_b_ad_id:           created[1]!.adId,
    custom_conversion_id:  ccId!,
    lifetime_budget_cents: guards.MAX_ADSET_LIFETIME_BUDGET_CENTS,
  })
  if (saveErr) console.warn(`  (could not persist ids: ${saveErr.message}) — they are printed above`)
  else console.log('  ids persisted to meta_creative_test_objects')

  // --- 5. Verify what Meta actually stored ---------------------------------
  console.log('\n=== VERIFICATION (read back from Meta) ===')
  const result = await runExperimentPreflight({
    campaignId: campaign.id,
    arms: [
      { name: created[0]!.arm.name, adSetId: created[0]!.adSetId, adId: created[0]!.adId, utmContent: created[0]!.arm.utmContent },
      { name: created[1]!.arm.name, adSetId: created[1]!.adSetId, adId: created[1]!.adId, utmContent: created[1]!.arm.utmContent },
    ],
    expectedCustomConversionId: ccId!,
  })
  for (const c of result.checks) {
    const mark = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '?'
    console.log(`  ${mark} ${c.label.padEnd(52)} ${c.detail}`)
  }

  console.log(`\n${result.passed ? '✓ all checks passed' : '✗ ' + result.failures.length + ' failure(s)'}`)
  console.log('\nEverything is PAUSED. Activation requires a native randomised A/B split,')
  console.log('configured by hand in Ads Manager. No code path here can start delivery.')
}

main().catch((err) => {
  console.error('\n✗ FAILED —', err instanceof Error ? err.message : err)
  process.exit(1)
})
