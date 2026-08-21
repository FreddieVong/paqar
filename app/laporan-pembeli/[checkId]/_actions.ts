'use server'

import { BASE_REPORT_CENTS, COMBINED_CENTS, historyUpgradeAvailable } from '@/lib/pricing'
import { createBill, getBill }    from '@/lib/billplz'
import { resolveOfferForCheck }  from '@/lib/server/offer-for-check'
import { freezeOfferSnapshot }   from '@/lib/db/offer-snapshots'
import { OFFER_UNAVAILABLE_MESSAGE } from '@/lib/offer'
import { createBuyerReport,
         getBuyerReport,
         getReusableBaseBill,
         checkHasPaidReport,
         markUpgradePaidByReportId,
         setUpgradeBillId,
         setVehicleApiData }      from '@/lib/db/buyer-reports'
import { getCheck }               from '@/lib/db/checks'
import { fetchAndCacheMarketPrices } from '@/lib/db/market-prices'
import { getValuationByNvic }     from '@/lib/db/vehicle-valuations'
import { env }                    from '@/lib/env'
import { decrypt }                from '@/lib/crypto'
import { buildMarketModelKeyword } from '@/lib/market-keyword'
import { getOrFetchVehicleData }  from '@/lib/db/plate-lookups'
import { createClient }           from '@/lib/supabase/server'
import { currentAttribution }     from '@/lib/attribution-request'
import { recordCheckoutAttribution, recordAdEvent, markCapiSent } from '@/lib/db/ad-attribution'
import { eventId }                from '@/lib/attribution'
import type { ValuationPath }     from '@/lib/funnel-stages'
import { normaliseMyMobile }      from '@/lib/phone-my'
import { checkoutEventId }        from '@/lib/checkout-event-id'
import { sendMetaEvent }          from '@/lib/meta-capi'
import { reportMoneyPathFailure } from '@/lib/observability'

/**
 * Persists attribution at BILL CREATION so a purchase can be attributed from
 * the Billplz webhook alone. A customer who pays and immediately closes the
 * tab never reaches /selesai; without this row that sale would be
 * unattributable, and guessing by paid_at proximity is not acceptable.
 *
 * Best-effort by construction: attribution must never fail a payment.
 */
async function captureCheckout(params: {
  billId:        string
  checkId:       string
  buyerReportId?: string | null
  product:       'buyer_report' | 'buyer_report_bundle' | 'claim_check_upgrade'
  amountCents:   number
  /**
   * Buyer email, hashed into user_data.em on the InitiateCheckout event.
   *
   * Meta's "send missing user data parameters" diagnostic accepts only
   * PII-derived keys — email, phone, name, city, region, postcode — and
   * explicitly not external_id. PageView, Lead and ViewContent fire before
   * Paqar has ever asked for an email, so they cannot satisfy it. Checkout is
   * the first point in the funnel where a real email exists, so it is the
   * first event that can.
   */
  buyerEmail?:   string | null
  /**
   * The journey this bill belongs to. recordAdEvent has accepted this since
   * migration 021; this function simply never passed it, so every
   * checkout_started row in production carries NULL and the purchase inheriting
   * from it had nothing to inherit.
   */
  valuationPath?: ValuationPath | null
}): Promise<void> {
  try {
    const { sessionId, attribution } = await currentAttribution()
    await recordCheckoutAttribution({
      billId:        params.billId,
      buyerReportId: params.buyerReportId ?? null,
      checkId:       params.checkId,
      sessionId,
      attribution,
      product:       params.product,
      amountCents:   params.amountCents,
    })
    if (sessionId) {
      const id = eventId.checkoutStarted(params.billId)
      const result = await recordAdEvent({
        sessionId,
        eventName:     'checkout_started',
        eventId:       id,
        attribution,
        checkId:       params.checkId,
        billId:        params.billId,
        amountCents:   params.amountCents,
        valuationPath: params.valuationPath ?? null,
      })

      // Forward to Meta as InitiateCheckout. This event was already being
      // recorded but never sent, leaving a gap in the funnel Meta can see:
      // PageView -> Lead -> ViewContent -> (nothing) -> Purchase.
      //
      // It matters because Purchase alone is too sparse to optimise on —
      // Meta wants roughly 50 conversions a week and there have been ~21
      // purchases in total. InitiateCheckout is the highest-intent event
      // with enough volume to actually drive delivery.
      //
      // Only a genuinely new occurrence is sent; a retry returns duplicate
      // and sends nothing, so a re-submitted payment cannot double-count.
      //
      // The Meta event_id must match the BROWSER pixel's. Both sides call
      // checkoutEventId so they cannot drift: the bill id does not exist
      // client-side, so a bill-derived id could never collide with the
      // browser's and Meta would count every checkout TWICE.
      //
      // The +RM88 upgrade is the exception — JomCheckUpsell fires no browser
      // InitiateCheckout, so there is nothing to deduplicate against and it
      // keeps the bill-derived id.
      if (result.status === 'inserted') {
        const metaEventId = params.product === 'claim_check_upgrade'
          ? id
          : checkoutEventId(params.checkId, params.product === 'buyer_report_bundle')
        const sent = await sendMetaEvent({
          eventName:  'InitiateCheckout',
          eventId:    metaEventId,
          email:      params.buyerEmail ?? null,
          externalId: sessionId,
          attribution,
          sourceUrl:  `https://paqar.my/laporan-pembeli/${params.checkId}`,
          valueMyr:   params.amountCents / 100,
          customData: { paqar_step: 'checkout_started' },
        })
        if (sent) await markCapiSent('checkout_started', id)
      }
    }
  } catch (err) {
    console.error('[captureCheckout]', err)
  }
}

/**
 * createBill, with the guarantee the optional phone field is supposed to carry:
 * a number Billplz will not accept costs us the number, never the sale.
 *
 * normaliseMyMobile already rejects everything it recognises as wrong, but it
 * cannot know every rule Billplz enforces — a number with a valid 01X prefix
 * can still be refused (unallocated range, a carrier Billplz does not accept,
 * a future validation change). Without this the buyer sees "Ralat membuat
 * pembayaran" and retrying with the same number fails identically, so the
 * optional field becomes a hard block on checkout.
 *
 * Deliberately narrow:
 *  - only retries when a mobile was actually attached, so a genuine failure
 *    (bad credentials, collection missing, Billplz down) still surfaces on the
 *    first attempt instead of being tried twice and reported late;
 *  - retries exactly once, with the mobile removed and every other field
 *    identical — same amount, same collection, same callback and redirect URLs;
 *  - re-throws the SECOND error if the retry also fails, because at that point
 *    the mobile was not the problem.
 *
 * The dropped number is logged (without the number itself) so a format Billplz
 * systematically rejects is visible rather than silently eroding the follow-up
 * channel this field exists to create.
 */
async function createBillDroppingBadMobile(
  params: Parameters<typeof createBill>[0],
): Promise<Awaited<ReturnType<typeof createBill>>> {
  try {
    return await createBill(params)
  } catch (err) {
    if (!params.mobile) throw err
    console.error('[initiateBuyerReport] bill rejected with mobile; retrying without it', {
      op: 'billplz_create_retry', error: String(err).slice(0, 200),
    })
    return await createBill({ ...params, mobile: null })
  }
}

/**
 * Collapses simultaneous checkout attempts for one (check, amount).
 *
 * The durable row is what stops a buyer accumulating bills MINUTES apart — the
 * shape actually seen in production, 87 seconds and ~4 minutes. This closes the
 * narrower same-instant window: two requests that both read "no reusable bill"
 * before either has written one, and both mint.
 *
 * In-process only, and honestly so. Two requests served by different serverless
 * instances at the same moment can still produce two bills; both would have
 * their own row and stay reconcilable, and the next attempt reuses one of them.
 * A cross-instance lock would need a DB constraint, which is a larger change
 * than the observed behaviour justifies.
 */
const checkoutInFlight = new Map<string, Promise<{ error: string | null; billUrl?: string; billId?: string }>>()

export interface InitiateBuyerReportParams {
  checkId:           string
  claimToken:        string
  buyerEmail:        string
  /** Optional. Never validated strictly enough to block a payment. */
  buyerPhone?:       string
  baseUrl:           string
  addJomCheck?:      boolean
  askingPriceRm?:    number
  claimedMileageKm?: number
  /**
   * Which journey this checkout belongs to, named by the surface the form was
   * rendered on. Optional so an older cached bundle keeps working, but every
   * live call site supplies it — without it checkout_started and purchase
   * record valuation_path = NULL, which is what made 100% of purchases
   * unattributable to a journey in the 2026-08-17 audit.
   */
  valuationPath?:    ValuationPath
}

export async function initiateBuyerReport(
  params: InitiateBuyerReportParams,
): Promise<{ error: string | null; billUrl?: string; billId?: string }> {
  const key = `${params.checkId}|${params.addJomCheck ? 'bundle' : 'base'}`
  const running = checkoutInFlight.get(key)
  if (running) return running

  const run = initiateBuyerReportImpl(params).finally(() => { checkoutInFlight.delete(key) })
  checkoutInFlight.set(key, run)
  return run
}


async function initiateBuyerReportImpl(
  params: InitiateBuyerReportParams,
): Promise<{ error: string | null; billUrl?: string; billId?: string }> {
  if (!params.buyerEmail.includes('@')) {
    return { error: 'Alamat e-mel tidak sah' }
  }

  let row = await getCheck(params.checkId, params.claimToken)
  // Fallback: check was auto-claimed (claim_token set to null) — allow if user owns it
  if (!row) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const candidate = await getCheck(params.checkId)
      if (candidate?.check.user_id === user.id) row = candidate
    }
  }
  if (!row) return { error: 'Semakan tidak dijumpai' }
  if (row.check.status !== 'complete') return { error: 'Semakan belum selesai' }

  // Never sell the same report twice.
  //
  // /check/[id] renders the payment form as soon as a check is complete and
  // never asks whether it has already been bought, so a buyer with that URL in
  // their history can be shown the paywall again after paying. Without this
  // guard a second Billplz bill is created and a second buyer_reports row
  // inserted — the buyer is charged twice for one entitlement, and the stray
  // row used to hide the paid one from the report page as well.
  //
  // Checked server-side because that is the only place it cannot be bypassed
  // by a stale tab, a back button, or a page that forgot to ask.
  if (await checkHasPaidReport(params.checkId).catch(() => false)) {
    return { error: 'Laporan ini sudah dibayar — buka laporan anda dari pautan asal atau e-mel resit.' }
  }

  // OFFER GATE — the server decides whether Paqar may sell, every time.
  //
  // The paywall promises a negotiation target. If the report cannot produce
  // one, taking RM12 is charging for a headline the product cannot deliver.
  //
  // Recomputed HERE from the database rather than trusting anything the client
  // sent: `offerAvailable` crosses to the browser only so the paywall can
  // render honestly, and a rendering hint is not authorisation. A stale tab, an
  // edited response, or a cohort that changed since the pitch rendered must not
  // be able to open a charge.
  //
  // Cache reads only — no provider call, no scrape. A checkout attempt is not a
  // reason to queue a scraper job.
  const offerCheck = await resolveOfferForCheck({
    plateEncrypted: row.check.plate_encrypted as string,
    askingPriceRm:  params.askingPriceRm ?? null,
  }).catch(() => null)

  // Fail CLOSED. An unresolved gate is not permission to sell.
  if (!offerCheck || offerCheck.status !== 'resolved' || !offerCheck.offer.available) {
    return { error: OFFER_UNAVAILABLE_MESSAGE }
  }

  // FREEZE THE EVIDENCE BEFORE A BILL CAN EXIST.
  //
  // The gate above proves an offer exists RIGHT NOW. The paid report recomputes
  // from the live cache when it renders, and between those two moments the
  // cohort can move — the warm-cache cron overwrites it, another visitor
  // refreshes it, or CACHE_TTL_DAYS expires. Freezing here is what makes the
  // report show what was bought rather than what the market looks like later.
  //
  // This ALSO fails closed, and deliberately so: selling first and freezing
  // afterwards would take the money and leave the promise unbacked, which is
  // the failure this whole feature exists to prevent. A snapshot that cannot be
  // written is a sale that must not happen.
  const frozen = await freezeOfferSnapshot({
    checkId:         params.checkId,
    cohort:          offerCheck.cohort,
    offer:           offerCheck.offer,
    sourceFetchedAt: offerCheck.sourceFetchedAt,
  })
  if (frozen.status === 'failed') {
    console.error('[checkout] refusing to sell — snapshot not frozen:', frozen.reason)
    return { error: OFFER_UNAVAILABLE_MESSAGE }
  }

  // Hoisted above the reuse check: which product the buyer is asking for
  // decides which bill may be handed back. Pure computation, no side effects.
  const jomcheckEnabled      = historyUpgradeAvailable()
  const effectiveAddJomCheck = jomcheckEnabled && !!params.addJomCheck
  const amountCents          = effectiveAddJomCheck ? COMBINED_CENTS : BASE_REPORT_CENTS

  // ONE UNPAID INTENT, ONE PAYABLE BILL.
  //
  // Every attempt used to mint a fresh Billplz bill. Two real external buyers
  // did exactly that: one check produced 2 bills 87 seconds apart, another 3
  // across ~4 minutes. None were paid, so nobody was charged twice — but each
  // extra bill stays independently payable, and a buyer holding several live
  // links is a double-payment surface kept closed only by luck.
  //
  // Unlike the RM88 upgrade, the base path never overwrote anything: each bill
  // got its OWN row, so old bills always remained reconcilable. That property
  // is preserved here — reuse adds no row and rewrites no id.
  const reusable = await getReusableBaseBill(params.checkId, amountCents).catch(() => null)
  if (reusable) {
    const existing = await getBill(reusable.billId)

    if (existing?.paid || existing?.state === 'paid') {
      // Paid, but this check has no paid row — checkHasPaidReport already said
      // so. The webhook was missed. Say it loudly rather than quietly selling
      // the same report again.
      reportMoneyPathFailure('base_bill_already_paid_on_retry', {
        billId: reusable.billId, buyerReportId: reusable.id, amountCents,
        reason: 'billplz reports paid but no paid report row exists',
      })
      return { error: 'Pembayaran anda sedang disahkan — sila semak e-mel resit atau cuba sebentar lagi.' }
    }

    // Reuse while payable, and ALSO when Billplz cannot be reached: handing
    // back a link that probably works beats minting a second live bill just
    // because a status call timed out.
    //
    // `state` IS the whole test. due_at is explicitly NOT an expiry — see the
    // note on BillplzBillState.dueAt. A bill sitting at state 'due' with a
    // due_at from last month is still payable, and that is exactly the buyer
    // this reuse exists for: the one who left yesterday and came back today.
    if (!existing || existing.state === 'due') {
      return { error: null, billUrl: reusable.billUrl, billId: reusable.billId }
    }

    // Conclusively dead (deleted/expired). Fall through to a replacement. The
    // old row keeps its own bill id, so a late payment on it still resolves
    // through getBuyerReportByBillId.
    reportMoneyPathFailure('base_bill_unpayable_replaced', {
      billId: reusable.billId, buyerReportId: reusable.id, amountCents,
      reason: `billplz state=${existing.state}; minting a replacement`,
    }, 'info')
  }

  try {
    const description      = effectiveAddJomCheck
      ? `Laporan Pembeli + Semakan Accident/Claim - ${params.checkId}`
      : `Laporan Pembeli Paqar - ${params.checkId}`

    // Dropped silently when unrecognised: Billplz rejects a malformed number
    // and losing the sale to a typo is worse than losing the number.
    const mobile = normaliseMyMobile(params.buyerPhone)

    const bill = await createBillDroppingBadMobile({
      email:        params.buyerEmail,
      name:         params.buyerEmail,
      mobile,
      amountCents,
      description,
      callbackUrl:  `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl:  `${params.baseUrl}/laporan-pembeli/${params.checkId}/selesai?claim_token=${params.claimToken}`,
      collectionId: env.BILLPLZ_COLLECTION_ID_BUYER ?? env.BILLPLZ_COLLECTION_ID,
    })

    let report
    try {
      report = await createBuyerReport({
        checkId:          params.checkId,
        buyerEmail:       params.buyerEmail,
        billplzBillId:    bill.id,
        billplzBillUrl:   bill.url,
        buyerPhone:       mobile,
        amountCents,
        addJomCheck:      effectiveAddJomCheck,
        askingPriceRm:    params.askingPriceRm,
        claimedMileageKm: params.claimedMileageKm,
      })
    } catch (err) {
      // THE ORPHAN INTERVAL. The Billplz bill already exists and is payable,
      // and this is the write that was supposed to make it ours. Without a row
      // the bill appears in no Paqar table, so reconcile-payments — which walks
      // ids out of buyer_reports and checkout_attributions — cannot see it at
      // all. If the buyer somehow pays it, the webhook finds no report either.
      //
      // Nothing here can undo the bill, so the only honest response is to make
      // it loud: the id is the one piece of information that makes manual
      // recovery possible later.
      reportMoneyPathFailure('base_bill_orphaned', {
        billId:      bill.id,
        checkId:     params.checkId,
        amountCents,
        reason:      'billplz bill created but buyer_reports insert failed',
      })
      throw err
    }

    await captureCheckout({
      billId:        bill.id,
      checkId:       params.checkId,
      buyerReportId: report.id,
      product:       effectiveAddJomCheck ? 'buyer_report_bundle' : 'buyer_report',
      amountCents,
      buyerEmail:    params.buyerEmail,
      valuationPath: params.valuationPath ?? null,
    })

    // Pre-warm vehicle data and market prices during the Billplz payment window (~30-60s).
    // By the time the user lands on the report page, the data is already cached.
    const plate = decrypt(row.check.plate_encrypted as string).toUpperCase()
    void prewarmReportData(plate, report.id)

    return { error: null, billUrl: bill.url, billId: bill.id }
  } catch (err) {
    console.error('[initiateBuyerReport]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}

// +RM88 JomCheck add-on for an already-paid RM12 report. Creates a separate
// Billplz bill; the webhook (or the redirect page) flips add_jomcheck on payment.
export async function initiateJomCheckUpgrade(params: {
  checkId:    string
  claimToken: string
  baseUrl:    string
}): Promise<{ error: string | null; billUrl?: string; billId?: string }> {
  if (!historyUpgradeAvailable()) {
    return { error: 'Semakan Accident/Claim belum tersedia' }
  }

  let row = await getCheck(params.checkId, params.claimToken)
  if (!row) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const candidate = await getCheck(params.checkId)
      if (candidate?.check.user_id === user.id) row = candidate
    }
  }
  if (!row) return { error: 'Semakan tidak dijumpai' }

  const report = await getBuyerReport(params.checkId)
  if (!report || report.status !== 'paid') return { error: 'Laporan belum dibayar' }
  if (report.add_jomcheck) return { error: 'Semakan Accident/Claim sudah ditambah' }

  // Send them back to the bill they already have — but only while it can
  // actually still be paid.
  //
  // Every Billplz bill stays payable until it is paid, so minting a second one
  // and overwriting upgrade_bill_id left the first alive but unrecognisable:
  // pay it later and the webhook looks up an id the column no longer holds, and
  // the entitlement never lands. Reuse removes that state entirely.
  //
  // Reusing BLINDLY creates the opposite trap. A bill that is deleted, or one
  // already paid whose webhook we missed, would hand the buyer a dead page
  // every time they click, forever. So the stored bill is verified first:
  //
  //   paid          the webhook was missed. Grant the entitlement here rather
  //                 than send them to a page that will not take their money
  //                 again — they have already paid.
  //   due           still payable, reuse it.
  //   anything else deleted, or a state Billplz has introduced since. Replace
  //                 it. The superseded bill stays reconcilable through
  //                 checkout_attributions, so a late payment still lands.
  //   unknown       lookup failed. Keep the existing bill: a transient Billplz
  //                 blip must not spawn duplicates, and if Billplz is down the
  //                 payment page is down too. The next attempt re-checks, so
  //                 nothing is permanent.
  //
  // Only reports predating migration 028 have an id with no URL; those fall
  // through and mint a replacement, which reconciliation covers.
  if (report.upgrade_bill_id && report.upgrade_bill_url) {
    const existing = await getBill(report.upgrade_bill_id)

    if (existing?.paid || existing?.state === 'paid') {
      const granted = await markUpgradePaidByReportId(report.id).catch(() => false)
      // Error only when this click is what granted the entitlement: the buyer
      // had paid and did not have the product until they happened to click
      // again, so the webhook needs investigating. If it was already granted,
      // this is just a second click on a finished purchase.
      reportMoneyPathFailure('upgrade_bill_already_paid_on_retry', {
        billId: report.upgrade_bill_id, buyerReportId: report.id, amountCents: 8800,
        reason: granted ? 'entitlement granted on retry — webhook was missed' : 'already granted',
      }, granted ? 'error' : 'info')
      return { error: 'Semakan Accident/Claim sudah ditambah' }
    }

    // Reuse while payable, and also when Billplz could not be reached.
    if (!existing || existing.state === 'due') {
      return { error: null, billUrl: report.upgrade_bill_url, billId: report.upgrade_bill_id ?? undefined }
    }

    // Conclusively not payable. Fall through and replace it. Info: this is the
    // designed escape from a dead bill, not a fault — the buyer is about to be
    // handed a working payment link. Kept as a record so a spike in replaced
    // bills is still visible.
    reportMoneyPathFailure('upgrade_bill_unpayable_replaced', {
      billId: report.upgrade_bill_id, buyerReportId: report.id,
      reason: `billplz state=${existing.state}; minting a replacement`,
    }, 'info')
  }

  try {
    const bill = await createBill({
      email:        report.buyer_email,
      name:         report.buyer_email,
      amountCents:  8800,
      description:  `Semakan Accident/Claim (add-on) - ${params.checkId}`,
      callbackUrl:  `${params.baseUrl}/api/webhooks/billplz`,
      redirectUrl:  `${params.baseUrl}/laporan-pembeli/${params.checkId}/selesai?claim_token=${params.claimToken}&upgrade=1`,
      collectionId: env.BILLPLZ_COLLECTION_ID_BUYER ?? env.BILLPLZ_COLLECTION_ID,
    })
    await setUpgradeBillId(report.id, bill.id, bill.url)
    await captureCheckout({
      billId:        bill.id,
      checkId:       params.checkId,
      buyerReportId: report.id,
      product:       'claim_check_upgrade',
      amountCents:   8800,
      buyerEmail:    report.buyer_email,
      // The RM88 upsell exists on exactly one surface — the paid report at
      // /laporan-pembeli — so this is the surface's own name, not a guess from
      // a URL. Same convention as PaymentForm, which labels the form by the
      // route it renders on rather than by where the visitor originally came
      // from.
      valuationPath: 'plate_report',
    })
    return { error: null, billUrl: bill.url, billId: bill.id }
  } catch (err) {
    console.error('[initiateJomCheckUpgrade]', err)
    return { error: 'Ralat membuat pembayaran — sila cuba semula' }
  }
}

async function prewarmReportData(plate: string, reportId: string): Promise<void> {
  try {
    // Cache-first: if the free teaser already looked this plate up, no new API cost
    const apiResult = await getOrFetchVehicleData(plate)
    if (!apiResult) return

    const valuation = await getValuationByNvic(apiResult.nvic, {
      make:  apiResult.make,
      year:  apiResult.registrationYear,
      model: apiResult.model,
    }).catch(() => null)

    const vehicleData = { ...apiResult, valuation: valuation ?? null }
    await setVehicleApiData(reportId, vehicleData)

    const mo = buildMarketModelKeyword(apiResult.model, apiResult.description ?? '')
    fetchAndCacheMarketPrices(apiResult.make, mo, apiResult.registrationYear).catch(() => {})
  } catch {
    // non-fatal — report loads lazily on first view if this fails
  }
}
