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

interface Filter { kind: 'eq' | 'is' | 'gte'; column: string; value: unknown }

export class FakeSupabase {
  tables = new Map<string, Row[]>()
  /** Set to force the next request to fail, for error-path tests. */
  failNext: string | null = null

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

    const matches = (row: Row): boolean =>
      filters.every((f) => {
        if (f.kind === 'eq')  return row[f.column] === f.value
        if (f.kind === 'is')  return row[f.column] == null
        if (f.kind === 'gte') return String(row[f.column]) >= String(f.value)
        return true
      })

    const run = (): { data: Row[] | null; error: { message: string } | null; count?: number } => {
      if (self.failNext === table) {
        self.failNext = null
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

      const found = store.filter(matches)
      if (countMode) return { data: null, error: null, count: found.length }
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
      is(column: string, value: unknown)  { filters.push({ kind: 'is', column, value }); return builder },
      gte(column: string, value: unknown) { filters.push({ kind: 'gte', column, value }); return builder },
      order() { return builder },
      limit() { return builder },
      async maybeSingle() {
        const res = run()
        return { data: res.data?.[0] ?? null, error: res.error }
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
