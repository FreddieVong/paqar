import type { SamanResult } from '../types.js'

// AES (Automated Enforcement System) — www.aes.gov.my is no longer accessible.
// AES summons have been merged into the PDRM/JPJ enforcement system.
// AES records will appear in PDRM and JPJ checks via mybayar.rmp.gov.my / myjpj.jpj.gov.my.
export async function scrapeAes(_plate: string): Promise<SamanResult> {
  return {
    status: 'unavailable',
    error:  'AES portal (www.aes.gov.my) no longer accessible — AES summons are now part of PDRM/JPJ system',
  }
}
