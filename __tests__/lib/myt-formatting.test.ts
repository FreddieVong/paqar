// @vitest-environment node
import { describe, it, expect } from 'vitest'

/**
 * Vercel runs in UTC. Any date shown to a Malaysian customer must name an
 * explicit timeZone, or anything between 00:00 and 08:00 MYT renders as the
 * previous day.
 */
describe('MYT date formatting under a UTC server', () => {
  const format = (iso: string, withZone: boolean) =>
    new Date(iso).toLocaleDateString('ms-MY', {
      day: 'numeric', month: 'long', year: 'numeric',
      ...(withZone ? { timeZone: 'Asia/Kuala_Lumpur' } : {}),
    })

  const earlyMorningMyt = '2026-07-26T17:30:00Z' // 01:30 on 27 July in MYT

  it('demonstrates the bug: no timeZone gives the previous day', () => {
    const naive = new Date(earlyMorningMyt).toLocaleDateString('ms-MY', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })
    expect(naive).toContain('26')
  })

  it('an explicit timeZone gives the correct Malaysian date', () => {
    expect(format(earlyMorningMyt, true)).toContain('27')
  })

  it('is unchanged for times that do not cross the boundary', () => {
    // 23:20 MYT on 26 July — same date either way.
    expect(format('2026-07-26T15:20:43Z', true)).toContain('26')
  })

  it('handles the exact 08:00 MYT boundary', () => {
    expect(format('2026-07-26T16:00:00Z', true)).toContain('27') // 00:00 MYT
    expect(format('2026-07-26T15:59:59Z', true)).toContain('26') // 23:59 MYT
  })
})
