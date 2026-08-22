'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'
import { BRANDS, MODELS_BY_BRAND } from '@/lib/model-catalog'
import { ScreenshotUpload } from './ScreenshotUpload'
import { analytics } from '@/lib/analytics'
import { trackValuationStarted, getTrafficContext } from '@/lib/ga4-events'
import { trackAdEvent } from '@/lib/meta-events'
import { BASE_REPORT_LABEL } from '@/lib/pricing'
import { TYPICAL_MINUTES } from '@/lib/review-capacity'
import type { MergedListing } from '@/lib/listing-merge'

/**
 * ONE form for one job: hand Paqar the car you already found.
 *
 * ── THE JOURNEY THE BUYER SEES ─────────────────────────────────────────────
 *
 *   paste a link OR drop screenshots -> one summary -> coverage -> RM29
 *
 * There is no "draft", no wizard, and no step labelled intake. The anonymous
 * intake is created the moment the buyer does anything, and they never learn it
 * exists — it is bookkeeping that lets screenshots be stored before Paqar knows
 * what car it is.
 *
 * ── URL AND SCREENSHOTS ARE ALTERNATIVES ───────────────────────────────────
 *
 * Either is sufficient. A Carlist or Facebook link is ACCEPTED and stored even
 * though Paqar cannot fetch it — a human opens it during review — and the buyer
 * is asked for screenshots instead of being told anything about hosts, HTTP or
 * policies. They pasted a perfectly good link; nothing they did was wrong.
 *
 * ── MANUAL ENTRY IS THE FALLBACK, NOT THE DEFAULT ──────────────────────────
 *
 * The car fields appear only when extraction could not fill them, and only the
 * ones still missing. A buyer whose link parsed cleanly never sees a dropdown.
 */

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#3D472F] focus:ring-[3px] focus:ring-[#3D472F]/10
  transition-all`
const LABEL_CLS = 'block font-heading font-bold text-[12px] text-[#111827] mb-1.5'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1994 }, (_, i) => String(CURRENT_YEAR - i))

type Coverage = { eligible: boolean; modelLabel: string }
type Phase = 'start' | 'working' | 'summary' | 'coverage'

export function ListingIntakeForm({
  initialBrand = '', initialModel = '', initialYear = '',
}: { initialBrand?: string; initialModel?: string; initialYear?: string } = {}) {
  const router = useRouter()

  const [intakeId, setIntakeId] = useState<string | null>(null)
  // Held in memory only. Never a URL, never localStorage, never logged.
  const tokenRef = useRef<string | null>(null)
  /**
   * The id, mirrored in a ref.
   *
   * `intakeId` state is null during the render in which the intake is created,
   * and callbacks fired from a CHILD (the screenshot upload) run before the
   * parent re-renders. Reading state there meant the first upload never
   * triggered extraction — the file landed in storage and no summary ever
   * appeared, which is exactly the "upload not working" symptom.
   */
  const intakeIdRef = useRef<string | null>(null)

  const [listingUrl, setListingUrl] = useState('')
  const [phase,      setPhase]      = useState<Phase>('start')
  const [summaryState, setSummary]  = useState<MergedListing | null>(null)
  const summary = summaryState
  const [needShots,  setNeedShots]  = useState(false)
  // Which input the buyer actually used, so a failure can name the right thing.
  const [shotCount,  setShotCount]  = useState(0)
  // True when the read failed on OUR side (no API key, timeout, rate limit) —
  // as opposed to a screenshot we genuinely could not read.
  const [ourFault,   setOurFault]   = useState(false)
  /**
   * Did the BUYER change a field, or is this just what extraction found?
   *
   * "any field is non-empty" cannot tell the difference: a successful
   * extraction prefills brand, model, year and price, so that test is always
   * true and every buyer paid for a pointless round trip saving Paqar's own
   * output back to Paqar.
   */
  const [dirty,      setDirty]      = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [coverage,   setCoverage]   = useState<Coverage | null>(null)
  // The link was a results page, not one advert. Not an error state — the
  // buyer pasted the page they were looking at.
  const [searchPage, setSearchPage] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifySent,  setNotifySent]  = useState(false)
  // Screenshots are the secondary path — revealed on request, so a first-time
  // reader sees one action rather than a choice between two.
  const [showUpload,  setShowUpload]  = useState(false)
  const urlRef    = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [status,     setStatus]     = useState<string | null>(null)

  const [brand, setBrand] = useState(initialBrand)
  const [model, setModel] = useState(initialModel)
  // Prefilled on the year pages (/harga-model/honda-city-2019), which know the
  // year from their own route. Extraction still overwrites it — what the advert
  // says beats what the page it was reached from assumed.
  const [year,  setYear]  = useState(initialYear)
  const [price, setPrice] = useState('')
  const [plate, setPlate] = useState('')
  const [concern, setConcern] = useState('')

  const engaged = useRef(false)
  const markEngaged = () => { if (!engaged.current) { engaged.current = true; analytics.plateFormEngaged() } }

  /** Create the intake on first interaction. The buyer sees nothing. */
  const ensureIntake = useCallback(async (url?: string): Promise<{ id: string; token: string } | null> => {
    const known = intakeIdRef.current ?? intakeId
    if (known && tokenRef.current) return { id: known, token: tokenRef.current }
    const res = await fetch('/api/listing-intake', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: url ?? null }),
    })
    if (!res.ok) return null
    const j = await res.json() as { intakeId: string; token: string }
    tokenRef.current    = j.token
    intakeIdRef.current = j.intakeId
    setIntakeId(j.intakeId)
    return { id: j.intakeId, token: j.token }
  }, [intakeId])

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'x-paqar-intake-token': tokenRef.current ?? '',
  })

  /** Read whatever the buyer has given us so far and show one summary. */
  const runExtraction = useCallback(async (id: string) => {
    setPhase('working'); setStatus('Sedang baca iklan…'); setError(null)
    try {
      const res = await fetch(`/api/listing-intake/${id}/extract`, {
        method: 'POST', headers: authHeaders(),
      })
      if (!res.ok) { setPhase('start'); setStatus(null); return }
      const j = await res.json() as {
        summary: MergedListing; ready: boolean; needScreenshots: boolean
        ocrUnavailable: boolean; ocrOurFault?: boolean; searchPage?: boolean
      }
      setSearchPage(j.searchPage === true)
      setSummary(j.summary)
      setNeedShots(j.needScreenshots || j.ocrUnavailable)
      setOurFault(j.ocrOurFault === true)
      // Prefill the fallback fields with whatever WAS found, so a buyer only
      // completes the gaps.
      if (j.summary.brand.value) setBrand(String(j.summary.brand.value))
      if (j.summary.model.value) setModel(String(j.summary.model.value))
      if (j.summary.year.value)  setYear(String(j.summary.year.value))
      if (j.summary.askingPriceRm.value) setPrice(String(j.summary.askingPriceRm.value))
      setPhase('summary')
      setStatus(null)
    } catch {
      setPhase('start'); setStatus(null)
    }
  }, [])

  /**
   * Store the link, then try to read it.
   *
   * Reading happens on the server, through the scraper service — the app gets
   * 403 from Mudah and its robots.txt forbids automated access, so it never
   * fetches these pages itself. Where a site cannot be read at all (Carlist
   * behind Cloudflare, Facebook behind auth) the link is still stored, a human
   * opens it during review, and the buyer is asked for screenshots instead.
   *
   * Either way the buyer hears nothing about hosts, HTTP or robots.
   */
  /**
   * Read the pasted link.
   *
   * WHY THIS IS NO LONGER BLUR-ONLY. It fired on blur and nothing else — no
   * Enter key, no button. A buyer pastes a link, presses Enter or the phone
   * keyboard's "Go", and the page sits there doing nothing; the only way to
   * start was to tap some unrelated part of the page. That is the reported
   * "when paste link nothing happens", and on a phone it is most of the time.
   *
   * `reading` guards the three entry points against each other: tapping the
   * button blurs the input first, which would otherwise start the same
   * extraction twice against one intake and race two summaries.
   */
  const reading = useRef(false)
  async function readListingUrl() {
    const url = listingUrl.trim()
    if (!url || reading.current) return
    reading.current = true
    setBusy(true)
    try {
      const created = await ensureIntake(url)
      if (!created) return
      await runExtraction(created.id)
    } finally {
      setBusy(false)
      reading.current = false
    }
  }

  async function onScreenshotUploaded(count?: number) {
    if (typeof count === 'number') setShotCount(count)
    else setShotCount(n => n + 1)
    setStatus('Sedang baca screenshot…')
    // The REF, not the state: on the first upload the child created the intake
    // and this parent has not re-rendered, so `intakeId` is still null here.
    const id = intakeIdRef.current ?? intakeId
    if (id) await runExtraction(id)
    else setStatus(null)
  }

  /**
   * BRING THE ANSWER TO THE BUYER.
   *
   * Reading a listing takes up to half a minute, and the summary it produces
   * renders BELOW the upload box that is still filling the screen. Measured on
   * a 390x844 phone the primary CTA landed at 1065px — entirely off-screen. So
   * a buyer uploaded a screenshot, waited thirty seconds, and was shown the
   * same upload box they started at, with no sign anything had happened. That
   * is indistinguishable from broken, and it is the second time this journey
   * has failed by being silent rather than by being wrong.
   *
   * Scrolled, not jumped: an abrupt jump after a long wait reads as a page
   * reload and loses the buyer's place. `block: 'center'` keeps the fallback
   * fields visible underneath when extraction only half-succeeded.
   */
  const summaryRef = useRef<HTMLDivElement | null>(null)
  const statusRef  = useRef<HTMLDivElement | null>(null)

  /**
   * Seconds since the wait started.
   *
   * A spinner looks the same at second one and second forty, so it cannot
   * prove it is still alive — the only honest evidence of liveness is a number
   * that keeps changing. It is elapsed time, never a countdown or a
   * percentage: reading a listing is a single request whose duration is not
   * known, and inventing "60%" would be a claim we cannot support.
   */
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!status) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  // Bring the wait to the buyer, exactly as the summary is brought to them.
  // The status card renders BELOW the upload box, and a buyer who has just
  // dropped a screenshot is looking at the drop zone — which is why a wait
  // sitting off-screen reads as nothing happening at all.
  useEffect(() => {
    if (!status) return
    statusRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [status])
  useEffect(() => {
    if (phase !== 'summary') return
    // Optional-called: jsdom does not implement scrollIntoView, and an
    // exception here would take the whole summary render down with it — the
    // component would fail at exactly the moment it has an answer to show.
    summaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [phase])

  /** Apply the buyer's corrections and re-merge. */
  /** Returns the re-merged summary, or null if the save failed. */
  async function saveEdits(): Promise<MergedListing | null> {
    if (!intakeId) return null
    setBusy(true)
    const patch: Record<string, unknown> = {}
    if (brand) patch.brand = brand
    if (model) patch.model = model
    if (year)  patch.year  = year
    const p = Number(price)
    if (Number.isInteger(p) && p >= 1000) patch.askingPriceRm = p

    const res = await fetch(`/api/listing-intake/${intakeId}/fields`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch),
    })
    setBusy(false)
    if (!res.ok) { setError('Tak dapat simpan. Cuba lagi.'); return null }
    const j = await res.json() as { summary: MergedListing; ready: boolean }
    setSummary(j.summary); setEditing(false); setDirty(false)
    return j.summary
  }

  /** RM0 coverage, from the merged data. */
  /**
   * Save whatever the buyer typed, then check coverage — in that order.
   *
   * saveEdits re-merges server-side and returns the updated summary, so
   * checking coverage before it lands would ask about the values extraction
   * produced rather than the ones the buyer just corrected.
   */
  async function saveThenCheck() {
    if (dirty && intakeId) {
      const saved = await saveEdits()
      if (!saved) return
      // The RETURNED summary, not the state one. setSummary has not landed by
      // the time this line runs, so reading state here would check coverage
      // against the values extraction produced and silently ignore the
      // correction the buyer just typed.
      await checkCoverage(saved)
      return
    }
    await checkCoverage()
  }

  async function checkCoverage(override?: MergedListing) {
    const summary = override ?? summaryState
    if (!summary) return
    // String(null) IS "null", four characters, which sails through the route's
    // min(1) check and comes back as "Paqar belum boleh bantu untuk BMW null
    // 2020" — the word null shown to a buyer, blamed on a market that was
    // never searched. A missing field is a reason not to ask, not a value.
    const q = {
      brand: summary.brand.value, model: summary.model.value,
      year: summary.year.value,   askingPrice: summary.askingPriceRm.value,
    }
    if (q.brand == null || q.model == null || q.year == null || q.askingPrice == null) {
      setError('Lengkapkan butiran kereta dahulu.')
      return
    }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/price-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: String(q.brand), model: String(q.model),
          year: String(q.year), askingPrice: Number(q.askingPrice),
          // Forwarded so the server can tell a recon import from a registered
          // used car — two markets at two prices, never mixed in one cohort.
          // Parsed as a string there, never fetched. Sending it keeps the rule
          // in one place instead of a copy here that could drift.
          ...(listingUrl.trim() !== '' ? { listingUrl: listingUrl.trim() } : {}),
        }),
      })
      if (!res.ok) { setError('Ralat — sila cuba semula'); return }
      setCoverage(await res.json() as Coverage)
      setPhase('coverage')
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally { setBusy(false) }
  }

  /**
   * "Tell me when you can" — stored as an ordinary model lead, marked
   * no_coverage so the nightly cron re-checks coverage instead of sending the
   * generic retarget these people must never receive.
   */
  async function requestNotify() {
    const email = notifyEmail.trim()
    if (!email || !summaryState) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/capture-model-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          brand: String(summaryState.brand.value ?? ''),
          model: String(summaryState.model.value ?? ''),
          year:  String(summaryState.year.value ?? ''),
          askingPrice: summaryState.askingPriceRm.value ?? undefined,
          verdict: 'no_coverage',
          listingCount: 0,
        }),
      })
      if (!res.ok) { setError('Ralat — sila cuba semula'); return }
      setNotifySent(true)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally { setBusy(false) }
  }

  /** Convert once, then go to checkout. */
  async function startReport() {
    if (!intakeId) return
    setBusy(true); setError(null)
    const query = new URLSearchParams(window.location.search)
    trackValuationStarted({
      entry_page_type: query.get('entry_source') === 'faq' ? 'faq' : 'home',
      traffic_context: getTrafficContext(query),
    })
    analytics.checkStarted({ country: 'MY', is_test: false })
    trackAdEvent('valuation_started', { attemptId: intakeId, valuationPath: 'plate_report' })

    try {
      const res = await fetch(`/api/listing-intake/${intakeId}/convert`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ plate: plate.trim() || undefined, buyerConcern: concern.trim() || undefined }),
      })
      // 422 is the one-listing gate, and it deserves its own words: "Ralat —
      // sila cuba semula" would send the buyer to retry a link that can never
      // work, instead of telling them what to send.
      if (res.status === 422) {
        const body = await res.json().catch(() => ({})) as { message?: string }
        setSearchPage(true)
        setError(body.message ?? 'Hantar link satu unit tertentu atau screenshot iklan itu.')
        return
      }
      if (!res.ok) { setError('Ralat — sila cuba semula'); return }
      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      const params = new URLSearchParams({ claim_token: claimToken, source: 'listing' })
      params.set('asking_price', String(summary?.askingPriceRm.value ?? ''))
      router.push(`/laporan-pembeli/${checkId}?${params.toString()}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally { setBusy(false) }
  }

  const models = MODELS_BY_BRAND[brand] ?? []
  const askPrice = summary?.askingPriceRm
  // Only the fields extraction could not settle.
  const missing = (k: keyof MergedListing) =>
    !summary || summary[k].value == null || !!summary[k].conflict

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="space-y-4">

        {/*
          SCREENSHOTS LEAD, and that is a mobile decision.

          Most Malaysian buyers are on a phone, where screenshotting an advert
          is ONE gesture while copying its link is three — share, copy, switch
          app, paste. Leading with the link optimised for the desktop minority.

          Screenshots are also the only path that works everywhere. Carlist sits
          behind Cloudflare and Facebook Marketplace requires authentication, so
          no service can read either. A picture of the screen has no such limit,
          and it is the buyer's own content rather than something taken from a
          site that declined to serve it.
        */}
        {/* ── THE INPUTS RETIRE ONCE THE CAR IS KNOWN ──────────────────────
            They stayed on screen under the answer they had produced: the
            buyer had already given us the car, and was still looking at an
            upload box and a link field. Clutter on the one screen that has to
            be simple — and an accidental second upload would restart
            extraction and overwrite a summary that was already correct.

            A buyer who wants to send something different reloads; a buyer who
            wants to correct a value has "Maklumat salah? Ubah" on the summary
            itself, which is the cheaper of the two paths and the one they
            actually want. */}
        {(phase === 'start' || phase === 'working') && (
        <>
        {/* ── ONE ACTION, NOT TWO ────────────────────────────────────────
            A tester opening the page said: "it's full of text… all the
            options need to be separated… I have to read each of them to
            figure out what they do."

            He was describing this form. It offered screenshot and link side
            by side, each with its own heading and its own explanatory
            paragraph, so before doing anything a buyer read four blocks of
            text and then had to CHOOSE. That is a decision nobody arrives
            wanting to make, and StoryBrand's first rule is one obvious next
            step — a second equal option costs conversions rather than adding
            flexibility.

            The link leads because it is one paste and because it is what
            actually gets used: every real listing put through the live site
            so far arrived as a link. The placeholder carries what the deleted
            paragraph said — Mudah, Carlist, Facebook Marketplace — without
            asking anyone to read a sentence to learn it.

            Screenshots stay one tap away for the buyer who has no usable
            link, and every word about formats, pasting and retention now
            lives inside that panel, where it is read by someone who has
            already decided to upload. */}
        <div>
          <label htmlFor="li-url" className={LABEL_CLS}>
            Link iklan kereta itu
          </label>
          <input
            id="li-url"
            ref={urlRef}
            type="url"
            value={listingUrl}
            onChange={e => { setListingUrl(e.target.value); markEngaged() }}
            onBlur={readListingUrl}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void readListingUrl() }
            }}
            placeholder="Mudah, Carlist, Facebook Marketplace…"
            inputMode="url"
            autoComplete="off"
            // Disabled while reading: re-pasting mid-extraction starts a second
            // run against the same intake and confuses the summary.
            disabled={phase === 'working'}
            className={`${INPUT_CLS} disabled:opacity-60`}
          />
          {/* ALWAYS VISIBLE, not revealed on typing.
              Blur and Enter both work, but neither is something a buyer can
              SEE, and a field that appears to do nothing is indistinguishable
              from a broken one. It used to appear only once there was text, to
              keep the resting state quiet — and a screenshot of the rendered
              hero showed what that actually cost: the page whose entire job is
              one action had no coloured control anywhere above the fold.

              Disabled while empty rather than hidden. A control a buyer can see
              from the start tells them what the page wants; one that
              materialises later asks them to discover it. */}
          <button
            type="button"
            ref={submitRef}
            onClick={() => {
              // EMPTY IS NOT A REASON TO DO NOTHING.
              // Disabled, this rendered as a large dead slab in the middle of
              // the card — the most prominent thing on the page, and inert.
              // A first-time reader cannot tell that apart from broken. Live,
              // it always does something: with no link it puts the cursor
              // where the link goes and says so.
              if (listingUrl.trim() === '') {
                setError('Tampal link iklan kereta itu dahulu, atau muat naik screenshot.')
                urlRef.current?.focus()
                return
              }
              void readListingUrl()
            }}
            disabled={phase === 'working' || busy}
            className="w-full min-h-[48px] mt-2.5 bg-[#3D472F] hover:bg-[#2E3523] text-white font-heading font-extrabold text-[15px] rounded-[12px] transition-colors disabled:opacity-60"
          >
            {phase === 'working' || busy ? 'Sedang baca iklan…' : 'Semak kereta ini →'}
          </button>
        </div>

        {/* The screenshot path, one tap away. A real link is not always
            obtainable — Facebook Marketplace in particular — so this must stay
            reachable, but it must not compete with the primary action for a
            first-time reader's attention. */}
        {!showUpload ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="w-full min-h-[44px] font-body text-[13px] text-[#3D472F] underline underline-offset-2 hover:text-[#2E3523]"
          >
            Tiada link? Muat naik screenshot iklan
          </button>
        ) : (
          <div>
            <label htmlFor="li-shots" className={LABEL_CLS}>
              Screenshot iklan
            </label>
            <p className="font-body text-[12px] text-[#6B7280] mb-2 leading-relaxed">
              Boleh hantar beberapa kalau harga, model dan mileage berada di
              skrin berlainan.
            </p>
            {/* Created lazily, on first file selection: minting a row on mount
                would create one for every visitor who scrolls past the form. */}
            <ScreenshotUpload
              intakeId={intakeId}
              token={tokenRef.current}
              ensureIntake={ensureIntake}
              onUploaded={() => void onScreenshotUploaded()}
            />
          </div>
        )}
        </>
        )}

        {/*
          THE WAIT NEEDS TO LOOK LIKE A WAIT.

          This was a single 13px grey line, and a buyer in a browser could not
          tell anything was happening — so they paste again, or leave. Reading a
          listing takes real time: a URL fetch plus an OCR call, and up to a
          minute on a cold serverless function.

          So it occupies the same footprint as the summary card that replaces
          it, which also stops the layout jumping when the answer lands. And it
          states the worst case honestly rather than implying it is nearly done
          — a buyer told "up to a minute" waits; a buyer shown a silent spinner
          for forty seconds assumes it is broken.
        */}
        {status && (
          <div
            ref={statusRef}
            role="status"
            aria-live="polite"
            className="bg-white border-2 border-[#3D472F] rounded-[14px] p-4 shadow-[0_2px_12px_rgba(6,78,74,0.12)]"
          >
            {/* The bar first, and full width. It is the part visible from the
                corner of the eye — a buyer still looking at the drop zone sees
                movement travelling across the card before they read a word. */}
            <div
              aria-hidden="true"
              className="paqar-indeterminate relative h-1.5 w-full rounded-full bg-[#E5F2F0] overflow-hidden mb-3"
            />
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="w-6 h-6 mt-0.5 rounded-full border-[3px] border-[#BBF7D0] border-t-[#3D472F] animate-spin flex-shrink-0 motion-reduce:animate-none"
              />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-extrabold text-[16px] text-[#3D472F] leading-snug">
                  {status}
                </p>
                <p className="font-body text-[13px] text-[#6B7280] leading-relaxed mt-0.5">
                  Ambil masa sehingga seminit. Jangan tutup halaman ini.
                </p>
              </div>
              {/* Proof of life. A number that keeps moving is the one thing a
                  spinner cannot be: unambiguously not frozen. */}
              <span className="font-heading font-bold text-[13px] text-[#3D472F] tabular-nums flex-shrink-0 mt-1">
                {elapsed}s
              </span>
            </div>
          </div>
        )}

        {/* ONE SUMMARY. Everything found, editable, no confirmation step. */}
        {phase === 'summary' && summary && !editing && (
          <div ref={summaryRef} className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#15803D] mb-1.5">
              Paqar akan semak
            </p>
            <p className="font-heading font-extrabold text-[16px] text-[#111827] leading-snug">
              {[summary.brand.value, summary.model.value, summary.year.value].filter(Boolean).join(' · ') || 'Isi butiran kereta di bawah'}
            </p>
            {askPrice?.value != null && (
              <p className="font-heading font-extrabold text-[18px] text-[#3D472F] mt-1">
                Seller minta RM{Number(askPrice.value).toLocaleString()}
              </p>
            )}
            {summary.mileageKm.value != null && (
              <p className="font-body text-[12px] text-[#6B7280] mt-1">
                {Number(summary.mileageKm.value).toLocaleString()} km &mdash; seperti yang penjual iklankan
              </p>
            )}
            {askPrice?.conflict && (
              <p className="font-body text-[13px] text-[#B45309] mt-2 leading-relaxed">
                Kami jumpa lebih daripada satu harga. Sila sahkan harga sebenar.
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-body text-[13px] text-[#3D472F] underline underline-offset-2 mt-2 min-h-[44px]"
            >
              Maklumat salah? Ubah
            </button>
          </div>
        )}

        {needShots && phase === 'summary' && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px] p-4">
            {/* NAME WHAT ACTUALLY FAILED. This said "screenshot" whatever the
                buyer had given us, so someone who pasted a link was told their
                screenshot could not be read — at the exact moment they most
                need to understand what went wrong. */}
            {/* OUR FAULT, OR THE SCREENSHOT'S?
                Every failure said "kami tak dapat baca screenshot itu", which
                blames the buyer's photo for what is usually our outage — a
                missing API key, a timeout, a rate limit. Someone whose
                screenshot was perfectly readable was sent off to take another
                one. */}
            <p className="font-heading font-bold text-[14px] text-[#B45309] mb-1">
              {ourFault
                ? 'Ada masalah teknikal di pihak kami'
                : shotCount === 0
                  ? 'Kami tak dapat baca link itu'
                  : listingUrl.trim() !== ''
                    ? 'Kami tak dapat baca iklan itu'
                    : 'Kami tak dapat baca screenshot itu'}
            </p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">
              {ourFault
                ? 'Screenshot anda tak ada masalah — sistem bacaan kami yang gagal. Apa yang anda hantar tetap disimpan dan akan dibaca oleh manusia semasa menyemak.'
                : shotCount === 0
                  ? 'Link anda tetap disimpan dan akan dibuka oleh manusia semasa menyemak.'
                  : 'Apa yang anda hantar tetap disimpan dan akan dibaca oleh manusia semasa menyemak.'}
              {' '}Isi butiran kereta di bawah supaya kami boleh semak liputan dahulu.
            </p>
          </div>
        )}

        {/* FALLBACK: only the fields extraction could not settle. */}
        {(editing || (phase === 'summary' && (missing('brand') || missing('model') || missing('year') || missing('askingPriceRm')))) && (
          <div className="space-y-3">
            {/* EACH FIELD ON ITS OWN. Brand and year were rendered whenever
                the MODEL was missing, so a buyer whose advert gave up only its
                model was shown three inputs, two of them already correct, and
                asked to confirm work Paqar had already done. */}
            {(editing || missing('brand') || missing('year')) && (
              <div className="grid grid-cols-2 gap-3">
                {(editing || missing('brand')) && (
                <div>
                  <label htmlFor="li-brand" className={LABEL_CLS}>Jenama</label>
                  <select id="li-brand" value={brand} onChange={e => { setBrand(e.target.value); setModel(''); setDirty(true) }} className={INPUT_CLS}>
                    <option value="">Pilih…</option>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                )}
                {(editing || missing('year')) && (
                <div>
                  <label htmlFor="li-year" className={LABEL_CLS}>Tahun</label>
                  <select id="li-year" value={year} onChange={e => { setYear(e.target.value); setDirty(true) }} className={INPUT_CLS}>
                    <option value="">Pilih…</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                )}
              </div>
            )}
            {(editing || missing('model')) && (
              <div>
                <label htmlFor="li-model" className={LABEL_CLS}>Model</label>
                <input id="li-model" list="li-models" value={model} onChange={e => { setModel(e.target.value); setDirty(true) }}
                       placeholder={brand ? 'cth: City' : 'Pilih jenama dahulu'} className={INPUT_CLS} />
                <datalist id="li-models">{models.map(m => <option key={m} value={m} />)}</datalist>
              </div>
            )}
            {(editing || missing('askingPriceRm')) && (
              <div>
                <label htmlFor="li-price" className={LABEL_CLS}>Harga yang penjual minta (RM)</label>
                <input id="li-price" type="number" value={price} onChange={e => { setPrice(e.target.value); setDirty(true) }}
                       placeholder="cth: 59000" min={1000} max={2000000} inputMode="numeric" className={INPUT_CLS} />
              </div>
            )}
          </div>
        )}

        {searchPage && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px] p-4">
            <p className="font-heading font-bold text-[13px] text-[#92400E] mb-1">
              Ini halaman carian, bukan satu iklan kereta.
            </p>
            <p className="font-body text-[13px] text-[#78350F] leading-relaxed">
              Hantar link satu unit tertentu, atau screenshot iklan itu.
            </p>
          </div>
        )}

        {error && <p role="alert" className="font-body text-[13px] text-[#DC2626]">{error}</p>}

        {/* ONE BUTTON, ONE INTENT.
            There were two: "Simpan butiran" to save the fields, then "Semak
            kereta ini" to go on — two taps for a buyer who wants one thing,
            and a save step that does nothing they asked for. The primary
            action now saves anything typed and continues; a buyer who filled
            nothing in skips the save entirely. */}
        {phase === 'summary' && summary && (
          <button type="button" onClick={() => void saveThenCheck()} disabled={busy}
                  className="w-full min-h-[44px] bg-[#3D472F] hover:bg-[#2E3523] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60">
            {busy ? 'Menyemak…' : 'Semak kereta ini →'}
          </button>
        )}

        {/* COVERAGE — capability only. No verdict, no median, no range. */}
        {phase === 'coverage' && coverage && (
          coverage.eligible ? (
            <div className="space-y-4">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] p-4">
                <p className="font-heading font-bold text-[14px] text-[#15803D] mb-1">
                  ✓ Paqar boleh semak {coverage.modelLabel}
                </p>
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Kami jumpa cukup iklan setanding untuk buat keputusan tentang unit ini.
                </p>
              </div>

              <div>
                {/* MOTIVATE THE PLATE, do not merely permit it.
                    It read "Nombor Plat (pilihan)" over "kami semak maklumat
                    pendaftaran seller selepas bayaran" — a feature stated in
                    Paqar's words, with the benefit buried behind a mention of
                    payment. The registration record is one of the few things
                    here that no chat assistant can produce, and a buyer only
                    supplies a plate if they are told what it buys THEM: the
                    means to check the seller's claims against a record instead
                    of taking their word. Still optional, and still honest that
                    the check happens after payment. */}
                <label htmlFor="li-plate" className={LABEL_CLS}>
                  Nombor plat <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
                </label>
                <input id="li-plate" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())}
                       maxLength={10} placeholder="WWW 1234" className={`${INPUT_CLS} uppercase tracking-[.12em]`} />
                <p className="font-body text-[12px] text-[#374151] mt-1.5 leading-relaxed">
                  Ada plat? Kami sahkan tahun, enjin dan varian kereta ini dengan
                  <strong> rekod rasmi</strong> &mdash; bukan dengan apa yang seller tulis
                  dalam iklan.
                </p>
              </div>

              <div>
                <label htmlFor="li-concern" className={LABEL_CLS}>
                  Apa yang buat anda ragu? <span className="font-normal text-[#9CA3AF]">(pilihan)</span>
                </label>
                <textarea id="li-concern" value={concern} onChange={e => setConcern(e.target.value)} rows={3}
                          placeholder="cth: seller kata takde accident tapi bumper nampak lain warna"
                          className={`${INPUT_CLS} resize-none`} />
              </div>

              {/* Price sits directly above the button. Pressing it IS the
                  confirmation — no extra tap. */}
              {askPrice?.value != null && (
                <p className="font-heading font-bold text-[14px] text-[#111827]">
                  Seller minta RM{Number(askPrice.value).toLocaleString()}
                </p>
              )}
              <button type="button" onClick={() => void startReport()} disabled={busy}
                      className="w-full min-h-[44px] bg-[#3D472F] hover:bg-[#2E3523] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors disabled:opacity-60">
                {busy ? 'Memproses…' : `Dapatkan keputusan — ${BASE_REPORT_LABEL} →`}
              </button>
              <p className="font-body text-[11px] text-[#9CA3AF] text-center leading-relaxed">
                Disemak oleh manusia · Biasanya {TYPICAL_MINUTES} minit ·
                Duit dikembalikan jika kami tidak dapat siapkan
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
              <p className="font-heading font-bold text-[14px] text-[#111827] mb-1">
                Paqar belum boleh bantu untuk {coverage.modelLabel}.
              </p>
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                Kami belum jumpa cukup iklan setanding untuk model dan tahun ini,
                jadi kami tidak jual keputusan yang tidak dapat kami sokong.
              </p>

              {/* A REFUSAL WAS A DEAD END.
                  The buyer got this box and nothing else — no next step, no way
                  back. Measured on the cache, roughly one model-year in eight
                  lands here, and they are the buyers who were ready to pay.

                  What is offered is only what Paqar can actually keep: the
                  comparables cache refreshes daily, the nightly cron re-runs
                  THIS SAME coverage check for anyone waiting, and the email
                  goes out when the answer changes. If it never changes, nothing
                  is ever sent — silence is what "we will tell you when we can"
                  promises, and a "still nothing" email would break it. */}
              {notifySent ? (
                <p className="font-body text-[13px] text-[#15803D] leading-relaxed mt-3 pt-3 border-t border-[#F3F4F6]">
                  ✓ Kami e-mel anda sebaik kami boleh semak {coverage.modelLabel}.
                </p>
              ) : (
                <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                  <label htmlFor="li-notify" className={LABEL_CLS}>
                    Nak kami beritahu bila boleh?
                  </label>
                  <div className="flex gap-2">
                    <input id="li-notify" type="email" value={notifyEmail} inputMode="email"
                           autoComplete="email" placeholder="e-mel anda"
                           onChange={e => setNotifyEmail(e.target.value)}
                           className={`${INPUT_CLS} flex-1`} />
                    <button type="button" onClick={() => void requestNotify()}
                            disabled={busy || notifyEmail.trim() === ''}
                            className="min-h-[44px] px-4 bg-[#3D472F] hover:bg-[#2E3523] text-white font-heading font-bold text-[13px] rounded-xl transition-colors disabled:opacity-50">
                      Hantar
                    </button>
                  </div>
                  <p className="font-body text-[11px] text-[#6B7280] mt-2 leading-relaxed">
                    Satu e-mel sahaja, bila kami dah boleh semak model ini. Tiada bayaran.
                  </p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
