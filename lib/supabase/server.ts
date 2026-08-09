import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Session-aware server client. Reads auth session from cookies. */
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie mutation is a no-op
          }
        },
      },
    }
  )
}

/**
 * Service-role client for PUBLIC page reads that are meant to be cached.
 *
 * createServiceClient below forces `cache: 'no-store'` so a per-request read
 * can never be served stale. That guarantee is wrong for the ISR price pages:
 * a no-store fetch makes a route impossible to prerender, so every model hub
 * built with an empty price table and rendered its "sedang dikemaskini"
 * fallback — the data was never stale, it was never fetched.
 *
 * Safe here specifically because market_price_cache is itself a cache with its
 * own 7-day TTL and a daily refresh; layering an hour of Data Cache on top
 * changes nothing a visitor can perceive. Do NOT reach for this for reads tied
 * to one buyer (checks, reports, auth) — those need the no-store client.
 */
export function createCachedServiceClient(revalidateSeconds: number) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) => {
          // `cache` and `next.revalidate` are mutually exclusive — supabase-js
          // sets its own `cache`, so drop it rather than let Next reject both.
          const { cache: _drop, ...rest } = init ?? {}
          return fetch(url, { ...rest, next: { revalidate: revalidateSeconds } })
        },
      },
    }
  )
}

/** Service-role client. Bypasses RLS. Use only in API routes. */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: {
        // Next.js patches global fetch with a Data Cache that can persist
        // across deployments; DB reads must never be served from it
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}
