import { ApiError } from './errors'

/**
 * Normalizes and validates a Malaysian vehicle plate.
 * Format: 3 letters + 3 digits (e.g., WPH925)
 * Throws ApiError if invalid.
 */
export function normalizePlate(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new ApiError('Plate number is required', 400)
  }

  // Remove whitespace and dashes
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase()

  // Must be 6 characters: 3 letters + 3 digits
  const match = cleaned.match(/^([A-Z]{3})(\d{3})$/)
  if (!match) {
    throw new ApiError(
      'Invalid plate format. Expected 3 letters + 3 digits (e.g., WPH925)',
      400
    )
  }

  return cleaned
}

/**
 * Validates plate without throwing; returns boolean.
 * Useful for client-side validation or guards.
 */
export function validatePlate(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z]{3}\d{3}$/.test(cleaned)
}
