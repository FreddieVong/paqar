'use client'

import { formatPriceInput, toDigits } from '@/lib/price-input'

/**
 * The asking-price field, shared by all four forms that ask for one.
 *
 * WHAT CHANGED AND WHY
 *
 * It was `type="number"` on a grey background with a #D1D5DB placeholder —
 * about 1.5:1, so on a phone in daylight the field read as disabled and the
 * hint was invisible. It also could not show thousands separators, and `59000`
 * differs from `590000` by one glyph in a field a buyer fills once, in a hurry,
 * standing next to the car.
 *
 * THE CONTRACT
 *
 * `value` is DIGITS ONLY and `onChange` hands back digits only. Formatting
 * exists on screen and nowhere else, which is what keeps the wire format
 * identical: `parseInt(value, 10)`, the `asking_price` URL parameter and the
 * idempotency key derived from this string all behave exactly as before.
 *
 * Range validation stays in the form that owns it. Dropping `type="number"`
 * drops native min/max, so every caller must do its own check — see
 * lib/price-input for why the boundary sits here.
 */
export function AskingPriceInput({
  id,
  value,
  onChange,
  className,
  placeholder = '59,000',
  required = true,
  ariaLabel,
  onFocus,
}: {
  id?: string
  /** Digits only, e.g. "59000". */
  value: string
  /** Receives digits only. */
  onChange: (digits: string) => void
  className: string
  placeholder?: string
  required?: boolean
  ariaLabel?: string
  /** Forwarded so callers can measure engagement with the field itself. */
  onFocus?: () => void
}) {
  return (
    <div className="relative">
      {/* Inside the field, not in the label: the unit belongs with the number
          the buyer is typing, and it survives when the label scrolls away. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading font-bold text-[15px] text-[#6B7280]"
      >
        RM
      </span>
      <input
        id={id}
        type="text"
        // Digits-only keypad on mobile without type="number"'s scroll-wheel and
        // spinner behaviour — and without its ban on formatted values.
        inputMode="numeric"
        autoComplete="off"
        value={formatPriceInput(value)}
        onChange={e => onChange(toDigits(e.target.value))}
        placeholder={placeholder}
        required={required}
        onFocus={onFocus}
        aria-label={ariaLabel}
        className={className}
      />
    </div>
  )
}

/**
 * The field styling the three full-width forms share.
 *
 * White rather than #F9FAFB so it reads as enabled, a placeholder at #6B7280
 * (4.83:1) rather than #D1D5DB, and left padding for the RM prefix. The
 * placeholder stays subordinate through weight, not through being unreadable.
 */
export const PRICE_INPUT_CLS = `w-full bg-white border-[1.5px] border-[#D1D5DB] rounded-xl pl-12 pr-4 py-3.5
  font-heading font-semibold text-[16px] text-[#111827]
  placeholder:text-[#6B7280] placeholder:font-normal
  focus:outline-none focus:border-[#3D472F] focus:ring-[3px] focus:ring-[#3D472F]/10
  transition-all`
