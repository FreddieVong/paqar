import { RateLimiter } from '@/lib/api/rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 })
  })

  it('allows requests under limit', () => {
    const result = limiter.checkLimit('192.168.1.1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('blocks requests over limit', () => {
    const ip = '192.168.1.2'
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip)
    }
    const result = limiter.checkLimit(ip)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets counter after window expires', async () => {
    const limiter2 = new RateLimiter({ maxRequests: 2, windowMs: 100 })
    const ip = '192.168.1.3'

    limiter2.checkLimit(ip)
    limiter2.checkLimit(ip)
    expect(limiter2.checkLimit(ip).allowed).toBe(false)

    await new Promise(r => setTimeout(r, 150))
    expect(limiter2.checkLimit(ip).allowed).toBe(true)
    expect(limiter2.checkLimit(ip).remaining).toBe(0)
  })

  it('tracks multiple IPs independently', () => {
    limiter.checkLimit('192.168.1.1')
    limiter.checkLimit('192.168.1.2')
    expect(limiter.checkLimit('192.168.1.1').remaining).toBe(8)
    expect(limiter.checkLimit('192.168.1.2').remaining).toBe(8)
  })
})
