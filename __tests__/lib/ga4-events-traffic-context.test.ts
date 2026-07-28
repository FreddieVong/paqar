// Unit tests for GA4 traffic context classification
import { describe, it, expect } from 'vitest'
import { getTrafficContext } from '@/lib/ga4-events'

interface TestCase {
  name: string
  params: Record<string, string>
  expected: string
}

const testCases: TestCase[] = [
  // Google CPC signals
  { name: 'gclid as paid', params: { gclid: 'abc123' }, expected: 'paid' },
  { name: 'gbraid as paid', params: { gbraid: 'abc123' }, expected: 'paid' },
  { name: 'wbraid as paid', params: { wbraid: 'abc123' }, expected: 'paid' },
  { name: 'gclid overrides utm_medium=social', params: { gclid: 'abc123', utm_medium: 'social' }, expected: 'paid' },

  // Paid traffic (via utm_medium)
  { name: 'utm_medium=cpc as paid', params: { utm_medium: 'cpc' }, expected: 'paid' },
  { name: 'utm_medium=ppc as paid', params: { utm_medium: 'ppc' }, expected: 'paid' },
  { name: 'utm_medium=paid as paid', params: { utm_medium: 'paid' }, expected: 'paid' },
  { name: 'utm_medium=paid_social as paid', params: { utm_medium: 'paid_social' }, expected: 'paid' },
  { name: 'utm_medium=display as paid', params: { utm_medium: 'display' }, expected: 'paid' },
  { name: 'utm_medium=cpm as paid', params: { utm_medium: 'cpm' }, expected: 'paid' },
  { name: 'utm_medium=retargeting as paid', params: { utm_medium: 'retargeting' }, expected: 'paid' },

  // Organic social (via utm_medium)
  { name: 'utm_medium=social as organic_social', params: { utm_medium: 'social' }, expected: 'organic_social' },
  { name: 'utm_medium=organic_social', params: { utm_medium: 'organic_social' }, expected: 'organic_social' },
  {
    name: 'Facebook organic social (utm_medium=social, utm_source=facebook)',
    params: { utm_medium: 'social', utm_source: 'facebook' },
    expected: 'organic_social',
  },
  {
    name: 'Facebook paid social (utm_medium=paid_social)',
    params: { utm_medium: 'paid_social', utm_source: 'facebook' },
    expected: 'paid',
  },

  // Email traffic
  { name: 'utm_medium=email', params: { utm_medium: 'email' }, expected: 'email' },
  {
    name: 'blogger email (utm_medium=email, utm_source=blogger)',
    params: { utm_medium: 'email', utm_source: 'blogger' },
    expected: 'email',
  },

  // Referral traffic
  { name: 'utm_medium=referral', params: { utm_medium: 'referral' }, expected: 'referral' },

  // Organic search
  { name: 'utm_medium=organic', params: { utm_medium: 'organic' }, expected: 'organic' },

  // Direct traffic
  { name: 'no UTM parameters', params: {}, expected: 'direct' },

  // Other/unknown
  { name: 'unknown utm_medium', params: { utm_medium: 'xyz' }, expected: 'other' },
  { name: 'utm_source without utm_medium', params: { utm_source: 'google' }, expected: 'other' },

  // Case insensitivity
  { name: 'uppercase CPC', params: { utm_medium: 'CPC' }, expected: 'paid' },
  { name: 'mixed case PaId_SoCiAl', params: { utm_medium: 'PaId_SoCiAl' }, expected: 'paid' },

  // Full parameter sets
  {
    name: 'full Google CPC UTM set',
    params: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'search', utm_content: 'test', utm_term: 'car' },
    expected: 'paid',
  },
]

// The assertions below were originally driven by a hand-rolled runner that
// ended in process.exit(), which vitest treats as the suite crashing — so this
// file reported as FAILED on every run regardless of whether the assertions
// passed. A suite with a permanently-red file is one people stop reading, so
// the cases are unchanged and only the harness has been replaced.
describe('getTrafficContext', () => {
  it.each(testCases)('$name', ({ params, expected }) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, value)
    })
    expect(getTrafficContext(searchParams)).toBe(expected)
  })
})
