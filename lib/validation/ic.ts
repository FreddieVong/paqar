import { z } from 'zod'

export function normalise(ic: string): string {
  return ic.replace(/-/g, '')
}

function hasValidDatePrefix(ic: string): boolean {
  const month = parseInt(ic.slice(2, 4), 10)
  const day   = parseInt(ic.slice(4, 6), 10)
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

export const icSchema = z
  .string()
  .transform(normalise)
  .refine((ic) => /^\d{12}$/.test(ic), { message: 'IC must be 12 digits' })
  .refine(hasValidDatePrefix, { message: 'IC has invalid date prefix (YYMMDD)' })
