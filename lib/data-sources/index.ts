import type { Country, DataSourceAdapter, SourceResult } from './types'

import { PdrmStub }          from './stubs/pdrm'
import { JpjStub }           from './stubs/jpj'
import { AesStub }           from './stubs/aes'
import { LocalCouncilsStub } from './stubs/local-councils'

import { PdrmAdapter }          from './real/pdrm'
import { JpjAdapter }           from './real/jpj'
import { AesAdapter }           from './real/aes'
import { LocalCouncilsAdapter } from './real/local-councils'

function getStubAdapters(): DataSourceAdapter[] {
  return [
    new PdrmStub(),
    new JpjStub(),
    new AesStub(),
    new LocalCouncilsStub(),
  ]
}

function getRealAdapters(_country: Country): DataSourceAdapter[] {
  return [
    new PdrmAdapter(),
    new JpjAdapter(),
    new AesAdapter(),
    new LocalCouncilsAdapter(),
  ]
}

/**
 * Returns the full set of adapters for the given country.
 */
export function getAdapters(country: Country = 'MY'): DataSourceAdapter[] {
  const mode = process.env.DATA_SOURCE_MODE ?? 'stub'
  if (mode === 'real') return getRealAdapters(country)
  return getStubAdapters()
}

/**
 * Wraps an adapter so check() resolves within `ms` milliseconds
 * or returns { status: 'timeout' }.
 */
export function withTimeout(
  adapter: DataSourceAdapter,
  ms = 10_000
): DataSourceAdapter {
  return {
    sourceId: adapter.sourceId,
    label:    adapter.label,
    async check(plate: string, ic: string): Promise<SourceResult> {
      const timeoutResult: SourceResult = {
        source:       adapter.sourceId,
        status:       'timeout',
        label:        adapter.label,
        data:         null,
        errorMessage: `Timed out after ${ms}ms`,
        checkedAt:    new Date(),
      }

      let timerId: ReturnType<typeof setTimeout>

      return Promise.race([
        adapter.check(plate, ic).finally(() => clearTimeout(timerId)),
        new Promise<SourceResult>((resolve) => {
          timerId = setTimeout(() => resolve(timeoutResult), ms)
        }),
      ])
    },
  }
}
