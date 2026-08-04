import { describe, it, expect } from 'vitest'
import { modelYearBreadcrumbs, buildBreadcrumbList } from '@/lib/breadcrumbs'
import { MODEL_HUB_SLUGS } from '@/lib/model-hubs'

type ListItem = { '@type': string; position: number; name: string; item: string }

const items = (b: ReturnType<typeof modelYearBreadcrumbs>) => b.itemListElement as ListItem[]

describe('modelYearBreadcrumbs', () => {
  it('includes the model hub when one exists, numbered 1..4', () => {
    const crumbs = items(modelYearBreadcrumbs({
      displayModel: 'Honda HR-V', year: 2022, slug: 'hr-v-2022', hubSlug: 'honda-hrv',
    }))
    expect(crumbs.map(c => c.position)).toEqual([1, 2, 3, 4])
    expect(crumbs[2]!.item).toBe('https://paqar.my/harga-kereta-terpakai/honda-hrv')
    expect(crumbs[3]!.item).toBe('https://paqar.my/harga-hr-v-2022')
  })

  it('uses honda-hrv for HR-V, never the derived honda-hr-v', () => {
    // The old code built this slug from `${make}-${model}`.toLowerCase(),
    // producing 'honda-hr-v' — a route that calls notFound().
    const crumbs = items(modelYearBreadcrumbs({
      displayModel: 'Honda HR-V', year: 2022, slug: 'hr-v-2022', hubSlug: 'honda-hrv',
    }))
    const urls = crumbs.map(c => c.item)
    expect(urls).toContain('https://paqar.my/harga-kereta-terpakai/honda-hrv')
    expect(urls).not.toContain('https://paqar.my/harga-kereta-terpakai/honda-hr-v')
  })

  it('stays contiguous at 1..3 when the model has no hub', () => {
    for (const [displayModel, slug] of [
      ['Honda Civic',   'civic-2021'],
      ['Proton Persona', 'persona-2020'],
      ['Toyota Yaris',  'yaris-2023'],
    ] as const) {
      const crumbs = items(modelYearBreadcrumbs({ displayModel, year: 2021, slug }))
      expect(crumbs.map(c => c.position)).toEqual([1, 2, 3])
      // The year page is promoted into the slot the hub would have taken.
      expect(crumbs[2]!.item).toBe(`https://paqar.my/harga-${slug}`)
    }
  })

  it('emits no hub URL at all for models without a hub', () => {
    for (const [displayModel, slug, invented] of [
      ['Honda Civic',    'civic-2021',   'honda-civic'],
      ['Proton Persona', 'persona-2020', 'proton-persona'],
      ['Toyota Yaris',   'yaris-2023',   'toyota-yaris'],
    ] as const) {
      const crumbs = items(modelYearBreadcrumbs({ displayModel, year: 2021, slug }))
      const urls = crumbs.map(c => c.item)
      // The model index (no trailing segment) stays; no hub URL is emitted.
      expect(urls).toContain('https://paqar.my/harga-kereta-terpakai')
      expect(urls).not.toContain(`https://paqar.my/harga-kereta-terpakai/${invented}`)
      expect(urls.filter(u => u.startsWith('https://paqar.my/harga-kereta-terpakai/'))).toEqual([])
    }
  })

  it('only ever links hub URLs that exist in the allowlist', () => {
    for (const hubSlug of MODEL_HUB_SLUGS) {
      const crumbs = items(modelYearBreadcrumbs({
        displayModel: 'X', year: 2022, slug: 'x-2022', hubSlug,
      }))
      const hubItem = crumbs.find(c => c.item.startsWith('https://paqar.my/harga-kereta-terpakai/'))!
      const slug = hubItem.item.split('/harga-kereta-terpakai/')[1]
      expect(MODEL_HUB_SLUGS).toContain(slug)
    }
  })
})

describe('buildBreadcrumbList', () => {
  it('numbers after filtering, so positions never skip', () => {
    const b = buildBreadcrumbList([
      { name: 'A', item: 'https://a' },
      null,
      false,
      undefined,
      { name: 'B', item: 'https://b' },
    ])
    expect((b.itemListElement as ListItem[]).map(i => i.position)).toEqual([1, 2])
  })

  it('is a valid BreadcrumbList shape', () => {
    const b = buildBreadcrumbList([{ name: 'A', item: 'https://a' }])
    expect(b['@type']).toBe('BreadcrumbList')
    expect((b.itemListElement as ListItem[])[0]!['@type']).toBe('ListItem')
  })
})
