/**
 * Minimal in-memory stand-in for the Supabase client, supporting exactly the
 * operations lib/db/ad-attribution.ts uses.
 *
 * It models the two behaviours the attribution guarantees depend on:
 *   - upsert(..., { ignoreDuplicates: true }) returns NO rows on conflict,
 *     which is how recordAdEvent distinguishes inserted from duplicate;
 *   - .is(col, null) matches only rows where the column is still null, which
 *     is what stops a late fbc/fbp from overwriting first touch.
 */

type Row = Record<string, unknown>

interface Filter {
  kind: 'eq' | 'is' | 'gte' | 'gt' | 'in' | 'notNull'
  column: string
  value: unknown
}

export class FakeSupabase {
  tables = new Map<string, Row[]>()
  /** Set to force the next request to fail, for error-path tests. */
  failNext: string | null = null
  /**
   * Narrow `failNext` to one kind of request.
   *
   * Null means "whichever request reaches this table first", which is what
   * every caller meant while each function under test touched a given table
   * exactly once. recordPurchase now READS ad_events — to inherit the journey
   * path recorded at checkout — before it writes to ad_events, so a test that
   * means "the write failed" has to say so, or it silently exercises the read.
   */
  failNextOp: 'select' | 'upsert' | 'update' | null = null

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, [])
    return this.tables.get(table)!
  }

  from(table: string) {
    const self = this
    const filters: Filter[] = []
    let operation: 'select' | 'upsert' | 'update' = 'select'
    let payload: Row | null = null
    let conflictKeys: string[] = []
    let ignoreDuplicates = false
    let selected = false
    let countMode = false
    let orderBy: { column: string; ascending: boolean } | null = null
    let limitTo: number | null = null

    const matches = (row: Row): boolean =>
      filters.every((f) => {
        if (f.kind === 'eq')  return row[f.column] === f.value
        if (f.kind === 'is')  return row[f.column] == null
        if (f.kind === 'gte') return String(row[f.column]) >= String(f.value)
        // Timestamps are compared as ISO strings, which sort lexicographically
        // in the same order as chronologically — the same thing PostgREST does
        // with a timestamptz column.
        if (f.kind === 'gt')  return String(row[f.column]) > String(f.value)
        if (f.kind === 'in')  return (f.value as unknown[]).includes(row[f.column])
        // `.not(col, 'is', null)`: SQL three-valued logic means a missing key
        // and an explicit null are both "is null", so both fail this.
        if (f.kind === 'notNull') return row[f.column] != null
        return true
      })

    const run = (): { data: Row[] | null; error: { message: string } | null; count?: number } => {
      if (self.failNext === table && (self.failNextOp == null || self.failNextOp === operation)) {
        self.failNext = null
        self.failNextOp = null
        return { data: null, error: { message: `simulated failure on ${table}` } }
      }

      const store = self.rows(table)

      if (operation === 'upsert' && payload) {
        const conflict = conflictKeys.length > 0 &&
          store.some((r) => conflictKeys.every((k) => r[k] === payload![k]))

        if (conflict) {
          // ignoreDuplicates: the row is skipped and NOTHING is returned.
          return { data: selected ? [] : null, error: null }
        }
        const inserted = { id: `row_${store.length + 1}`, ...payload }
        store.push(inserted)
        return { data: selected ? [inserted] : null, error: null }
      }

      if (operation === 'update' && payload) {
        const updated: Row[] = []
        for (const row of store) {
          if (!matches(row)) continue
          Object.assign(row, payload)
          updated.push(row)
        }
        return { data: selected ? updated : null, error: null }
      }

      let found = store.filter(matches)
      if (countMode) return { data: null, error: null, count: found.length }

      if (orderBy) {
        const { column, ascending } = orderBy
        found = [...found].sort((a, b) => {
          const av = a[column], bv = b[column]
          if (av === bv) return 0
          // Nulls sort last in both directions, as PostgREST defaults to.
          if (av == null) return 1
          if (bv == null) return -1
          const cmp = String(av) < String(bv) ? -1 : 1
          return ascending ? cmp : -cmp
        })
      }
      if (limitTo != null) found = found.slice(0, limitTo)

      return { data: found, error: null }
    }

    const builder = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        selected = true
        if (opts?.count) countMode = true
        return builder
      },
      upsert(row: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        operation = 'upsert'
        payload = row
        conflictKeys = opts?.onConflict ? opts.onConflict.split(',').map((s) => s.trim()) : []
        ignoreDuplicates = opts?.ignoreDuplicates ?? false
        void ignoreDuplicates
        return builder
      },
      insert(row: Row) {
        operation = 'upsert'
        payload = row
        conflictKeys = []
        return builder
      },
      update(row: Row) {
        operation = 'update'
        payload = row
        return builder
      },
      eq(column: string, value: unknown)  { filters.push({ kind: 'eq', column, value }); return builder },
      in(column: string, value: unknown[]) { filters.push({ kind: 'in', column, value }); return builder },
      is(column: string, value: unknown)  { filters.push({ kind: 'is', column, value }); return builder },
      gte(column: string, value: unknown) { filters.push({ kind: 'gte', column, value }); return builder },
      gt(column: string, value: unknown)  { filters.push({ kind: 'gt', column, value }); return builder },
      not(column: string, op: string, value: unknown) {
        // Only `.not(col, 'is', null)` is modelled — the single form the code
        // uses. Anything else must fail loudly rather than silently match all.
        if (op !== 'is' || value !== null) {
          throw new Error(`FakeSupabase: unsupported .not(${column}, ${op}, ${String(value)})`)
        }
        filters.push({ kind: 'notNull', column, value: null })
        return builder
      },
      // Modelled, not stubbed. These were no-ops, which made every
      // "newest row wins" query indistinguishable from "first row inserted" —
      // and that is precisely the shape of the bug where a newer PENDING
      // buyer_report hid an older PAID one from the report page.
      order(column: string, opts?: { ascending?: boolean }) {
        orderBy = { column, ascending: opts?.ascending ?? true }
        return builder
      },
      limit(n: number) { limitTo = n; return builder },
      async maybeSingle() {
        const res = run()
        return { data: res.data?.[0] ?? null, error: res.error }
      },
      // PostgREST's .single() differs from .maybeSingle(): no row is the error
      // PGRST116, which callers check for by code rather than treating as a
      // failure. Modelling that distinction matters — lib/db code branches on it.
      async single() {
        const res = run()
        const row = res.data?.[0] ?? null
        if (!res.error && !row) return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
        return { data: row, error: res.error }
      },
      then(resolve: (v: ReturnType<typeof run>) => unknown) {
        return Promise.resolve(run()).then(resolve)
      },
    }

    return builder
  }
}

export function installFakeSupabase(): FakeSupabase {
  return new FakeSupabase()
}
