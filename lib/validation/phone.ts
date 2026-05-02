import { z } from 'zod'

function normaliseRaw(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '')
}

export const phoneSchema = z
  .string()
  .transform(normaliseRaw)
  .refine(
    (p) => /^(\+60|60|0)\d{9,10}$/.test(p),
    { message: 'Invalid Malaysian phone number' }
  )
  .transform((p) => {
    if (p.startsWith('0'))  return '+6' + p
    if (p.startsWith('60')) return '+' + p
    return p
  })
