import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rejectionCopyFor, UPLOAD_REJECTION_COPY } from '@/lib/image-validation'

const ROOT = join(__dirname, '..', '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * A reviewer reproduced "Muat naik terputus" on a fresh Chrome session with a
 * valid PNG and a valid JPEG. Driving the same journey headless against
 * production — a 139KB PNG, a 1.27MB PNG through the canvas compression path,
 * and a JPEG whose text OCR read correctly — succeeded three times in a row.
 *
 * So the failure is real and manual testing cannot see it. These assertions
 * pin the instruments, because an instrument nobody checks gets deleted as
 * dead code by the next person reading the file.
 */
describe('a failed upload leaves evidence', () => {
  const client = code(read('components/check/ScreenshotUpload.tsx'))
  const route  = code(read('app/api/listing-screenshots/route.ts'))

  it('every attempt carries an id the server echoes back into its logs', () => {
    expect(client).toContain('x-paqar-upload-attempt')
    expect(route).toContain('x-paqar-upload-attempt')
    // Success is the control group: without it, "it failed" cannot be told
    // apart from "it worked and the response was lost".
    expect(route).toContain('[upload-stored]')
    expect(route).toContain('[upload-rejected]')
  })

  it('the buyer is given a reference they can quote', () => {
    expect(client).toMatch(/Ruj: \$\{ref\}/)
  })

  it('a hung request fails instead of spinning forever', () => {
    expect(client).toContain('AbortSignal.timeout(UPLOAD_TIMEOUT_MS)')
  })

  it('the failure report goes to our own origin, not to an analytics vendor', () => {
    // The leading hypothesis is an extension blocking the POST. Anything
    // aggressive enough to do that blocks PostHog first, so client analytics
    // is the one instrument guaranteed to be blind to this exact failure.
    expect(client).toContain("'/api/listing-screenshots/diagnostic'")
    expect(client).toContain('keepalive: true')
  })

  it('and carries nothing that identifies a person or a car', () => {
    const body = client.slice(client.indexOf('attemptId: attempt.id'), client.indexOf('attemptId: attempt.id') + 400)
    for (const forbidden of ['file.name', 'fileName', 'plate', 'listingUrl', 'email']) {
      expect(body, `${forbidden} must not travel on a diagnostic`).not.toContain(forbidden)
    }
  })

  it('the diagnostic route cannot be used to probe which intakes exist', () => {
    const diag = code(read('app/api/listing-screenshots/diagnostic/route.ts'))
    // Unauthorised reports are dropped with the SAME 204 as accepted ones.
    expect(diag).toMatch(/if \(!intake\) return new NextResponse\(null, \{ status: 204 \}\)/)
  })
})

/**
 * "Muat naik terputus. Cuba lagi" was the answer to every throw. For the most
 * likely cause that advice is actively wrong: if an extension is blocking the
 * request, trying again does the same thing forever.
 */
describe('the error says what actually happened', () => {
  const client = code(read('components/check/ScreenshotUpload.tsx'))

  it('tells a blocked request apart from a dropped one', () => {
    expect(client).toMatch(/name === 'TypeError'/)
    expect(client).toContain('extension penyekat iklan atau privasi')
  })

  it('tells a timeout apart from both', () => {
    expect(client).toMatch(/name === 'AbortError' \|\| e\?\.name === 'TimeoutError'/)
  })

  it('still handles being offline', () => {
    expect(client).toContain('Tiada sambungan internet')
  })
})

describe('a rejected image says which fixable mistake it was', () => {
  it('names HEIC, because the picture is fine and the container is not', () => {
    const copy = rejectionCopyFor('unsupported_format')
    expect(copy).toMatch(/HEIC/)
    expect(copy).not.toBe(UPLOAD_REJECTION_COPY)
  })

  it('tells a photo-of-a-screen apart from a screenshot', () => {
    expect(rejectionCopyFor('too_large')).toMatch(/screenshot/)
    expect(rejectionCopyFor('too_large')).not.toBe(UPLOAD_REJECTION_COPY)
  })

  it('tells a crop apart from a full screen', () => {
    expect(rejectionCopyFor('too_small')).toMatch(/terlalu kecil/)
  })

  it('keeps ONE message for reasons that describe our parser, not their file', () => {
    // These name our threat model and our decoder. Neither helps someone
    // holding a phone, and spelling them out invites working around them.
    for (const r of ['markup_detected', 'dimensions_unreadable', 'empty', 'storage_failed'] as const) {
      expect(rejectionCopyFor(r)).toBe(UPLOAD_REJECTION_COPY)
    }
  })
})
