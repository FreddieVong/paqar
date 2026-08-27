import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sendEmail } from '@/lib/email/send'
import type { Resend } from 'resend'

const ROOT = join(__dirname, '..', '..')
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * The Resend SDK does NOT throw on an API error — `emails.send()` resolves
 * with `{ data: null, error: {...} }`. Ten of the eleven senders in lib/email
 * awaited that and treated a refusal as a success.
 *
 * The callers were built assuming a failure throws: release notifications go
 * through notifyInBackground, whose entire job is
 * `work.catch(err => console.error(...))`. A promise that resolves on failure
 * gives that catch nothing, so the reviewer sees a clean release, the buyer
 * gets no email, and nothing appears in any log.
 *
 * Which is the same shape as the bug that hid the ORIGINAL missing-email
 * defect. That one needed a real released report and an empty inbox to find.
 */
describe('a refused send is a failed send', () => {
  const fake = (result: unknown) =>
    ({ emails: { send: vi.fn().mockResolvedValue(result) } } as unknown as Resend)

  it('throws when Resend returns an error', async () => {
    const r = fake({ data: null, error: { name: 'validation_error', message: 'domain not verified' } })
    await expect(sendEmail(r, 'report-ready', { from: 'a@b.c', to: 'd@e.f', subject: 's', html: 'h' }))
      .rejects.toThrow(/report-ready.*domain not verified/)
  })

  it('returns the message id when it succeeds', async () => {
    const r = fake({ data: { id: 'msg_123' }, error: null })
    await expect(sendEmail(r, 'receipt', { from: 'a@b.c', to: 'd@e.f', subject: 's', html: 'h' }))
      .resolves.toBe('msg_123')
  })

  it('never puts the recipient in the error, which lands in a shared log', async () => {
    const r = fake({ data: null, error: { name: 'x', message: 'nope' } })
    const err = await sendEmail(r, 'receipt', {
      from: 'a@b.c', to: 'buyer@example.com', subject: 's', html: 'h',
    }).then(() => null, (e: unknown) => e as Error)
    expect(err).toBeInstanceOf(Error)
    expect(err!.message).not.toContain('buyer@example.com')
  })
})

describe('no sender bypasses the check', () => {
  const senders = readdirSync(join(ROOT, 'lib', 'email'))
    .filter(f => f.endsWith('.ts') && f !== 'send.ts')

  it('every sender that mails goes through sendEmail', () => {
    const offenders: string[] = []
    for (const f of senders) {
      const src = code(readFileSync(join(ROOT, 'lib', 'email', f), 'utf8'))
      if (!/resend\.emails\.send\(/.test(src)) continue
      // customer-feedback deliberately returns a RESULT rather than throwing —
      // it is called from a bulk path that reports per-recipient outcomes —
      // and it does inspect res.error, which is the property that matters.
      if (f === 'customer-feedback.ts') {
        expect(src, 'customer-feedback stopped checking res.error').toMatch(/res\.error/)
        continue
      }
      offenders.push(f)
    }
    expect(offenders, `bypassing sendEmail: ${offenders.join(', ')}`).toEqual([])
  })
})
