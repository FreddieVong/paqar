/**
 * Builds the model keyword used for Mudah market price searches from JPJ vehicle data.
 *
 * JPJ returns raw model strings like "GOLF GTI", "VIOS", "7" (BMW series).
 * BMW models are stored as a single digit with the full variant in the description
 * e.g. model="7", description="BMW 7 30Li (CBU)" → keyword "730".
 * For all other models we use the first word of the model field.
 */
export function buildMarketModelKeyword(rawModel: string, description: string): string {
  const numPrefix   = rawModel.match(/^\d+/)?.[0]
  const adjTwoDigit = rawModel.length === 1
    ? description.match(new RegExp(`\\b${rawModel}\\s+(\\d{2})`))?.[1]
    : null
  const descNum = adjTwoDigit
    ? rawModel + adjTwoDigit
    : numPrefix
      ? description.match(/(\d{3,})/)?.[1]
      : null
  return (numPrefix && numPrefix.length >= 3)
    ? numPrefix
    : (descNum ?? rawModel.split(/[\s-]/)[0] ?? rawModel)
}
