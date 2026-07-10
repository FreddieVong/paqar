export interface DepreciationInsight {
  note: string
}

/**
 * Interprets retention (median market price / new price) against a simple
 * age curve (~12%/yr compound, floored — very old cars converge to floor
 * value). Premium cars (RM150k+ new) get the ownership-cost warning even at
 * merely below-average retention, because that's what the market is pricing
 * in. Returns null when the numbers can't be interpreted honestly (too
 * young, too old, median >= new price) — the caller must then show nothing:
 * a new-price anchor without interpretation is the dealer's pitch.
 */
export function assessDepreciation(
  newPriceRm: number,
  medianPriceRm: number,
  ageYears: number,
): DepreciationInsight | null {
  if (newPriceRm <= 0 || medianPriceRm <= 0) return null
  if (!Number.isFinite(ageYears) || ageYears < 2 || ageYears > 25) return null
  if (medianPriceRm >= newPriceRm) return null // data smells wrong — hide

  const retention = medianPriceRm / newPriceRm
  const expected  = Math.max(Math.pow(0.88, ageYears), 0.06)
  const ratio     = retention / expected
  const isPremium = newPriceRm >= 150_000

  if (ratio >= 1.4) {
    return { note: 'Model ni pegang nilai berbanding kereta lain seusia — biasanya senang jual balik nanti.' }
  }
  if (ratio <= 0.65 || (isPremium && ratio < 1.0)) {
    return { note: 'Susut nilai curam — murah nak beli, tapi ambil kira kos selenggara dan nilai jual balik yang lebih rendah.' }
  }
  return { note: 'Susut nilai biasa untuk kereta umur macam ni.' }
}
