// Drop listings priced absurdly far from the median — usually a different
// generation/trim of the same model name, or a dealer typo. Observed: one
// RM115,999 listing among RM17k-39k cars stretched the raw max so far that
// an asking price 41% above median was verdicted WAJAR instead of MAHAL.
export function filterOutlierPrices(prices: number[]): number[] {
  if (prices.length < 4) return prices
  const sorted = [...prices].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
  const kept = prices.filter(p => p >= median * 0.35 && p <= median * 2.2)
  return kept.length >= 3 ? kept : prices
}
