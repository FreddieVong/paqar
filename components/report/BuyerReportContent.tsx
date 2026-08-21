import type { CachedMarketPrices } from '@/lib/db/market-prices'
import type { JomCheckResult, JomCheckStatus } from '@/lib/jomcheck'
import { buildComparableCohort, evaluateVerdictEligibility, comparableConfidence } from '@/lib/comparables'
import { odometerEvidence, MILEAGE_PROVENANCE_LABEL, type MileageSource } from '@/lib/mileage-provenance'
import { registrationState, REGISTRATION_COPY } from '@/lib/registration-claim'
import { isIndividualListingUrl } from '@/lib/listing-url'
import { InspectionCTA }   from './InspectionCTA'
import { InsuranceCTA }    from './InsuranceCTA'
import { CopyButton }      from './CopyButton'
import { JomCheckSection } from './JomCheckSection'
import { JomCheckUpsell }  from './JomCheckUpsell'
import { HistoryRiskBanner } from './HistoryRiskBanner'
import { ReloadButton }     from './ReloadButton'
import { VariantCheckCard } from './VariantCheckCard'
import { findGuideByMakeModel, findVariantPosition, VERDICT_LABELS } from '@/lib/variant-guides'
import { assessDepreciation } from '@/lib/depreciation'

const fmt        = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const floorClean = (n: number) => { const u = n >= 50_000 ? 5_000 : 1_000; return Math.floor(n / u) * u }
const roundClean = (n: number) => { const u = n >= 50_000 ? 5_000 : 1_000; return Math.round(n / u) * u }

// Keyed by the shared ComparableConfidence type — the band thresholds now live
// once, in lib/comparables.ts, alongside the cohort they describe.
const CONFIDENCE_CONFIG = {
  high:   { label: 'Keyakinan data: Tinggi',    labelCls: 'text-[#15803D]', dot: 'bg-[#22C55E]', text: 'Cukup stabil untuk dijadikan panduan.' },
  medium: { label: 'Keyakinan data: Sederhana', labelCls: 'text-[#B45309]', dot: 'bg-[#F59E0B]', text: 'Guna sebagai panduan awal sahaja.' },
  low:    { label: 'Data pasaran terhad',       labelCls: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]', text: 'Data terhad. Guna sebagai anggaran kasar sahaja.' },
} as const

function translateCoverType(ct: string): string {
  const lower = ct?.toLowerCase() ?? ''
  if (lower.includes('comprehensive')) return 'Komprehensif'
  if (lower.includes('third party'))   return 'Pihak Ketiga'
  if (lower.includes('fire'))          return 'Kebakaran & Kecurian'
  return ct
}

interface VehicleData {
  description?:      string
  registrationYear?: string
  make?:             string
  model?:            string
  body?:             string
  engineCc?:         string
  vin?:              string
  nvic?:             string
  insurance?: {
    insurer:      string
    coverType:    string
    policyStatus: string
  } | null
  valuation?: {
    wmNewPrice: number
    sumInsured: number | null
    family?:    string
    variant?:   string
    familyFloorNewPrice?: number | null
  } | null
}

const MALAY_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']

function formatMalayDate(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

interface Props {
  plate:             string
  askingPriceRm?:    number | null
  vehicleData?:      Record<string, unknown> | null
  marketPrices?:     CachedMarketPrices | null
  addJomCheck?:      boolean
  jomcheckData?:     JomCheckResult | null
  jomcheckStatus?:   JomCheckStatus
  jomcheckManualPending?: boolean
  generatedAt?:      string | null
  upsellJomCheck?:   { checkId: string; claimToken: string } | null
  claimedMileageKm?: number | null
  /**
   * Where claimedMileageKm came from. Defaults to 'buyer_claimed', which is
   * what it has always actually been — a number typed into an optional
   * checkout field. Only a reviewer-confirmed reading may drive the
   * odometer-rollback finding; see lib/mileage-provenance.
   */
  mileageSource?:    MileageSource
  /** Reviewer suppression of an unsupported rollback finding. */
  rollbackSuppressed?: boolean
  /**
   * Whether the buyer supplied a plate at intake. Distinct from having
   * provider data: no plate means no lookup was ever attempted, and saying
   * "not found" to that buyer would be untrue.
   */
  plateSupplied?:      boolean
  /**
   * What the reviewer decided, when they disagreed with the draft.
   *
   * THESE ARE THE PRODUCT. A reviewer typed them into "Keputusan akhir" and
   * "Langkah seterusnya", the release stored them in reviewed_overrides — and
   * nothing read them, so the buyer got the machine's verdict under a note
   * saying a human had decided. That produced reports where the human wrote
   * "RM52,000 tinggi sikit, mula tawar RM47,500" while the card above it said
   * "WAJAR — teruskan": two opposite decisions on one screen, in the product
   * whose entire premise is that a person checked it.
   */
  reviewerDecision?:   string | null
  reviewerNextAction?: string | null
  /** Questions the reviewer wrote for THIS advert. Shown above the generic set. */
  reviewerSellerQuestions?: string | null
  /**
   * The car this report is about, resolved by lib/report-identity — the check
   * row, refined by the registered record, corrected by the reviewer.
   *
   * Passed in rather than derived here because the same resolution has to feed
   * the reviewer's queue: a reviewer approving a decision computed from one
   * cohort while the buyer reads another is a failure neither of them can see.
   */
  cohortYear?:    string | null
  cohortModel?:   string | null
  cohortVariant?: string | null
}

export function BuyerReportContent({ plate, askingPriceRm, vehicleData: rawVehicleData, marketPrices, addJomCheck, jomcheckData, jomcheckStatus, jomcheckManualPending, generatedAt, upsellJomCheck, claimedMileageKm, mileageSource = 'buyer_claimed', rollbackSuppressed = false, plateSupplied = true, reviewerDecision = null, reviewerNextAction = null, reviewerSellerQuestions = null, cohortYear = null, cohortModel = null, cohortVariant = null }: Props) {
  // The reading that may support a TAMPERING claim — null unless a human
  // confirmed it. Distinct from claimedMileageKm, which is still displayed as
  // context. Conflating the two is what published a false rollback warning
  // about a real seller from a buyer's typo.
  const odometerForRollback = rollbackSuppressed
    ? null
    : odometerEvidence(claimedMileageKm != null ? { km: claimedMileageKm, source: mileageSource } : null)
  const vehicleData = rawVehicleData as VehicleData | null | undefined
  const ins         = vehicleData?.insurance

  // Registration promises are conditional on a plate having been supplied.
  // plate is the carLabel on plate-less checks, so presence of provider data
  // is what distinguishes "not asked" from "asked and found nothing".
  const regState = registrationState({
    plateSupplied:   plateSupplied,
    hasProviderData: !!vehicleData?.make,
  })


  // ── Variant identity (must precede the cohort — it drives variant matching) ──
  const wmNewPrice = vehicleData?.valuation?.wmNewPrice ?? null
  const regYear    = vehicleData?.registrationYear ? parseInt(vehicleData.registrationYear) : null
  // Special/top variant: record's new price far above the family's cheapest
  // variant that year (JCW GP = 1.78× a Clubman). Model-level listings are then
  // NOT valid comparables. (JSON round-trip stores prices as strings — coerce.)
  const familyFloor      = vehicleData?.valuation?.familyFloorNewPrice != null
    ? Number(vehicleData.valuation.familyFloorNewPrice) : null
  const isSpecialVariant = wmNewPrice != null && familyFloor != null && familyFloor > 0
    && Number(wmNewPrice) >= familyFloor * 1.3

  // Official variant (from NVIC valuation) — shared by the cohort, the compact
  // context line in Perbandingan Harga and the Semakan Varian card. Skip the
  // family prefix when the variant already carries it ("COOPER" + "JOHN COOPER
  // WORKS GP" must not render "Cooper John Cooper…").
  const valFamily  = vehicleData?.valuation?.family
  const valVarName = vehicleData?.valuation?.variant
  const rawVariant = valFamily && valVarName
    ? (new RegExp(`\\b${valFamily.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(valVarName)
        ? valVarName
        : `${valFamily} ${valVarName}`.trim())
    : (valFamily ?? null)
  // Title-case ALL-CAPS words, but keep grade tokens ("GP", "AV", "EZ")
  // uppercase and leave words that already carry lowercase ("EZi") alone
  const officialVariant = rawVariant
    ? rawVariant.split(' ').map(w =>
        (/[a-z]/.test(w) || w.length <= 2) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ')
    : null

  // ── Market comparison — ONE cohort; median, range, chips, count, confidence,
  // banner and methodology all derive from it, so math and copy can never
  // describe different listing sets (lib/comparables.ts).
  //
  // YEAR AND MODEL COME FROM THE RESOLVED IDENTITY, not from the plate lookup.
  //
  // They were `vehicleData?.registrationYear` and `vehicleData?.model`, which
  // are null for a plateless check — and since migration 032 that is the
  // default journey. A null year means buildComparableCohort applies NO year
  // filter, so the buyer's 2019 Honda City was priced against City listings of
  // every year: it pulled in a RM56,980 car, raised the top of the range above
  // the asking price, and turned an overpriced listing into "WAJAR".
  //
  // It was caught by putting the same numbers on the reviewer's card and
  // watching the two surfaces disagree — 13 comparables and a RM49,900 ceiling
  // in the queue against a RM56,980 ceiling in the report, for one car.
  const cohort           = buildComparableCohort(marketPrices?.listings ?? [], {
    year:             cohortYear   ?? vehicleData?.registrationYear ?? null,
    officialVariant:  officialVariant ?? cohortVariant ?? null,
    model:            cohortModel  ?? vehicleData?.model ?? null,
    isSpecialVariant,
  })
  const relevantListings = cohort.listings
  const mPrices          = cohort.prices
  const marketMin        = cohort.min
  const marketMax        = cohort.max
  // The cohort's real median, whatever the sample size. Do NOT null this to
  // express "not enough data" — that is what formatted as RM0 in the buyer's
  // negotiation script. Sample-size policy lives in evaluateVerdictEligibility.
  const marketMedian     = cohort.median

  // The one rule deciding whether a verdict may be published at all.
  const eligibility   = evaluateVerdictEligibility(cohort, askingPriceRm)
  const isProvisional = eligibility.evidenceLevel === 'provisional'
  // A variant mismatch now suppresses the verdict outright, so the VARIAN KHAS
  // card can no longer key off verdictSource === 'market' alone — there is no
  // market verdict any more. Without this the suppression would silently fall
  // through to a depreciation verdict and lose the explanation.
  // (buildComparableCohort only ever returns mixed_variants for a special
  // variant, so this implies isSpecialVariant.)
  const variantSuppressed = eligibility.suppressionReason === 'mixed_variants'
  // Every median-dependent figure hangs off this, so a null median can never
  // reach currency formatting.
  const hasMarketData = eligibility.eligible
    && marketMedian != null && marketMin != null && marketMax != null
  const priceVerdict  = !hasMarketData ? null
    : askingPriceRm! < marketMin! ? 'good_deal'    as const
    : askingPriceRm! <= marketMax! ? 'fair_price'  as const
    : askingPriceRm! <= marketMax! * 1.08 ? 'slightly_high' as const
    : 'overpriced' as const

  // Offer target anchored to median (not max) — median is the right negotiation anchor
  const offerAnchor = marketMedian ?? marketMax
  const offerHigh   = offerAnchor != null ? floorClean(offerAnchor) : 0
  const offerLow    = priceVerdict === 'overpriced'
    ? roundClean(offerHigh * 0.90)
    : roundClean(offerHigh * 0.93)

  // Depreciation-based verdict — fallback when no Mudah listings available.
  // Rates are tiered by brand segment; floored at 20% of new price.
  const hasDepreciation  = !hasMarketData && askingPriceRm != null && wmNewPrice != null && regYear != null

  const depreciationRate = (() => {
    const make = (vehicleData?.make ?? '').toLowerCase()
    if (['perodua', 'proton'].includes(make))                                           return 0.90
    if (['toyota', 'honda', 'mazda', 'nissan', 'mitsubishi', 'suzuki', 'subaru', 'kia', 'hyundai'].includes(make)) return 0.87
    if (['bmw', 'mercedes-benz', 'audi', 'volvo', 'lexus', 'porsche', 'jaguar', 'land rover'].includes(make))      return 0.78
    return 0.84
  })()

  const depreciationExpected = (hasDepreciation && regYear != null && wmNewPrice != null)
    ? wmNewPrice * Math.max(0.20, Math.pow(depreciationRate, new Date().getFullYear() - regYear))
    : null

  // Depreciation is SUPPORTING CONTEXT, never a verdict.
  //
  // It used to produce its own MAHAL/WAJAR/BERBALOI badge, which meant a
  // one-listing cohort still showed "MAHAL" in 22px red. The distinction
  // between "market says MAHAL" and "a depreciation curve says MAHAL" is
  // invisible to a buyer — they read the badge, not the footnote. So a cohort
  // Paqar refuses to judge now renders no badge at all.
  const insufficientData = eligibility.suppressionReason === 'insufficient_data'
  const showDepreciationEstimate = insufficientData && depreciationExpected != null

  const effectiveVerdict = priceVerdict
  const verdictSource    = priceVerdict ? 'market' : null

  // New-price context — only shown WITH an interpretation (lib/depreciation.ts);
  // a bare new-price anchor next to market data is the dealer's pitch.
  // Suppressed for special variants: the median is other variants' prices.
  // Requires an eligible cohort: this interprets the new price AGAINST the
  // market median, so on a one-ad cohort it would read a single advertisement
  // as the market.
  const depreciationInsight = (!isSpecialVariant && hasMarketData && wmNewPrice != null && marketMedian != null && regYear != null)
    ? assessDepreciation(Number(wmNewPrice), marketMedian, new Date().getFullYear() - regYear)
    : null
  // "NOT FOUND" REQUIRES HAVING LOOKED.
  //
  // This was `!vehicleData?.make`, which is true for every plateless check —
  // and since migration 032 the plate is optional and plateless is the default
  // journey. A buyer who never gave a plate opened the report they had just
  // paid RM29 for and read "Kami tidak dapat mengesahkan maklumat kenderaan
  // untuk plat Honda City 2018": a failure blamed on a plate they never
  // supplied, with the car's NAME rendered where a registration number should
  // be, directly under the human note they paid for.
  //
  // The registration section a few blocks down already said the right thing
  // ("tidak disemak kerana nombor plat tidak diberikan"), so the report
  // contradicted itself on the same screen.
  const vehicleNotFound  = plateSupplied && !vehicleData?.make

  // Short identity (make + model) — the full official variant string lives in
  // the JPJ card; repeating the all-caps wall here would duplicate it
  const carIdentity = vehicleData?.make
    ? [
        `${vehicleData.make} ${vehicleData.model ?? ''}`.trim(),
        vehicleData.registrationYear ? `Didaftar ${vehicleData.registrationYear}` : null,
      ].filter(Boolean).join(' · ')
    : null
  const generatedLabel = generatedAt ? formatMalayDate(generatedAt) : ''

  return (
    <div className="space-y-5">

      {/* 0. Report header — the buyer's car, front and centre */}
      <div className="bg-[#14453d] rounded-[14px] p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="font-heading font-bold text-[10px] uppercase tracking-[.12em] text-white/45">
            Laporan Pembeli
          </p>
          {generatedLabel && (
            <p className="font-body text-[10px] text-white/40">Dijana: {generatedLabel}</p>
          )}
        </div>
        <p className="font-heading font-extrabold text-[30px] text-white leading-none tracking-tight mb-1.5">
          {plate}
        </p>
        {carIdentity && (
          <p className="font-body text-[13px] text-white/70">{carIdentity}</p>
        )}
      </div>

      {/* History risk — a SEVERE / total-loss / rollback finding must lead the
          5-second scan, ABOVE the price verdict. Only when JomCheck was bought
          and succeeded; renders nothing for a clean or minor history. */}
      {addJomCheck && jomcheckStatus === 'success' && jomcheckData && (
        <HistoryRiskBanner data={jomcheckData} currentOdometerKm={odometerForRollback} />
      )}

      {/* Vehicle not found — shown when RegCheck returns null for this plate */}
      {vehicleNotFound && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[14px] text-[#B45309] mb-2">
            Maklumat kenderaan tidak dijumpai
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed">
            Kami tidak dapat mengesahkan maklumat kenderaan untuk plat <strong>{plate}</strong>.
            Ini mungkin kerana plat tidak wujud, baru didaftarkan, atau belum dalam sistem kami.
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed mt-2">
            Soalan penjual di bawah masih berguna — gunakan ia untuk tanya penjual anda.
          </p>
          <ReloadButton className="font-body text-[13px] text-[#B45309] font-semibold underline underline-offset-2 mt-3 inline-block">
            Cuba muat semula →
          </ReloadButton>
        </div>
      )}

      {/* 1. Keputusan Paqar — top decision card */}
      {/* Insufficient comparables: a neutral estimate, not a judgement. No
          MAHAL/WAJAR/BERBALOI badge appears anywhere in this state. */}
      {showDepreciationEstimate && !variantSuppressed && (
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
            Anggaran berdasarkan susut nilai
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-4">
            Belum cukup iklan setanding untuk beri keputusan harga pasaran. Anggaran ini
            berdasarkan harga baharu dan umur kenderaan sahaja — bukan harga pasaran semasa.
          </p>
          <div className="space-y-2.5">
            {askingPriceRm != null && (
              <div className="flex items-center justify-between">
                <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
                <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="font-body text-[12px] text-[#6B7280]">Anggaran susut nilai</p>
              <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(roundClean(depreciationExpected!))}</p>
            </div>
            <div className="pt-2 border-t border-black/10">
              <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Cadangan</p>
              <p className="font-heading font-bold text-[13px] text-[#111827]">
                Guna angka ini sebagai rujukan kasar sahaja. Semak beberapa iklan model yang
                sama sendiri sebelum bayar deposit.
              </p>
            </div>
            <p className="font-body text-[11px] text-[#9CA3AF] leading-relaxed">
              {mPrices.length === 0
                ? 'Tiada iklan setanding dijumpai buat masa ini.'
                : `Hanya ${mPrices.length} iklan setanding dijumpai — terlalu sedikit untuk harga pasaran.`}
            </p>
          </div>
        </div>
      )}

      {(effectiveVerdict != null || variantSuppressed) && (() => {
        // Special variant + market-based verdict: the comps are other
        // variants' prices, so a confident MAHAL/BERBALOI would be a lie
        // (a JCW GP at RM150k is not "RM29k over" base-Cooper listings).
        // Say what we know, say what we can't, tell the buyer what to do.
        if (isSpecialVariant && (verdictSource === 'market' || variantSuppressed)) {
          return (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
                Keputusan Paqar
              </p>
              <p className="font-heading font-extrabold text-[22px] leading-tight mb-1 text-[#B45309]">
                VARIAN KHAS
              </p>
              <p className="font-heading font-bold text-[15px] text-[#111827] mb-4">
                Harga pasaran biasa tak boleh dipakai untuk varian ni.
              </p>
              <div className="space-y-2.5">
                {askingPriceRm != null && (
                  <div className="flex items-center justify-between">
                    <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
                    <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
                  </div>
                )}
                {wmNewPrice != null && (
                  <div className="flex items-center justify-between">
                    <p className="font-body text-[12px] text-[#6B7280]">Harga ketika baru (anggaran)</p>
                    <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(Number(wmNewPrice))}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-black/10">
                  <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Cadangan</p>
                  <p className="font-heading font-bold text-[13px] text-[#111827]">
                    Ini {officialVariant} — varian yang jauh lebih mahal dari{' '}
                    {vehicleData?.model ?? 'model'} biasa ketika baru. Banding hanya dengan iklan
                    varian sama, sahkan varian dalam geran, dan buat inspection sebelum bayar deposit.
                  </p>
                </div>
                <p className="font-body text-[11px] text-[#6B7280] leading-relaxed">
                  Harga yang nampak terlalu murah untuk varian macam ni pun perlu disemak — selalunya ada sebab.
                </p>
              </div>
            </div>
          )
        }

        // Reachable only with a verdict: a suppressed special variant already
        // returned the VARIAN KHAS card above.
        if (!effectiveVerdict) return null

        // THE HUMAN'S DECISION REPLACES THE MACHINE'S — it does not sit beside
        // it. Two decisions on one screen is worse than either alone, and the
        // buyer has no way to know which one a person stood behind. The
        // supporting figures stay: they are what the decision was made from,
        // and withholding them would leave a bare assertion where the buyer
        // paid for reasoning.
        if (reviewerDecision) {
          return (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
                Keputusan Paqar
              </p>
              <p className="font-heading font-extrabold text-[19px] leading-tight text-[#064E4A] mb-1 whitespace-pre-line">
                {reviewerDecision}
              </p>
              <p className="font-body text-[12px] text-[#15803D] mb-4">
                Keputusan orang yang semak iklan anda.
              </p>
              <div className="space-y-2.5">
                {askingPriceRm != null && (
                  <div className="flex items-center justify-between">
                    <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
                    <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
                  </div>
                )}
                {hasMarketData && (
                  <div className="flex items-center justify-between">
                    <p className="font-body text-[12px] text-[#6B7280]">Market semasa</p>
                    <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(marketMin!)} – RM{fmt(marketMax!)}</p>
                  </div>
                )}
                {reviewerNextAction && (
                  <div className="pt-2 border-t border-black/10">
                    <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Langkah seterusnya</p>
                    <p className="font-heading font-bold text-[13px] text-[#111827] whitespace-pre-line">
                      {reviewerNextAction}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        }

        // A price FAR below the market floor is a scam/hidden-problem
        // signature (deposit scams, accident/flood cars), not a bargain —
        // escalate the guidance instead of celebrating
        const suspiciouslyCheap = effectiveVerdict === 'good_deal'
          && hasMarketData && askingPriceRm! < marketMin! * 0.8

        const kepConfig = ({
          good_deal:     { headline: 'BERBALOI',    sub: suspiciouslyCheap ? 'Harga jauh di bawah pasaran — berhati-hati.' : 'Tapi semak condition dan dokumen sebelum deposit.', headlineColor: 'text-[#0891B2]', bg: 'bg-[#F0FAFA]', border: 'border-[#99D4D1]' },
          fair_price:    { headline: 'WAJAR',       sub: 'Teruskan, tapi semak condition dan dokumen dulu.',  headlineColor: 'text-[#064E4A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
          slightly_high: { headline: 'AGAK MAHAL',  sub: 'Ada ruang untuk tawar sebelum setuju.',            headlineColor: 'text-[#B45309]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
          overpriced:    { headline: 'MAHAL',       sub: 'Jangan bayar deposit dulu.',                       headlineColor: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
        } as const)[effectiveVerdict]

        const cadangan = ({
          good_deal: suspiciouslyCheap
            ? 'Harga macam ni selalunya ada sebab — scam deposit, kereta accident/banjir, atau masalah dokumen. Jangan bayar apa-apa sebelum jumpa kereta, penjual dan geran sendiri.'
            : 'Harga nampak berbaloi. Fokus semak condition, dokumen dan inspection sebelum bayar deposit.',
          fair_price:    'Harga nampak wajar. Masih boleh minta sedikit kurang sebelum setuju.',
          slightly_high: hasMarketData
            ? `Target RM${fmt(offerLow)}–RM${fmt(offerHigh)}. Gunakan skrip di bawah.`
            : 'Harga sedikit tinggi berbanding anggaran. Minta harga lebih baik sebelum setuju.',
          overpriced: hasMarketData
            ? `Target RM${fmt(offerLow)}–RM${fmt(offerHigh)}. Kalau seller tak boleh turun, cari unit lain.`
            : 'Harga jauh lebih tinggi daripada anggaran. Tawar dengan yakin atau cari unit lain.',
        } as const)[effectiveVerdict]

        return (
          <div className={`${kepConfig.bg} border ${kepConfig.border} rounded-[14px] p-5`}>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
              Keputusan Paqar
            </p>
            <p className={`font-heading font-extrabold text-[22px] leading-tight mb-1 ${kepConfig.headlineColor}`}>
              {kepConfig.headline}
            </p>
            <p className="font-heading font-bold text-[15px] text-[#111827] mb-4">
              {kepConfig.sub}
            </p>
            <div className="space-y-2.5">
              {askingPriceRm != null && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Seller minta</p>
                  <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(askingPriceRm)}</p>
                </div>
              )}
              {hasMarketData && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Market semasa</p>
                  <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(marketMin!)} – RM{fmt(marketMax!)}</p>
                </div>
              )}
              {hasMarketData && (effectiveVerdict === 'overpriced' || effectiveVerdict === 'slightly_high') && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Anggaran lebih tinggi</p>
                  <p className="font-heading font-bold text-[14px] text-[#DC2626]">RM{fmt(askingPriceRm! - marketMax!)}+</p>
                </div>
              )}
              <div className="pt-2 border-t border-black/10">
                <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Cadangan</p>
                <p className="font-heading font-bold text-[13px] text-[#111827]">{cadangan}</p>
              </div>
              {isProvisional && verdictSource === 'market' && (
                // 3–4 comparables. Deliberately not fine print: a buyer who
                // negotiates on this needs to know how thin the evidence is
                // before the seller pushes back.
                <div className="bg-black/5 rounded-lg px-3 py-2">
                  <p className="font-body text-[12px] text-[#111827] leading-relaxed">
                    Anggaran awal — hanya {mPrices.length} iklan setanding dijumpai.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* JomCheck — shown only if purchased; hidden for RM12 basic reports */}
      {addJomCheck && (
        jomcheckStatus === 'success' && jomcheckData
          ? <JomCheckSection data={jomcheckData} currentOdometerKm={odometerForRollback} />
          : jomcheckManualPending
          ? (
            <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[15px] text-[#111827] mb-2">
                Semakan Accident/Claim Insurans
              </p>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#99D4D1] border-t-[#064E4A] animate-spin flex-shrink-0" />
                <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                  Semakan sedang diproses — keputusan akan dikemaskini dalam laporan
                  ini dalam masa 24 jam. Kami akan e-mel anda bila ia siap.
                </p>
              </div>
            </div>
          )
          : (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5">
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">
                Rekod tuntutan insurans belum dapat disemak buat masa ini.
                Laporan Paqar anda masih boleh digunakan.
              </p>
            </div>
          )
      )}

      {/* RM88 add-on upsell — RM12 buyers who haven't added the claim check */}
      {!addJomCheck && upsellJomCheck && (
        <JomCheckUpsell checkId={upsellJomCheck.checkId} claimToken={upsellJomCheck.claimToken} />
      )}

      {/* 2. Perbandingan Harga */}
      {!vehicleNotFound && (vehicleData?.valuation || askingPriceRm != null || (marketPrices?.listings.length ?? 0) > 0) && (() => {
        const val        = vehicleData?.valuation
        const wmNewPrice = val?.wmNewPrice ?? null
        const valVariant = officialVariant

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Perbandingan Harga
            </p>

            {/* Compact variant context — price must be judged for the RIGHT
                variant; the full ladder/advice stays in Semakan Varian below */}
            {officialVariant && (() => {
              const guide = findGuideByMakeModel(vehicleData?.make, vehicleData?.model)
              const pos = guide
                ? findVariantPosition(guide, `${officialVariant} ${vehicleData?.description ?? ''}`, vehicleData?.registrationYear)
                : null
              const matched = pos?.matchedVariantName
                ? pos.generation.variants.find(v => v.name === pos.matchedVariantName) ?? null
                : null
              return (
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-[#F9FAFB] rounded-lg px-3 py-2 mb-3">
                  <p className="font-body text-[12px] text-[#6B7280]">
                    Varian rekod: <span className="font-heading font-bold text-[#111827]">{officialVariant}</span>
                  </p>
                  {matched && (
                    <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                      {VERDICT_LABELS[matched.verdict]}
                    </span>
                  )}
                  <p className="font-body text-[12px] text-[#6B7280]">— banding harga ikut varian ini.</p>
                </div>
              )
            })()}

            {/* same_variant: comps are titled with the variant (a labelled
                claim, not verified). mixed_variants: comps are model-level and
                may be other variants — warn before the buyer reads them. */}
            {cohort.mode === 'same_variant' && mPrices.length > 0 && (
              <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-lg px-3 py-2.5 mb-3">
                <p className="font-body text-[12px] text-[#064E4A] leading-relaxed">
                  Perbandingan ini menggunakan listing yang menyebut “{cohort.variantToken}” sahaja.
                </p>
              </div>
            )}
            {cohort.mode === 'mixed_variants' && mPrices.length > 0 && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2.5 mb-3">
                <p className="font-body text-[12px] text-[#B45309] leading-relaxed">
                  ⚠️ Varian rekod ini jauh lebih mahal dari {vehicleData?.model ?? 'model'} biasa
                  ketika baru. Listing di bawah mungkin varian lain — banding hanya dengan iklan
                  yang sebut varian sama.
                </p>
              </div>
            )}

            {/* Raw evidence (the individual listing prices) is honest at any
                sample size. The AGGREGATE claims — "harga tengah pasaran" and
                the trade-in band — are not: one advertisement is not a market
                median, and this block is where that used to render (as RM0
                when the median was nulled, and as a confident single-ad median
                once it wasn't). Both now require verdict eligibility. */}
            {mPrices.length > 0 && marketPrices && (() => {
              const showAggregate = hasMarketData && marketMedian != null
              const daysAgo = Math.floor((Date.now() - new Date(marketPrices.fetchedAt).getTime()) / 86_400_000)
              // Confidence reflects sample quantity AND cohort specificity.
              // same_variant/normal → by count; mixed_variants → capped at
              // "Sederhana" so high confidence can never sit over a mixed set
              // (the banner + methodology always flag the mixed cohort).
              const byCount   = comparableConfidence(mPrices.length)
              const confLevel = cohort.mode === 'mixed_variants' && byCount === 'high' ? 'medium' : byCount
              const conf      = CONFIDENCE_CONFIG[confLevel]

              // Filtering is a feature — say it. A buyer who later browses the
              // marketplace sees MORE results than our chips (fuzzy search mixes
              // other years/variants in); without this line, our rigor reads as gaps.
              const excludedCount = (marketPrices.listings.length ?? 0) - relevantListings.length

              // Trade-in estimate (only when the median may be published).
              // Floor/ceil so cheap cars can't collapse to "RM7,000 – RM7,000"
              const tradeInLow  = showAggregate ? Math.floor(marketMedian * 0.80 / 1000) * 1000 : null
              const tradeInHigh = showAggregate ? Math.ceil(marketMedian * 0.85 / 1000) * 1000 : null


              return (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    {/* "Evidence of market price" only when there is enough of
                        it to be evidence. Otherwise this is simply the ads we
                        found, and must not be titled as proof of a price. */}
                    <p className="font-heading font-bold text-[12px] text-[#111827]">
                      {showAggregate ? 'Bukti Harga Pasaran' : 'Iklan Dijumpai'}
                    </p>
                    <p className="font-body text-[10px] text-[#9CA3AF]">
                      {daysAgo === 0 ? 'Hari ini' : `${daysAgo} hari lalu`}
                    </p>
                  </div>

                  {/* Median — prominent anchor. Only ever shown for a cohort
                      Paqar would issue a verdict on. */}
                  {showAggregate && (
                    <div className="flex items-center justify-between bg-[#F0FAFA] rounded-lg px-3 py-2">
                      <p className="font-body text-[12px] text-[#6B7280]">Harga tengah pasaran</p>
                      <p className="font-heading font-bold text-[14px] text-[#064E4A]">RM{fmt(marketMedian)}</p>
                    </div>
                  )}

                  <p className="font-body text-[11px] text-[#6B7280]">
                    {vehicleData?.registrationYear
                      ? `Harga listing dijumpai (tahun ${vehicleData.registrationYear} sahaja):`
                      : 'Harga listing dijumpai:'}
                  </p>
                  {/* A chip is a LINK only when the URL resolves to one advert.
                      The scraper also stores search pages, category pages and a
                      bare "/m/" stub (empty adid), and linking those sends a
                      paying buyer somewhere that is not the advert the price
                      came from. The price still renders — the row is real
                      evidence and is counted in the median above — so
                      withholding only the href keeps the displayed set
                      identical to the measured one. See lib/listing-url.ts. */}
                  <div className="flex flex-wrap gap-1.5">
                    {relevantListings.map((l, i) => {
                      const chip = 'inline-block bg-[#F0FAFA] border border-[#99D4D1] rounded-lg px-2.5 py-1 font-heading font-bold text-[12px] text-[#064E4A]'
                      return isIndividualListingUrl(l.url) ? (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                          className={`${chip} hover:bg-[#E0F2F1] transition-colors`}>
                          RM{fmt(l.price)}
                        </a>
                      ) : (
                        <span key={i} className={chip}>RM{fmt(l.price)}</span>
                      )
                    })}
                  </div>

                  {/* Methodology — states exactly which cohort was measured, so
                      the copy never describes a different set than the numbers.
                      NOT "di pasaran": the cohort is at most 15 adverts from one
                      site, up to 7 days old (CACHE_TTL_DAYS), ordered by Mudah
                      relevance rather than price. "Iklan setanding yang kami
                      jumpa" claims exactly that and nothing wider. */}
                  <p className="font-body text-[11px] text-[#9CA3AF]">
                    {cohort.mode === 'same_variant'
                      ? `Berdasarkan ${mPrices.length} iklan setanding yang kami jumpa, dilabel “${cohort.variantToken}”`
                      : cohort.mode === 'mixed_variants'
                        ? `Berdasarkan ${mPrices.length} iklan ${vehicleData?.model ?? 'model'} ${vehicleData?.registrationYear ?? ''} yang kami jumpa (pelbagai varian)`.replace(/\s+/g, ' ').trim()
                        : `Berdasarkan ${mPrices.length} iklan setanding yang kami jumpa`}
                    {excludedCount > 0 ? ` · ${excludedCount} listing ditapis (tahun/varian berbeza atau harga luar biasa)` : ''}
                  </p>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
                      <span className={`font-body text-[11px] font-semibold ${conf.labelCls}`}>{conf.label}</span>
                    </div>
                    <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">{conf.text}</p>
                  </div>

                  {/* Trade-in estimate — median-derived, so meaningless for
                      special variants whose comps are other variants */}
                  {!isSpecialVariant && tradeInLow != null && tradeInHigh != null && (
                    <div className="mt-1 pt-3 border-t border-[#F3F4F6]">
                      <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Anggaran trade-in</p>
                      <p className="font-heading font-bold text-[14px] text-[#111827]">
                        RM{fmt(tradeInLow)} – RM{fmt(tradeInHigh)}
                      </p>
                      <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">
                        Lebih kurang harga yang dealer akan bagi untuk kereta ni. Boleh guna ni bila nak tawar harga.
                      </p>
                      <p className="font-body text-[10px] text-[#9CA3AF] mt-1 leading-relaxed">
                        Anggaran sahaja. Bergantung pada kondisi, mileage dan pasaran semasa.
                      </p>
                    </div>
                  )}

                  {/* New price + depreciation insight — answers "what happens
                      when I sell this later?", which nothing else covers */}
                  {depreciationInsight && wmNewPrice != null && (
                    <div className="pt-3 border-t border-[#F3F4F6]">
                      <p className="font-body text-[12px] text-[#6B7280] mb-0.5">Harga ketika baru (anggaran)</p>
                      <p className="font-heading font-bold text-[14px] text-[#111827]">
                        RM{fmt(wmNewPrice)}
                      </p>
                      <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">
                        {depreciationInsight.note}
                      </p>
                    </div>
                  )}

                  {askingPriceRm != null && (
                    <a
                      href={`/kira-ansuran-kereta?harga=${askingPriceRm}`}
                      className="font-body text-[12px] text-[#064E4A] underline underline-offset-2 mt-1 inline-block"
                    >
                      Kira ansuran bulanan untuk harga ini →
                    </a>
                  )}
                </div>
              )
            })()}

            {/* Original new price — only shown when it's the verdict's basis
                (depreciation fallback). Next to live market data it just
                makes any used price look cheap and muddies the comparison.
                Suppressed when the interpreted block above already shows it. */}
            {wmNewPrice != null && verdictSource !== 'market' && depreciationInsight == null && (
              <div className="bg-[#F9FAFB] rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[12px] text-[#6B7280]">Harga baru asal kenderaan ini</p>
                  <p className="font-heading font-bold text-[14px] text-[#111827]">RM{fmt(wmNewPrice)}</p>
                </div>
                {valVariant && (
                  <p className="font-body text-[10px] text-[#9CA3AF] mt-0.5">Berdasarkan: {valVariant}</p>
                )}
              </div>
            )}

            {askingPriceRm == null && wmNewPrice != null && (
              <p className="font-body text-[11px] text-[#9CA3AF] mt-1">
                Masukkan harga yang penjual minta untuk perbandingan lebih tepat.
              </p>
            )}

            {vehicleData?.make && (() => {
              const mk           = vehicleData.make ?? ''
              const modelKeyword = vehicleData.model
                ? (vehicleData.model.match(/^\d+/)?.[0] ?? vehicleData.model.split(/[\s-]/)[0] ?? vehicleData.model)
                : ''
              const yr       = vehicleData.registrationYear ?? ''
              const searchTm = [mk, modelKeyword, yr].filter(Boolean).join(' ')
              const mudahUrl = `https://www.mudah.my/Malaysia/Cars-for-sale?q=${encodeURIComponent(searchTm)}`
              const carlistUrl = `https://www.carlist.my/used-cars-for-sale/${mk.toLowerCase().replace(/\s+/g, '-')}/${modelKeyword.toLowerCase().replace(/\s+/g, '-')}${yr ? `/year-${yr}` : ''}/malaysia`
              const hasLive  = (marketPrices?.listings.length ?? 0) > 0
              return !hasLive ? (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F3F4F6]">
                  <p className="font-body text-[12px] text-[#6B7280]">Tengok iklan serupa di pasaran</p>
                  <div className="flex items-center gap-3">
                    <a href={mudahUrl} target="_blank" rel="noopener noreferrer"
                      className="font-heading font-bold text-[12px] text-[#064E4A]">Mudah →</a>
                    <a href={carlistUrl} target="_blank" rel="noopener noreferrer"
                      className="font-heading font-bold text-[12px] text-[#064E4A]">Carlist →</a>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )
      })()}

      {/* 3. Skrip Rundingan */}
      {(effectiveVerdict || variantSuppressed || showDepreciationEstimate) && askingPriceRm != null && vehicleData?.make && (() => {
        const make    = String(vehicleData.make ?? '')
        const model   = String(vehicleData.model ?? '')
        const year    = String(vehicleData.registrationYear ?? '')
        const carName = [make, model, year].filter(Boolean).join(' ')

        // Special variant: quoting the generic median at the seller would
        // embarrass the buyer ("RM99k for a GP?"). The script's job here is
        // variant verification, not price anchoring.
        if (isSpecialVariant && (verdictSource === 'market' || variantSuppressed)) {
          const specialScript = `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya faham ini varian ${officialVariant}. Boleh tuan/puan sahkan varian ni dalam geran atau rekod kenderaan, dan share sejarah servis?\n\nSaya serius nak beli kalau semua okay — boleh saya buat inspection sebelum bayar deposit?`
          return (
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
                Skrip Rundingan
              </p>
              <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
                <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                  {specialScript}
                </p>
              </div>
              <CopyButton text={specialScript} />
              <p className="font-body text-[11px] text-[#9CA3AF] mt-3 leading-relaxed">
                Untuk varian khas, harga ditentukan oleh kondisi, kesahihan varian dan rekod —
                bukan harga tengah model biasa. Rundingan harga dibuat selepas semua ini disahkan.
              </p>
            </div>
          )
        }

        // Not enough comparables. The script may still help the buyer open a
        // conversation, but it must name its own basis: this is a depreciation
        // curve, not evidence about the current market. It deliberately avoids
        // "harga tengah pasaran" and "listing serupa" entirely.
        if (showDepreciationEstimate) {
          const depScript = `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nPaqar belum menemui cukup iklan setanding untuk menentukan harga pasaran. Berdasarkan harga baharu dan umur kenderaan sahaja, anggaran kasarnya sekitar RM${fmt(roundClean(depreciationExpected!))}.\n\nBoleh kita bincang harga? Saya serius nak beli kalau condition okay — boleh saya buat inspection sebelum bayar deposit?`
          return (
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
                Skrip Rundingan
              </p>
              <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
                <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                  {depScript}
                </p>
              </div>
              <CopyButton text={depScript} />
              <p className="font-body text-[11px] text-[#9CA3AF] mt-3 leading-relaxed">
                Anggaran susut nilai bukan harga pasaran. Semak beberapa iklan model yang sama
                sendiri sebelum setuju harga.
              </p>
            </div>
          )
        }

        // Reachable only when a market verdict exists.
        if (!effectiveVerdict) return null

        const listingCount = mPrices.length

        // Narrow ONCE, explicitly. The previous `fmt(marketMedian!)` assertions
        // are what let a null median render as "RM0" inside the very string the
        // buyer pastes to a seller. If any figure is missing the market scripts
        // are not built at all, and the depreciation wording is used instead.
        const marketFigures = hasMarketData && marketMedian != null && marketMin != null && marketMax != null
          ? { median: fmt(marketMedian), min: fmt(marketMin), max: fmt(marketMax) }
          : null

        // A provisional cohort (3–4 comparables) may still speak, but not with
        // the confidence of a full one — the seller will push back, and the
        // buyer should not be over-committed to a thin number.
        const provisionalNote = isProvisional
          ? `\n\n(Nota: ini anggaran awal — hanya ${listingCount} iklan setanding dijumpai.)`
          : ''

        const scripts: Record<NonNullable<typeof effectiveVerdict>, string> | null = marketFigures ? {
          overpriced:    `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah semak ${listingCount} iklan setanding — harga tengahnya RM${marketFigures.median}, dalam julat RM${marketFigures.min}–RM${marketFigures.max}.\n\nHarga RM${fmt(askingPriceRm)} agak tinggi berbanding iklan-iklan itu. Kalau condition cantik dan dokumen lengkap, boleh consider sekitar RM${fmt(offerLow)}–RM${fmt(offerHigh)}?${provisionalNote}`,
          slightly_high: `Salam, saya berminat dengan ${carName} yang tuan/puan jual.\n\nSaya dah semak ${listingCount} iklan setanding — harga tengahnya RM${marketFigures.median}, dalam julat RM${marketFigures.min}–RM${marketFigures.max}.\n\nHarga RM${fmt(askingPriceRm)} sedikit di atas iklan-iklan itu. Boleh consider sekitar RM${fmt(offerLow)}–RM${fmt(offerHigh)}?${provisionalNote}`,
          fair_price:    `Salam, saya berminat dengan ${carName} tuan/puan.\n\nSaya dah semak ${listingCount} iklan setanding — harga tengahnya sekitar RM${marketFigures.median}. Harga tuan/puan nampak okay. Apa harga terbaik yang boleh offer?${provisionalNote}`,
          good_deal:     `Salam, saya berminat dengan ${carName} tuan/puan.\n\nHarga ni nampak menarik berbanding pasaran. Bila boleh saya datang tengok? Saya serius nak beli.`,
        } : null
        // Unreachable: effectiveVerdict is market-only, so marketFigures is
        // always present here. Kept as a type-safe guard rather than an
        // assertion.
        if (!scripts) return null
        const script = scripts[effectiveVerdict]

        // Follow-up for when the seller pushes back — negotiations rarely end
        // after one message. Only shown when we have a concrete target price.
        const followUpTarget = (effectiveVerdict === 'overpriced' || effectiveVerdict === 'slightly_high')
          ? fmt(offerHigh)
          : null
        const followUpScript = followUpTarget
          ? `Saya faham tuan/puan ada harga sendiri. Tapi berdasarkan iklan setanding yang saya semak, RM${followUpTarget} setara dengan harga tengahnya.\n\nKalau boleh buat RM${followUpTarget}, saya boleh confirm minggu ini juga. Kalau tak boleh, takpe — terima kasih, saya consider unit lain.`
          : null

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Skrip Rundingan
            </p>
            <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
              <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                {script}
              </p>
            </div>
            <CopyButton text={script} />

            {followUpScript && (
              <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                <p className="font-heading font-bold text-[12px] text-[#111827] mb-2">
                  Kalau seller kata harga dah final:
                </p>
                <div className="bg-[#F9FAFB] rounded-lg p-4 mb-3">
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                    {followUpScript}
                  </p>
                </div>
                <CopyButton text={followUpScript} />
              </div>
            )}
          </div>
        )
      })()}

      {/*
        Registration state, stated explicitly.

        A buyer who supplied no plate must be told nothing was attempted —
        rather than shown an empty section that reads as a fault in their car.
        The three states are distinct (see lib/registration-claim) and the
        middle one, "we looked and found nothing", is the one that must never
        be shown to someone who never asked us to look.
      */}
      {regState !== 'checked' && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-2">
            Maklumat Pendaftaran
          </p>
          <p className="font-body text-[13px] text-[#374151] leading-relaxed">
            {REGISTRATION_COPY[regState]}
          </p>
        </div>
      )}

      {/* 4. Data Kenderaan Rasmi (JPJ) */}
      {vehicleData?.make && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280]">
              Data Kenderaan Rasmi
            </p>
            {/* NOT "Sumber: JPJ". The lookup provider (RegCheck, Infinite Loop
                Development Ltd) names no Malaysian source — only "official
                government data sources" generically — so Paqar cannot
                substantiate JPJ provenance. This says what is actually known:
                these are registration-record fields. */}
            <span className="font-body text-[10px] text-[#9CA3AF]">Maklumat pendaftaran kenderaan</span>
          </div>
          <p className="font-heading font-extrabold text-[18px] text-[#111827] mb-3 leading-tight">
            {vehicleData.description ?? `${vehicleData.make} ${vehicleData.model}`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Tahun Daftar',  value: vehicleData.registrationYear },
              { label: 'Enjin',         value: vehicleData.engineCc
                  ? `${Number.isFinite(parseFloat(vehicleData.engineCc)) ? Math.round(parseFloat(vehicleData.engineCc)) : vehicleData.engineCc}cc`
                  : null },
              { label: 'Jenis Badan',   value: vehicleData.body },
              { label: 'Nombor Rangka', value: vehicleData.vin ? `${vehicleData.vin.slice(0, -4)}****` : null },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="bg-[#F9FAFB] rounded-lg px-3 py-2">
                <p className="font-body text-[10px] text-[#9CA3AF] uppercase tracking-[.05em]">{row.label}</p>
                <p className="font-heading font-bold text-[13px] text-[#111827] mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4a. Semakan Varian — official variant vs what the seller advertises */}
      <VariantCheckCard
        make={vehicleData?.make}
        model={vehicleData?.model}
        officialVariant={officialVariant}
        description={vehicleData?.description}
        registrationYear={vehicleData?.registrationYear}
        isSpecialVariant={isSpecialVariant}
      />

      {/* 4b. Semakan Mileage — plausibility of the seller's CLAIMED reading.
          Paqar can't verify the real odometer; this checks whether the claimed
          number is believable for the car's age (MY average ~12-20k km/yr). */}
      {claimedMileageKm != null && claimedMileageKm > 0 && vehicleData?.registrationYear && (() => {
        const carAge    = Math.max(1, new Date().getFullYear() - parseInt(vehicleData.registrationYear))
        const kmPerYear = Math.round(claimedMileageKm / carAge)
        const level     = kmPerYear < 10_000 ? 'low' : kmPerYear <= 25_000 ? 'normal' : 'high'

        const cfg = ({
          low: {
            badge:    'RENDAH untuk umur kereta',
            badgeCls: 'text-[#B45309]',
            note:     'Boleh jadi genuine — tapi boleh jadi juga meter dah diputar. Minta rekod servis penuh untuk sahkan.',
          },
          normal: {
            badge:    'MUNASABAH untuk umur kereta',
            badgeCls: 'text-[#15803D]',
            note:     'Normal untuk kegunaan biasa di Malaysia (12–20k km setahun). Tetap minta rekod servis untuk sahkan.',
          },
          high: {
            badge:    'TINGGI untuk umur kereta',
            badgeCls: 'text-[#B45309]',
            note:     'Lebih tinggi dari biasa — mungkin bekas e-hailing atau selalu outstation. Guna ini untuk tawar harga lebih rendah.',
          },
        } as const)[level]

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
              Semakan Mileage
            </p>
            <div className="flex items-center justify-between mb-1">
              <p className="font-heading font-extrabold text-[20px] text-[#111827]">
                {claimedMileageKm.toLocaleString()} km
              </p>
              <p className="font-body text-[12px] text-[#6B7280]">≈ {kmPerYear.toLocaleString()} km/tahun</p>
            </div>
            <p className={`font-heading font-bold text-[13px] mb-2 ${cfg.badgeCls}`}>{cfg.badge}</p>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed">{cfg.note}</p>
            <p className="font-body text-[10px] text-[#9CA3AF] mt-2">
              {MILEAGE_PROVENANCE_LABEL[mileageSource]} Paqar tidak dapat sahkan bacaan sebenar meter.
            </p>
          </div>
        )
      })()}

      {/* 5. Status Insurans */}
      {ins && (
        <div className={`border rounded-[14px] p-5 ${
          ins.policyStatus?.toLowerCase().includes('active') ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
        }`}>
          <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-3">
            Status Insurans
          </p>
          <div className="space-y-1.5">
            <span className={`font-heading font-extrabold text-[15px] ${
              ins.policyStatus?.toLowerCase().includes('active') ? 'text-[#15803D]' : 'text-[#DC2626]'
            }`}>
              {ins.policyStatus?.toLowerCase().includes('active') ? '✓ Aktif' : '✕ Tamat Tempoh'}
            </span>
            <p className="font-body text-[13px] text-[#374151]">{ins.insurer}</p>
            <p className="font-body text-[12px] text-[#6B7280]">{translateCoverType(ins.coverType)}</p>
            {!ins.policyStatus?.toLowerCase().includes('active') && (
              <p className="font-body text-[12px] text-[#6B7280] leading-relaxed pt-1">
                Ini biasa untuk kereta yang nak dijual. Pastikan anda beli insurans baru
                sebelum tukar nama.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 6. Soalan Wajib Tanya Seller — base questions + conditions specific to this car */}
      {(() => {
        const carAge = vehicleData?.registrationYear
          ? new Date().getFullYear() - parseInt(vehicleData.registrationYear)
          : null
        const insuranceExpired = ins != null && !ins.policyStatus?.toLowerCase().includes('active')

        const questions = [
          'Ada accident besar sebelum ini?',
          'Ada flood damage?',
          'Kereta masih ada loan bank?',
          'Geran atas nama siapa?',
          'Boleh buat inspection sebelum bayar deposit?',
          // Skip for a mixed-variant cohort — "listing serupa" would overclaim
          // when the comps span multiple variants of the model.
          ...((effectiveVerdict === 'overpriced' || effectiveVerdict === 'slightly_high') && cohort.mode !== 'mixed_variants'
            ? ['Kenapa harga ni lebih tinggi dari iklan setanding yang lain?'] : []),
          ...(carAge != null && carAge >= 8
            ? ['Timing belt dan servis besar dah buat? Ada resit?'] : []),
          ...(insuranceExpired
            ? ['Kenapa insurans dah tamat? Kereta ni lama tak diguna?'] : []),
        ].slice(0, 7)

        // THE REVIEWER'S QUESTIONS COME FIRST, and they are the ones written
        // after reading THIS advert and this buyer's stated worry. The generic
        // five below are the part any assistant produces; these are not.
        // One per line, blanks dropped, deduplicated against the generic set so
        // a reviewer restating one does not print it twice.
        const reviewerQuestions = (reviewerSellerQuestions ?? '')
          .split('\n')
          .map(q => q.replace(/^\s*\d+[.)]\s*/, '').trim())
          .filter(q => q.length > 0)
        const generic = questions.filter(
          q => !reviewerQuestions.some(r => r.toLowerCase() === q.toLowerCase()),
        )
        const allQuestions = [...reviewerQuestions, ...generic].slice(0, 8)

        const questionsText = allQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')

        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
              Soalan Wajib Tanya Seller
            </p>
            <div className="space-y-3 mb-4">
              {allQuestions.map((q, i) => (
                <div key={i} className="flex gap-3">
                  <span className="font-heading font-bold text-[12px] text-[#064E4A] flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="font-body text-[13px] text-[#374151] leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
            <CopyButton text={questionsText} />
          </div>
        )
      })()}

      {/* 7. Checklist Deposit */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#6B7280] mb-4">
          Checklist sebelum bayar deposit
        </p>
        <div className="space-y-3">
          {[
            'Nombor rangka sama dengan geran',
            'Geran atas nama penjual',
            'Semak loan / hutang bank',
            'Semak saman tertunggak',
            'Cukai jalan masih sah',
            'Dapat resit deposit bertulis',
            'Nyatakan syarat refund deposit',
            'Confirm tarikh serah geran dan kunci',
          ].map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-[18px] h-[18px] rounded border-2 border-[#D1D5DB] flex-shrink-0 mt-0.5" />
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Langkah Seterusnya — end with a plan, not a trailing CTA */}
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-5">
        <p className="font-heading font-bold text-[13px] uppercase tracking-[.07em] text-[#15803D] mb-4">
          Langkah Seterusnya
        </p>
        <div className="space-y-3">
          {[
            'Hantar skrip rundingan ke seller melalui WhatsApp',
            'Kalau harga dah okay — buat inspection dulu, jangan bayar deposit lagi',
            'Bawa checklist di atas semasa jumpa seller',
            'Dah confirm beli? Dapatkan insurans sebelum tukar nama',
          ].map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-[20px] h-[20px] rounded-full bg-[#15803D] text-white font-heading font-bold text-[11px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <p className="font-body text-[13px] text-[#374151] leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 9. CTAs */}
      <InspectionCTA plate={plate} />
      <InsuranceCTA />

      <p className="font-body text-[11px] text-[#D1D5DB] text-center pt-2">
        Disediakan oleh Paqar · paqar.my
      </p>

    </div>
  )
}
