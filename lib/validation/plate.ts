import { z } from 'zod'

export function normalise(plate: string): string {
  return plate.toUpperCase().replace(/[\s\-]/g, '')
}

/** Permissive for MVP: 3–12 alphanumeric chars after normalisation. */
export const plateSchema = z
  .string()
  .transform(normalise)
  .refine((p) => /^[A-Z0-9]{3,12}$/.test(p), {
    message: 'Invalid plate number (expected 3–12 alphanumeric characters)',
  })
