interface RateLimitConfig {
  maxRequests: number
  windowMs: number // milliseconds
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
}

/**
 * In-memory rate limiter for API endpoints.
 * Tracks requests per IP address within a sliding window.
 * For distributed systems, upgrade to Redis-based implementation later.
 */
export class RateLimiter {
  private maxRequests: number
  private windowMs: number
  private requests: Map<string, number[]> = new Map() // IP → array of request timestamps

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  checkLimit(ip: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs

    // Get requests for this IP, filter out old ones outside the window
    let requestTimestamps = this.requests.get(ip) || []
    requestTimestamps = requestTimestamps.filter(ts => ts > windowStart)

    const allowed = requestTimestamps.length < this.maxRequests

    if (allowed) {
      requestTimestamps.push(now)
    }

    const remaining = Math.max(0, this.maxRequests - requestTimestamps.length)
    this.requests.set(ip, requestTimestamps)

    // Calculate reset time (when oldest request falls out of window)
    const resetTime = requestTimestamps.length > 0
      ? new Date(requestTimestamps[0]! + this.windowMs)
      : new Date(now + this.windowMs)

    return { allowed, remaining, resetTime }
  }

  // Optional: cleanup old entries to prevent memory leak in long-running processes
  cleanup() {
    const now = Date.now()
    for (const [ip, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(ts => ts > now - this.windowMs)
      if (filtered.length === 0) {
        this.requests.delete(ip)
      } else {
        this.requests.set(ip, filtered)
      }
    }
  }
}

// Global singleton instance (10 req/min = 10 req/60_000ms)
export const apiRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
})

// Periodic cleanup: remove expired entries every 5 minutes
setInterval(() => apiRateLimiter.cleanup(), 5 * 60 * 1000)
