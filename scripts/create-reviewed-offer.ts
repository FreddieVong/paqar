/**
 * Creates the REVIEWED_OFFER test's Meta objects — ALL PAUSED.
 *
 *   npx tsx scripts/create-reviewed-offer.ts --image-hash <hash>            # dry run
 *   npx tsx scripts/create-reviewed-offer.ts --image-hash <hash> --confirm  # creates
 *   ... --confirm --resume                                                 # continues a part-way run
 *
 * Requires NODE_OPTIONS="--conditions=react-server" so `server-only` resolves
 * to its empty module. That is not a bypass: it makes the script import the
 * REAL lib/meta-ads/client, so every guard applies exactly as it does in the
 * app. A script that called Graph directly would be a second implementation
 * with none of them.
 *
 * ── WHAT THIS TEST ASKS ────────────────────────────────────────────────────
 *
 * Every ad this account has ever run sold a product that no longer exists —
 * "masukkan nombor plat, harga pasaran dalam 30 saat", at "dari RM12", a free
 * instant lookup. RM494.15 of spend returned RM24. The live product is a RM29
 * report a human writes about one listing, and no paid visitor has ever seen
 * it advertised.
 *
 * So: does an ad that STATES the price produce a checkout? CTR is EXPECTED to
 * fall from 9.48% to roughly 1.5-2.5%. That is the hypothesis, not a
 * regression — a click that costs more but already knows the price is the
 * entire point. Judge on checkout_started / landing_page_view.
 *
 * ── WHY ONE ARM ────────────────────────────────────────────────────────────
 *
 * RM180 split two ways cannot produce a valid winner; that lesson has been
 * paid for twice. One ad set, one ad, one question.
 *
 * ── WHY TARGETING IS UNCHANGED ─────────────────────────────────────────────
 *
 * The brief that preceded this script proposed age 25-45 plus interest
 * 6832284024121 ("Vehicle sales websites"). Both were dropped. isTargetingAllowed
 * PINS age to APPROVED_AGE_MIN/MAX and requires Advantage+ Audience on, which
 * largely overrides interest targeting anyway — and changing the audience while
 * testing the creative would confound the one variable under test. Targeting is
 * therefore byte-identical to every prior experiment. The creative is the only
 * thing that moves.
 *
 * ── WHAT THIS SCRIPT CANNOT DO ─────────────────────────────────────────────
 *
 * Activate anything, or upload media. Every object is created PAUSED and stays
 * that way until a human starts it in Ads Manager. The client exports no upload
 * verb, so the image must already exist on the account — upload it in Ads
 * Manager and pass its hash. That is deliberate: media is the one part of an ad
 * a human should have looked at.
 *
 * FAIL-CLOSED CONDITIONS, all checked BEFORE anything is created:
 *   - META_VALUATION_STARTED_CUSTOM_CONVERSION_ID unset
 *   - that conversion not readable, archived, or not a valuation_started rule
 *   - no --image-hash / --video-id supplied
 *   - that image not present on the ad account
 *   - reconciled spend + RM180 over the allowance
 *   - a campaign of this name already exists (unless --resume, refused the
 *     moment any ad exists)
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
const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

async function main() {
  const [
    { createCampaignPaused, createAdSetPaused, createAdCreative, createAdPaused, collectLinks },
    { getCampaignSpendCents, listCampaigns, listAdSetsInCampaign, listAdsInAdSet, metaGetRaw },
    guards,
    { BASE_REPORT_LABEL },
  ] = await Promise.all([
    import('../lib/meta-ads/client'),
    import('../lib/meta-ads/insights').then(async (m) => ({
      ...m, metaGetRaw: (await import('../lib/meta-ads/client')).metaGet,
    })),
    import('../lib/meta-ads/guards'),
    import('../lib/pricing'),
  ])

  const CAMPAIGN_NAME = 'PAQAR_Reviewed_Offer_Aug26'
  const ADSET_NAME    = 'Reviewed_Offer'
  const AD_NAME       = 'reviewed_offer_price_stated'
  const UTM_CAMPAIGN  = 'reviewed_offer_aug26'
  const UTM_CONTENT   = 'price_stated'
  const DESTINATION   = 'https://paqar.my/'

  const stop = (why: string): never => {
    console.error(`\n✗ STOPPED — ${why}\n  Nothing was created.`)
    process.exit(1)
  }

  console.log(CONFIRM ? '=== CREATE (--confirm) ===' : '=== DRY RUN — nothing will be POSTed ===')

  // --- 1. The optimisation target, required and verified ------------------
  const ccId = process.env.META_VALUATION_STARTED_CUSTOM_CONVERSION_ID
  if (!ccId) {
    stop('META_VALUATION_STARTED_CUSTOM_CONVERSION_ID is not set.\n'
      + '  There is deliberately no fallback: the account\'s other conversion fires\n'
      + '  on valuation_completed, which is a different question.')
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
      + `  rule = ${cc!.rule}`)
  }

  // --- 2. The media, which a human must have uploaded and looked at -------
  const imageHash = argOf('--image-hash')
  const videoId   = argOf('--video-id')
  if (!imageHash && !videoId) {
    stop('no creative media. Pass --image-hash <hash> or --video-id <id>.\n'
      + '  Upload the asset in Ads Manager first (Media Library), then copy its hash.\n'
      + '  This codebase has no upload verb by design — the image is the one part\n'
      + '  of an ad a person should have looked at before it runs.')
  }
  if (imageHash) {
    // READS `data`, NOT `images`. The /adimages EDGE returns a data array;
    // `{images: {...}}` is the shape the upload POST returns. Reading the
    // wrong key made this refuse an image that was demonstrably on the
    // account — a fail-closed guard that fails closed on everything is just
    // an outage.
    const img = await metaGetRaw<{ data?: { hash?: string; name?: string; width?: number; height?: number }[] }>(
      `${process.env.META_AD_ACCOUNT_ID}/adimages`,
      { fields: 'hash,name,width,height', hashes: JSON.stringify([imageHash]) },
    ).catch(() => null)
    const hit = img?.data?.find((i) => i.hash === imageHash)
    if (!hit) stop(`image hash ${imageHash} is not on this ad account.`)
    console.log(`\nimage             ${imageHash}`)
    console.log(`  ${hit!.name} — ${hit!.width}x${hit!.height}`)
    // 4:5 is the placement this account has always used. A wrong ratio is not
    // fatal, so this warns rather than stops.
    if (hit!.width && hit!.height && Math.abs(hit!.width / hit!.height - 0.8) > 0.02) {
      console.log(`  ! not 4:5 — every prior Paqar graphic was 1080x1350`)
    }
  } else {
    console.log(`\nvideo             ${videoId}`)
  }

  // --- 3. Spend, reconciled from insights rather than Meta's counter ------
  const campaigns = await listCampaigns()
  const existing = campaigns.find((c) => c.name === CAMPAIGN_NAME)

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
    console.log(`\nRESUMING ${CAMPAIGN_NAME} (${campaignId}) — ${sets.length} ad set(s), 0 ads.`)
  }

  let cumulativeCents = 0
  console.log('\nreconciled lifetime spend')
  for (const c of campaigns) {
    const cents = await getCampaignSpendCents(c.id)
    if (cents == null) {
      stop(`spend for campaign ${c.name} (${c.id}) is unreadable.\n`
        + '  An unreadable figure is never treated as zero — that is how an\n'
        + '  experiment runs past its allowance unchallenged.')
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

  // --- 4. The creative that states the price ------------------------------
  /**
   * The price is DERIVED from lib/pricing, never typed. A campaign that
   * advertises a figure the checkout does not charge is the exact failure
   * BASE_REPORT_LABEL exists to prevent, and this ad's whole hypothesis is
   * that the stated price is what changes behaviour.
   *
   * Copy checked against the standing rules: "deposit" alone (never "booking
   * atau deposit"), "seller" not "penjual", no unscoped "Percuma", and no
   * claim about odometer tampering.
   */
  const message = [
    'Dah jumpa kereta di Mudah atau Carlist, tapi tak pasti harga tu berpatutan?',
    '',
    'Hantar link iklan tu. Orang kami baca iklan yang itu, banding dengan iklan '
      + 'setanding yang ada sekarang, dan beritahu berapa patut anda tawar — dan bila patut jalan.',
    '',
    `${BASE_REPORT_LABEL}. Biasanya siap dalam 30 minit. Bukan robot, bukan laporan auto.`,
  ].join('\n')

  const linkData: Record<string, unknown> = {
    link:             DESTINATION,
    message,
    name:             `Berbaloi ke harga tu? ${BASE_REPORT_LABEL}, disemak orang.`,
    description:      'Semak sebelum bayar deposit',
    call_to_action:   { type: 'LEARN_MORE', value: { link: DESTINATION } },
  }
  if (imageHash) linkData.image_hash = imageHash

  const objectStorySpec: Record<string, unknown> = videoId
    ? { page_id: PAGE_ID, instagram_user_id: IG_ID, video_data: { ...linkData, video_id: videoId } }
    : { page_id: PAGE_ID, instagram_user_id: IG_ID, link_data: linkData }

  const urlTags = `utm_source=${guards.META_SOURCE_MACRO}`
    + `&utm_medium=${guards.REQUIRED_UTM.utm_medium}`
    + `&utm_campaign=${UTM_CAMPAIGN}&utm_content=${UTM_CONTENT}`

  const start = new Date(Date.now() + 10 * 60_000)
  const end   = new Date(start.getTime() + guards.TEST_DURATION_DAYS * 86_400_000)

  const targeting = {
    geo_locations: { countries: [guards.ALLOWED_COUNTRY] },
    age_min: guards.APPROVED_AGE_MIN,
    age_max: guards.APPROVED_AGE_MAX,
    targeting_automation: { advantage_audience: guards.ADVANTAGE_AUDIENCE_REQUIRED },
  }

  console.log('\ncreative')
  console.log(`  headline     ${linkData.name}`)
  console.log(`  description  ${linkData.description}`)
  console.log(`  destinations ${JSON.stringify(collectLinks(objectStorySpec))}`)
  console.log(`  url_tags     ${urlTags}`)
  console.log('  primary text:')
  for (const l of message.split('\n')) console.log(`    ${l}`)

  console.log('\nad set configuration')
  console.log(`  lifetime_budget   ${guards.MAX_ADSET_LIFETIME_BUDGET_CENTS} cents `
    + `(RM${guards.MAX_ADSET_LIFETIME_BUDGET_CENTS / 100})`)
  console.log(`  schedule          ${start.toISOString()} -> ${end.toISOString()} `
    + `(${guards.TEST_DURATION_DAYS} days)`)
  console.log(`  optimization_goal ${guards.APPROVED_OPTIMISATION_GOAL}`)
  console.log(`  billing_event     ${guards.APPROVED_BILLING_EVENT}`)
  console.log(`  bid_strategy      ${guards.APPROVED_BID_STRATEGY}`)
  console.log(`  promoted_object   custom_conversion_id=${ccId}`)
  console.log(`  targeting         ${JSON.stringify(targeting)}`)

  if (!CONFIRM) {
    console.log('\nDry run complete. Nothing was created. Re-run with --confirm.')
    return
  }

  // --- 5. Create, PAUSED --------------------------------------------------
  const announce = (what: string) => console.log(`  -> POST ${what}`)

  console.log('\ncreating (everything PAUSED)')
  if (!campaignId) {
    announce(`campaign ${CAMPAIGN_NAME}`)
    campaignId = (await createCampaignPaused({
      name: CAMPAIGN_NAME, objective: 'OUTCOME_SALES',
    })).id
    console.log(`     campaign ${campaignId}`)
  }

  announce(`ad set ${ADSET_NAME}`)
  const adSetId = (await createAdSetPaused({
    name:                ADSET_NAME,
    campaignId:          campaignId!,
    lifetimeBudgetCents: guards.MAX_ADSET_LIFETIME_BUDGET_CENTS,
    startTimeIso:        start.toISOString(),
    endTimeIso:          end.toISOString(),
    promotedObject:      { custom_conversion_id: ccId!, pixel_id: process.env.META_PIXEL_OR_DATASET_ID! },
    targeting,
    expectedCustomConversionId: ccId!,
  }, authorisation!)).id
  console.log(`     ad set ${adSetId}`)

  announce(`creative ${AD_NAME}`)
  const creativeId = (await createAdCreative({
    name:             AD_NAME,
    objectStorySpec,
    urlTags,
    expectedCampaign: UTM_CAMPAIGN,
    expectedContent:  UTM_CONTENT,
  })).id
  console.log(`     creative ${creativeId}`)

  announce(`ad ${AD_NAME}`)
  const adId = (await createAdPaused({
    name: AD_NAME, adSetId, creativeId,
  })).id
  console.log(`     ad ${adId}`)

  console.log('\n✓ Created, all PAUSED. Nothing is delivering.')
  console.log('\nNEXT, by hand in Ads Manager:')
  console.log(`  1. Review the ad preview on ${AD_NAME}.`)
  console.log('  2. Confirm the account spending limit still reads '
    + `RM${guards.MAX_TOTAL_SPEND_MYR}.00 exactly.`)
  console.log('  3. Start the campaign.')
  console.log(`\nThen add to CAMPAIGNS in lib/meta-ads/guards.ts:`)
  console.log(`  reviewedOffer: { utm: '${UTM_CAMPAIGN}', `
    + `creatives: ['${UTM_CONTENT}', '${UTM_CONTENT}_b'], metaCampaignId: '${campaignId}' }`)
}

/** The Paqar page and Instagram account every creative has ever posted from. */
const PAGE_ID = '1200332453170023'
const IG_ID   = '17841443483424936'

main().catch((e) => { console.error(e); process.exit(1) })
