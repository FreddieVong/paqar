import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  REFUND_GUARANTEE_SHORT, REFUND_GUARANTEE_LONG, REFUND_WORKING_DAYS,
} from '@/lib/pricing'
import { canTransitionRefund } from '@/lib/report-workflow'

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')

/**
 * Billplz API v3 exposes no refund endpoint and none exists in this codebase.
 * Every refund is a human moving money. The product may therefore promise a
 * refund, but never an instant or automatic one.
 */
describe('refund copy does not promise automation that does not exist', () => {
  it.each([REFUND_GUARANTEE_SHORT, REFUND_GUARANTEE_LONG])(
    'avoids instant/automatic language: %s',
    (copy) => {
      expect(copy).not.toMatch(/serta-merta|automatik sepenuhnya|instant|sekelip/i)
    },
  )

  it('names a real working-day window', () => {
    expect(REFUND_GUARANTEE_LONG).toContain(`${REFUND_WORKING_DAYS} hari bekerja`)
    expect(REFUND_WORKING_DAYS).toBeGreaterThan(0)
  })

  it('says a human does it', () => {
    expect(REFUND_GUARANTEE_LONG).toMatch(/bukan automatik/i)
  })

  it('no surface claims a one-click refund', () => {
    // lib/faq/home.ts carries the refund ANSWER now — the one place a buyer
    // reads the promise before paying, and the one Google can quote.
    for (const path of ['app/page.tsx', 'lib/faq/home.ts',
                        'components/report/PaymentForm.tsx', 'app/terma/page.tsx']) {
      expect(read(path), path).not.toMatch(/refund segera|refund automatik|satu klik/i)
    }
  })
})

/**
 * The state machine is what stops a flag change being called a completed
 * refund: money cannot reach 'refunded' without passing through the state in
 * which a human is actually moving it.
 */
describe('a flag change cannot become a completed refund', () => {
  it('refuses required → refunded, skipping the human step', () => {
    expect(canTransitionRefund('required', 'refunded')).toBe(false)
  })

  it('refuses not_required → refunded', () => {
    expect(canTransitionRefund('not_required', 'refunded')).toBe(false)
  })

  it('allows only processing → refunded', () => {
    expect(canTransitionRefund('processing', 'refunded')).toBe(true)
  })

  /** Migration 032 additionally CHECKs that refunded carries a reference. */
  it('the migration requires evidence for a completed refund', () => {
    const sql = read('supabase/migrations/032_concierge_review.sql')
    expect(sql).toContain('buyer_reports_refund_completed_evidence')
    expect(sql).toContain('refund_reference IS NOT NULL')
  })

  it('the completion writer refuses an empty reference', () => {
    const src = read('lib/db/report-review.ts')
    const fn  = src.slice(src.indexOf('export async function completeRefund'))
    expect(fn).toContain('if (!reference) return false')
  })
})
