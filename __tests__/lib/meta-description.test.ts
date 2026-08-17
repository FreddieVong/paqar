import { describe, it, expect } from 'vitest'
import { clampMetaDescription, META_DESCRIPTION_MAX } from '@/lib/meta-description'

describe('clampMetaDescription', () => {
  it('leaves a description already within budget untouched', () => {
    const s = 'Beza varian Myvi: G vs X vs H vs AV. Untuk kebanyakan pembeli: 1.5 H.'
    expect(clampMetaDescription(s)).toBe(s)
  })

  it('never exceeds the budget', () => {
    const long = 'Beza varian Bezza: G vs X vs Advance. ' + 'panjang '.repeat(60)
    expect(clampMetaDescription(long).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX)
  })

  it('never cuts mid-word', () => {
    const long = 'Beza varian Bezza: G vs X vs Advance. ' + 'kebolehpercayaan '.repeat(20)
    const out = clampMetaDescription(long)
    // every word in the output must appear whole in the source
    for (const w of out.split(' ')) expect(long).toContain(w)
  })

  it('prefers a sentence boundary when one sits in the back half of the budget', () => {
    const s = 'Beza varian Myvi: G vs X vs H vs AV. Untuk kebanyakan pembeli varian 1.5 H memang pilihan paling berbaloi. Ayat ketiga yang panjang ini sepatutnya dipotong sepenuhnya kerana melebihi bajet.'
    const out = clampMetaDescription(s)
    expect(out.endsWith('.')).toBe(true)
    expect(out).not.toContain('Ayat ketiga')
  })

  it('falls back to a word boundary when the only full stop is too early', () => {
    // Full stop at char ~12 is below 60% of budget; cutting there would discard the answer.
    const s = 'Ringkas ya. ' + 'kebolehpercayaan varian '.repeat(15)
    const out = clampMetaDescription(s)
    expect(out.length).toBeGreaterThan(Math.floor(META_DESCRIPTION_MAX * 0.6))
    expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX)
  })

  it('leaves no dangling punctuation or connector', () => {
    const s = 'Beza varian Alza: X vs H vs AV, ' + 'panjang sekali '.repeat(20)
    expect(clampMetaDescription(s)).not.toMatch(/[\s,;:—–-]$/)
  })

  it('collapses whitespace so a template newline cannot inflate the count', () => {
    expect(clampMetaDescription('Beza  varian\n\nMyvi.')).toBe('Beza varian Myvi.')
  })

  it('honours an explicit smaller budget', () => {
    const out = clampMetaDescription('satu dua tiga empat lima enam tujuh lapan', 20)
    expect(out.length).toBeLessThanOrEqual(20)
  })

  // Regression guard tied to the real defect: production /varian/* descriptions
  // measured 238-284 characters on 2026-08-14.
  it('brings a real production-length variant description inside budget', () => {
    const real = 'Beza varian Perodua Bezza terpakai — G vs X vs Advance. Untuk kebanyakan pembeli: 1.3 X — enjin 4 silinder yang lebih lancar dengan kit cukup. 1.0 G hanya jika bajet betul-betul ketat. Nilai terbaik, varian untuk elak, cara cam varian sebenar, dan harga berpatutan.'
    expect(real.length).toBeGreaterThan(238)
    expect(clampMetaDescription(real).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX)
  })
})
