/**
 * The brand/model catalogue, shared by the free model checker UI and the API
 * behind it.
 *
 * It lived only inside OverpricedCheckerForm, where its own comment noted that
 * "the market-price cache is keyed on the model string, so 'Myvi' hits cached
 * data while 'myvi se' misses it". The model field is free text with these as
 * datalist suggestions, so buyers type variant-qualified names constantly and
 * the miss was real. Measured in production cache:
 *
 *   perodua / "myvi 1.3 cc ezi outo" / 2011    5 listings   ("myvi" has 15)
 *   honda   / "civic 1.8s"           / 2022    5 listings   ("civic" has 15)
 *   nissan  / "almera 1.0 vlt turbo" / 2022   15 listings
 *   bmw     / 2020 alone held four spellings: 3, 3 series, 320, 330
 *
 * A thinner cohort is not just slower — comparableConfidence bands at 5 and 10,
 * so "Civic 1.8S" answered at LOW confidence what "Civic" answers at high, and
 * below three comparables the verdict is suppressed entirely. That is a worse
 * answer and a lost sale, from a typo-level difference in what someone typed.
 */

export const BRANDS = [
  'Perodua', 'Proton', 'Toyota', 'Honda', 'Mazda',
  'BMW', 'Mercedes-Benz', 'Volkswagen', 'Mitsubishi', 'Nissan',
  'Hyundai', 'Kia', 'Suzuki', 'Subaru', 'Daihatsu', 'Ford',
  'Peugeot', 'Chevrolet', 'MG',
  'Volvo', 'Audi', 'MINI', 'Lexus', 'Land Rover', 'Jaguar', 'Porsche',
  'Isuzu', 'Chery', 'BYD', 'Tesla',
]

// Known models per brand — shown as autocomplete suggestions. Consistent
// spelling matters: the market-price cache is keyed on the model string, so
// "Myvi" hits cached data while "myvi se" misses it. Free text still allowed.
export const MODELS_BY_BRAND: Record<string, string[]> = {
  Perodua:    ['Myvi', 'Axia', 'Bezza', 'Alza', 'Ativa', 'Aruz', 'Kancil', 'Viva', 'Kelisa', 'Kenari', 'Nautica'],
  Proton:     ['Saga', 'Persona', 'Iriz', 'X50', 'X70', 'X90', 'S70', 'Exora', 'Wira', 'Waja', 'Preve', 'Suprima S', 'Satria', 'Perdana', 'Inspira', 'Gen-2'],
  Toyota:     ['Vios', 'Yaris', 'Corolla', 'Corolla Cross', 'Camry', 'Hilux', 'Fortuner', 'Innova', 'Avanza', 'Alphard', 'Vellfire', 'Rush', 'Veloz', 'RAV4', 'Harrier', 'Estima', 'Wish', 'Altis', 'Unser'],
  Honda:      ['City', 'Civic', 'Jazz', 'HR-V', 'CR-V', 'BR-V', 'Accord', 'WR-V', 'Odyssey', 'Stream', 'Freed', 'Insight'],
  Nissan:     ['Almera', 'X-Trail', 'Serena', 'Navara', 'Grand Livina', 'Sylphy', 'Teana', 'Note', 'Juke', 'Latio', 'March', 'Livina'],
  Mazda:      ['CX-5', 'CX-3', 'CX-30', 'Mazda 2', 'Mazda 3', 'Mazda 6', 'CX-8', 'CX-9', 'CX-60', 'BT-50'],
  Mitsubishi: ['Xpander', 'Triton', 'ASX', 'Outlander', 'Attrage'],
  Hyundai:    ['Elantra', 'Tucson', 'Santa Fe', 'i30', 'Sonata'],
  Kia:        ['Picanto', 'Cerato', 'Sportage', 'Seltos', 'Carnival'],
  Suzuki:     ['Swift', 'Jimny', 'Vitara'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Tiguan', 'Vento'],
  BMW:        ['3 Series', '5 Series', 'X1', 'X3', 'X5', '1 Series', '2 Series', '4 Series', '6 Series', '7 Series', '8 Series', 'X2', 'X4', 'X6', 'X7', 'i3', 'i4', 'iX'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'A-Class', 'S-Class', 'GLC', 'GLA', 'GLB', 'GLE', 'CLA', 'CLS', 'B-Class', 'V-Class'],
  Ford:       ['Ranger', 'Everest', 'Fiesta', 'Focus'],
  Subaru:     ['Forester', 'XV', 'Impreza', 'WRX', 'Outback', 'BRZ'],
  Daihatsu:   ['Gran Max', 'Hijet', 'Terios', 'Materia'],
  Volvo:      ['XC40', 'XC60', 'XC90', 'S60', 'V40', 'S90'],
  Audi:       ['A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7'],
  MINI:       ['Cooper', 'Countryman', 'Clubman', 'Cooper S'],
  Lexus:      ['ES', 'NX', 'RX', 'IS', 'UX', 'LX'],
  Peugeot:    ['3008', '5008', '2008', '208', '408', '508'],
  Chevrolet:  ['Cruze', 'Colorado', 'Sonic', 'Captiva', 'Orlando', 'Trailblazer'],
  MG:         ['ZS', 'HS', 'MG5', 'MG4'],
  'Land Rover': ['Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar', 'Discovery Sport', 'Defender', 'Range Rover'],
  Jaguar:     ['XE', 'XF', 'F-Pace', 'E-Pace', 'F-Type'],
  Porsche:    ['Macan', 'Cayenne', '911', 'Panamera', 'Taycan', 'Boxster'],
  Isuzu:      ['D-Max', 'MU-X'],
  Chery:      ['Omoda 5', 'Tiggo 8 Pro', 'Tiggo 7 Pro'],
  BYD:        ['Atto 3', 'Dolphin', 'Seal'],
  Tesla:      ['Model 3', 'Model Y', 'Model S', 'Model X'],
}

/**
 * Resolves a free-text model to the catalogue spelling, for use as a cache key.
 *
 * Longest known model that the input starts with, at a TOKEN boundary. The
 * boundary is what makes it safe: "CX-30" must not collapse into "CX-3", so the
 * character after the match has to be a space or the end of the string. Sorting
 * by length first means "Mazda 3" wins over "Mazda" and "CX-30" over "CX-3".
 *
 * Anything unrecognised is returned trimmed and otherwise untouched — an
 * unknown model must behave exactly as it does today rather than be forced into
 * a neighbouring one.
 */
export function canonicalModelKeyword(brand: string, typedModel: string): string {
  const input = (typedModel ?? '').trim()
  if (!input) return input

  const brandKey = Object.keys(MODELS_BY_BRAND)
    .find(b => b.toLowerCase() === (brand ?? '').trim().toLowerCase())
  if (!brandKey) return input

  const lower = input.toLowerCase()
  const match = [...(MODELS_BY_BRAND[brandKey] ?? [])]
    .sort((a, b) => b.length - a.length)
    .find(m => {
      const ml = m.toLowerCase()
      if (!lower.startsWith(ml)) return false
      const next = lower.charAt(ml.length)
      return next === '' || next === ' '
    })

  return match ?? input
}
