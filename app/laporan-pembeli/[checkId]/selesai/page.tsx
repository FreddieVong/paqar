import { redirect }                                  from 'next/navigation'
import Image                                         from 'next/image'
import { Nav }                                       from '@/components/layout/Nav'
import { Shell }                                     from '@/components/layout/Shell'
import { getCheck }                                  from '@/lib/db/checks'
import { markReportPaid, getBuyerReportByBillId,
         markUpgradePaid, getBuyerReportByUpgradeBillId,
         getBuyerReport } from '@/lib/db/buyer-reports'
import { decrypt }                                   from '@/lib/crypto'
import { deliverBuyerReportReceipt }                 from '@/lib/receipt-delivery'
import { buildBuyerReportAccessUrl }                 from '@/lib/report-access'
import { whatsappUrl }                               from '@/lib/site'
import { recordPurchase }                            from '@/lib/purchase-attribution'
import { verifyRedirectSignature }                   from '@/lib/billplz'
import { isJomCheckManual }                          from '@/lib/jomcheck'
import { resolvePaymentDisplayState }                from '@/lib/payment-display-state'
import { AnalyticsEvent }                            from '@/components/layout/AnalyticsEvent'
import { GA4PurchaseEvent }                          from '@/components/layout/GA4PurchaseEvent'
import { GoogleAdsConversion }                       from '@/components/layout/GoogleAdsConversion'
import { WhatsAppShareButton }                       from '@/components/report/WhatsAppShareButton'

interface Props {
  params:       { checkId: string }
  searchParams: Record<string, string | undefined>
}

export default async function LaporanSelesaiPage({ params, searchParams }: Props) {
  const claimToken   = searchParams['claim_token']

  if (!claimToken) redirect('/')

  // Built through the shared helper so this page can never render a button
  // whose URL the report page would reject (claim_token=undefined was the
  // shape this used to be able to produce).
  const reportUrl = buildBuyerReportAccessUrl({ checkId: params.checkId, claimToken })

  // Support CTAs. The check ID is a safe reference — it is not a credential,
  // and without it the buyer has to explain the whole purchase from scratch.
  // The claim token is deliberately NOT included: it grants report access and
  // must never travel through a shareable message.
  const invalidSupportUrl = whatsappUrl(
    `Hai Paqar, pembayaran saya tidak dapat disahkan.\n\nCheck ID: ${params.checkId}`,
  )
  const pendingSupportUrl = whatsappUrl(
    `Hai Paqar, pembayaran saya masih "sedang disahkan".\n\nCheck ID: ${params.checkId}`,
  )

  // Verify redirect signature first — if missing/invalid/tampered, displayState will be 'invalid'
  const verifiedParams = verifyRedirectSignature(searchParams)

  let displayState = resolvePaymentDisplayState({
    checkId:         params.checkId,
    billId:          verifiedParams?.['billplzid'] ?? '',
    signedPaid:      verifiedParams?.['billplzpaid'] === 'true' || false,
    report:          null,
    upgradeReport:   null,
    wasJustPaid:     false,
    wasJustUpgraded: false,
  })

  // Only attempt mutations if signature is valid and we have a billId
  if (verifiedParams) {
    const billId = verifiedParams['billplzid']
    const signedPaid = verifiedParams['billplzpaid'] === 'true'

    if (billId) {
      // Read-only first — determine which transaction (if any) this billId resolves to,
      // and whether it belongs to this route's checkId.
      const [report, upgradeReport] = await Promise.all([
        getBuyerReportByBillId(billId).catch(() => null),
        getBuyerReportByUpgradeBillId(billId).catch(() => null),
      ])

      // Check if match is valid and transaction is for this checkId
      // Only proceed with mutation if signature is valid, transaction is found, and signed=paid=true
      const isNormalMatch = report && report.check_id === params.checkId
      const isUpgradeMatch = upgradeReport && upgradeReport.check_id === params.checkId
      const hasValidMatch = isNormalMatch || isUpgradeMatch

      if (hasValidMatch && signedPaid) {
        // Attempt mutation only if signature verified, match found, and signedPaid=true
        let wasJustPaid = false
        let wasJustUpgraded = false

        if (isNormalMatch && report) {
          wasJustPaid = await markReportPaid(billId).catch(() => false)
          if (wasJustPaid) {
            // Idempotent: claimReceiptSend() refuses a row the webhook has
            // already sent, so browser-return and webhook cannot double-send.
            await deliverBuyerReportReceipt(report).catch(err =>
              console.error('[selesai:receipt]', { buyerReportId: report.id, error: String(err) }))
          }
          // Called regardless of wasJustPaid. If the webhook won the race but
          // its attribution write failed, this is the retry; if it succeeded,
          // the derived event_id makes this a no-op. That is what makes
          // /selesai a genuine fallback rather than a coin flip.
          void recordPurchase({
            billId,
            email:         report.buyer_email,
            amountCents:   report.amount_cents,
            checkId:       report.check_id,
            buyerReportId: report.id,
          })
        }

        if (isUpgradeMatch && upgradeReport) {
          wasJustUpgraded = await markUpgradePaid(billId).catch(() => false)
          if (wasJustUpgraded) {
            await deliverBuyerReportReceipt({ ...upgradeReport, amount_cents: 8800 })
              .catch(err => console.error('[selesai:receipt-upgrade]',
                { buyerReportId: upgradeReport.id, error: String(err) }))
          }
          void recordPurchase({
            billId,
            email:         upgradeReport.buyer_email,
            amountCents:   8800,
            checkId:       upgradeReport.check_id,
            buyerReportId: upgradeReport.id,
          })
        }

        // Determine final display state with mutation results
        displayState = resolvePaymentDisplayState({
          checkId:         params.checkId,
          billId,
          signedPaid,
          report:          report && report.check_id === params.checkId ? report : null,
          upgradeReport:   upgradeReport && upgradeReport.check_id === params.checkId ? upgradeReport : null,
          wasJustPaid,
          wasJustUpgraded,
        })
      } else {
        // Transaction not found or checkId doesn't match, determine state without mutation
        displayState = resolvePaymentDisplayState({
          checkId:         params.checkId,
          billId,
          signedPaid,
          report:          report && report.check_id === params.checkId ? report : null,
          upgradeReport:   upgradeReport && upgradeReport.check_id === params.checkId ? upgradeReport : null,
          wasJustPaid:     false,
          wasJustUpgraded: false,
        })
      }
    }
  }

  const row = await getCheck(params.checkId, claimToken)

  // The plate is cosmetic here — a heading and the share text. It must never
  // be able to 500 the page a customer lands on straight after paying, which
  // an unguarded decrypt of a malformed ciphertext would do. Same posture as
  // receipt-delivery.ts and the webhook.
  let plate: string | null = null
  if (row) {
    try { plate = decrypt(row.check.plate_encrypted as string).toUpperCase() }
    catch { console.error('[selesai] plate decrypt failed', { checkId: params.checkId }) }
  }

  /**
   * Whether the token in the URL actually opens the report.
   *
   * getCheck(id, token) returns null when the token does not match, so `row`
   * is the verification — reportUrl above was built from the raw query string
   * alone, which meant a mistyped or truncated claim_token still rendered a
   * "Lihat Laporan Saya" button. That button then 404s on the report page,
   * which applies the same check properly. Handing a paying customer a dead
   * link at the exact moment they are looking for what they just bought is the
   * worst possible time to do it: it reads as "my payment vanished".
   */
  const credentialWorks = row !== null

  // RM88 add-on nudge — only for RM12 buyers when JomCheck is live
  // Only show if we're in verified_paid state and it's the normal (non-upgrade) path
  const paidReport = displayState.state === 'verified_paid' ? await getBuyerReport(params.checkId).catch(() => null) : null
  const showJomCheckNudge =
    process.env.JOMCHECK_ENABLED === 'true' &&
    displayState.state === 'verified_paid' &&
    paidReport?.status === 'paid' &&
    !paidReport.add_jomcheck

  // Manual fulfillment: tell the buyer the claim check takes up to 24 hours
  const showManualProcessingNote =
    isJomCheckManual() &&
    displayState.state === 'verified_paid' &&
    paidReport?.add_jomcheck === true &&
    paidReport.jomcheck_status !== 'success'

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 max-w-sm mx-auto space-y-5 text-center">
          {displayState.state === 'verified_paid' && <AnalyticsEvent event="payment_completed" />}
          {displayState.state === 'verified_paid' && (
            <GA4PurchaseEvent
              transactionId={displayState.purchaseInfo.transactionId}
              value={displayState.purchaseInfo.valueRm}
              itemId={displayState.purchaseInfo.itemId}
              itemName={displayState.purchaseInfo.itemName}
            />
          )}
          {displayState.state === 'verified_paid' && (
            <GoogleAdsConversion
              email={displayState.buyerEmail}
              transactionId={displayState.purchaseInfo.transactionId}
              value={displayState.purchaseInfo.valueRm}
            />
          )}

          {displayState.state === 'verified_paid' && (
            <div className="bg-[#F0FAFA] border border-[#99D4D1] rounded-[16px] p-6">
              <Image
                src="/paqar-logo.png"
                alt="Paqar"
                width={80}
                height={46}
                className="mx-auto mb-3 object-contain"
              />
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
                Laporan Pembeli
              </p>
              <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
                Pembayaran Berjaya
              </p>
              {plate && (
                <p className="font-heading font-extrabold text-[28px] tracking-[.1em] text-[#064E4A] mb-2">
                  {plate}
                </p>
              )}
              <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
                Laporan anda sedia untuk dilihat. Simpan link ini — anda boleh akses semula pada bila-bila masa.
              </p>
              {showManualProcessingNote && (
                <p className="font-body text-[13px] text-[#374151] leading-relaxed mt-3 bg-white/70 border border-[#99D4D1] rounded-[10px] px-3 py-2">
                  Semakan Accident/Claim Insurans akan dikemaskini dalam laporan
                  anda dalam masa 24 jam. Kami akan e-mel anda bila ia siap.
                </p>
              )}
            </div>
          )}

          {displayState.state === 'pending_verification' && (
            <div className="bg-[#FEF3C7] border border-[#FBBF24] rounded-[16px] p-6">
              <Image
                src="/paqar-logo.png"
                alt="Paqar"
                width={80}
                height={46}
                className="mx-auto mb-3 object-contain"
              />
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#92400E] mb-2">
                Pembayaran
              </p>
              <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
                Pembayaran sedang disahkan
              </p>
              <p className="font-body text-[13px] text-[#78350F] leading-relaxed">
                Pembayaran masih sedang disahkan. Jika status ini tidak berubah, hubungi
                kami dan sertakan rujukan di bawah.
              </p>
              <p className="font-body text-[12px] text-[#78350F] mt-2">
                Rujukan: <strong>{params.checkId}</strong>
              </p>
              {pendingSupportUrl && (
                <a
                  href={pendingSupportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 bg-[#064E4A] text-white font-heading font-bold text-[13px] rounded-[10px] px-4 py-2.5"
                >
                  Hubungi Paqar di WhatsApp
                </a>
              )}
            </div>
          )}

          {displayState.state === 'invalid' && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[16px] p-6">
              <Image
                src="/paqar-logo.png"
                alt="Paqar"
                width={80}
                height={46}
                className="mx-auto mb-3 object-contain"
              />
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#7F1D1D] mb-2">
                Ralat
              </p>
              <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
                Pembayaran tidak dapat disahkan
              </p>
              <p className="font-body text-[13px] text-[#991B1B] leading-relaxed">
                Kalau anda sudah bayar, jangan bayar lagi. Hubungi kami dengan rujukan
                di bawah dan kami akan semak.
              </p>
              <p className="font-body text-[12px] text-[#991B1B] mt-2">
                Rujukan: <strong>{params.checkId}</strong>
              </p>
              {invalidSupportUrl && (
                <a
                  href={invalidSupportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 bg-[#064E4A] text-white font-heading font-bold text-[13px] rounded-[10px] px-4 py-2.5"
                >
                  Hubungi Paqar di WhatsApp
                </a>
              )}
            </div>
          )}

          {/* Only rendered when the URL carries a credential the report page
              will actually accept — shape AND match, not shape alone. */}
          {reportUrl && credentialWorks && (
            <a
              href={reportUrl}
              className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#053D3A] transition-colors"
            >
              Lihat Laporan Saya →
            </a>
          )}

          {/* The token does not open this check. Never a dead button: give the
              buyer a way to reach a human, with the one reference that is safe
              to put in a message. */}
          {!credentialWorks && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-5 text-left">
              <p className="font-heading font-bold text-[14px] text-[#111827] mb-1.5">
                Kami tidak dapat buka laporan dengan pautan ini
              </p>
              <p className="font-body text-[13px] text-[#78350F] leading-relaxed">
                Pautan ini tidak sepadan dengan mana-mana semakan. Kalau anda sudah
                bayar, jangan bayar lagi — hubungi kami dengan rujukan di bawah dan
                kami akan hantar laporan anda.
              </p>
              <p className="font-body text-[12px] text-[#78350F] mt-2">
                Rujukan: <strong>{params.checkId}</strong>
              </p>
              {pendingSupportUrl && (
                <a
                  href={pendingSupportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 bg-[#064E4A] text-white font-heading font-bold text-[13px] rounded-[10px] px-4 py-2.5"
                >
                  Hubungi Paqar di WhatsApp
                </a>
              )}
            </div>
          )}

          {showJomCheckNudge && (
            <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
              Kereta ini pernah accident atau banjir? Tambah{' '}
              <span className="font-semibold text-[#064E4A]">Semakan Accident/Claim Insurans (+RM88)</span>{' '}
              terus dalam laporan anda.
            </p>
          )}

          {plate && reportUrl && credentialWorks && displayState.state === 'verified_paid' && (
            <WhatsAppShareButton
              href={`https://wa.me/?text=${encodeURIComponent(`Laporan Paqar untuk ${plate} sedia!\n\nLihat laporan di sini:\n${reportUrl}\n\nJuga boleh tempah inspection sebelum bayar deposit.`)}`}
            />
          )}

          {displayState.state === 'verified_paid' && (
            <p className="font-body text-[11px] text-[#9CA3AF]">
              Resit akan dihantar ke e-mel anda.
            </p>
          )}
        </div>
      </Shell>
    </>
  )
}
