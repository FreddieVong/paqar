import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { scrubUrl, isSensitivePath, SENSITIVE_QUERY_KEYS } from '@/lib/sensitive-routes'
import { isSearchPage, classifyListingUrl } from '@/lib/listing-page-kind'

const ROOT = join(__dirname, '..', '..')

/** Every buyer-facing source file. Tests and comments are not shipped copy. */
function publicFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (!/\.(tsx?|txt)$/.test(entry)) continue
      // Buyer-facing copy only. Admin is behind ADMIN_SECRET and API routes
      // are not crawlable prose — a price named in a cron job's telemetry is
      // not an advertisement.
      if (full.includes(join('app', 'admin'))) continue
      if (full.includes(join('app', 'api'))) continue
      out.push({ path: full.slice(ROOT.length + 1), text: readFileSync(full, 'utf8') })
    }
  }
  for (const d of ['app', 'components', 'public']) walk(join(ROOT, d))
  return out
}

/** Strip // and /* *\/ comments — reasoning about a defect is not the defect. */
function visibleCopy(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('Paqar never advertises what it cannot deliver', () => {
  const files = publicFiles().map(f => ({ ...f, text: visibleCopy(f.text) }))

  it('sells no accident/claim add-on while HISTORY_UPGRADE_OPERATIONAL is false', () => {
    const operational = readFileSync(join(ROOT, 'lib/pricing.ts'), 'utf8')
      .includes('HISTORY_UPGRADE_OPERATIONAL = true')
    if (operational) return // the service shipped; this test stops applying

    const offenders = files
      // A PRODUCT price, not a road-tax band ("RM100-120 setahun") or a
      // repair estimate ("RM1000+"). Trailing digit or dash rules those out.
      .filter(f => /RM\s?(?:88|100|117)(?![\d\u2013\u2014-])/.test(f.text))
      // The dedicated information page may explain the service; it must not price it.
      .filter(f => !f.path.includes('semak-accident-claim-insurans-kereta'))
      // Gated render paths. These never reach a buyer or a crawler while
      // HISTORY_UPGRADE_OPERATIONAL is false: PaymentForm and selesai read the
      // gate directly, and JomCheckUpsell renders only from upsellJomCheck,
      // which the report page derives from historyUpgradeAvailable().
      .filter(f => ![
        'components/report/PaymentForm.tsx',
        'components/report/JomCheckUpsell.tsx',
        join('app', 'laporan-pembeli', '[checkId]', 'selesai', 'page.tsx'),
      ].includes(f.path))
      .map(f => f.path)
    expect(offenders, `these price an unavailable service: ${offenders.join(', ')}`).toEqual([])
  })

  it('quotes no RM12 report on any surface a buyer or crawler reaches', () => {
    // The REPORT price. "RM12-18k" and "RM12,000" are used-car prices and stay.
    //
    // The three verdict-era forms are excluded because they are mounted
    // NOWHERE — free-paid-boundary.test.ts pins that, walking the tree for a
    // JSX mount of each. Their RM12 copy cannot be seen or crawled. Deleting
    // them is the right end state and is deliberately not done here: six other
    // suites read them as fixtures for rules that still matter, and that
    // cleanup does not belong in a change about credential leaks.
    const RETIRED = [
      'components/check/OverpricedCheckerForm.tsx',
      'components/check/PlateCheckerForm.tsx',
      'components/check/HomeCheckerTabs.tsx',
    ]
    const bad = files
      .filter(f => !RETIRED.includes(f.path))
      .filter(f => /RM\s?12(?![\d\u2013\u2014\-.,k])/i.test(f.text))
      .map(f => f.path)
    expect(bad, `still quote RM12: ${bad.join(', ')}`).toEqual([])
  })

  it('advertises no free verdict anywhere public', () => {
    const bad = files.filter(f => /murah\/wajar\/mahal/i.test(f.text)).map(f => f.path)
    expect(bad, `advertise the free verdict: ${bad.join(', ')}`).toEqual([])
  })

  it('never promises an instant report — every report waits for a human', () => {
    const bad = files.filter(f =>
      /Tiada masa menunggu/i.test(f.text) ||
      /laporan[^.]{0,40}dijana serta-merta/i.test(f.text),
    ).map(f => f.path)
    expect(bad, `promise an instant report: ${bad.join(', ')}`).toEqual([])
  })

  it('never accuses a seller of winding back THIS car’s odometer', () => {
    // Educating buyers that clocking exists is the risk guide's job and stays.
    // What may never appear is Paqar asserting it happened to the car in hand,
    // because it holds no independent dated reading that could support it.
    const bad = files.filter(f =>
      /dipusing balik/i.test(f.text) ||
      /meter\s+(?:kereta\s+)?ini\s+(?:mungkin\s+)?(?:pernah\s+)?diputar/i.test(f.text),
    ).map(f => f.path)
    expect(bad, `claim tampering: ${bad.join(', ')}`).toEqual([])
  })

  it('never calls Paqar’s own variant data official', () => {
    const bad = files.filter(f => /[Ss]emakan varian rasmi/.test(f.text)).map(f => f.path)
    expect(bad, `call variant data rasmi: ${bad.join(', ')}`).toEqual([])
  })
})

describe('a credential never reaches a third party', () => {
  it('redacts every sensitive key, keeping the shape of the URL', () => {
    expect(scrubUrl('https://paqar.my/laporan-pembeli/abc?claim_token=SECRET'))
      .toBe('https://paqar.my/laporan-pembeli/abc?claim_token=redacted')
    expect(scrubUrl('/laporan-pembeli/abc?claim_token=SECRET&asking_price=55000'))
      .toBe('/laporan-pembeli/abc?claim_token=redacted&asking_price=55000')
  })

  it('covers every key it claims to cover', () => {
    for (const key of SENSITIVE_QUERY_KEYS) {
      const out = String(scrubUrl(`https://paqar.my/x?${key}=SECRET`))
      expect(out.includes('SECRET'), `${key} survived scrubbing`).toBe(false)
    }
  })

  it('leaves ordinary URLs untouched, so analytics stays useful', () => {
    const plain = 'https://paqar.my/harga-kereta-terpakai/myvi?utm_source=fb'
    expect(scrubUrl(plain)).toBe(plain)
  })

  it('drops rather than guesses when a sensitive URL cannot be parsed', () => {
    expect(scrubUrl('::::claim_token=SECRET')).toBeUndefined()
  })

  it('knows which routes carry a credential', () => {
    expect(isSensitivePath('/laporan-pembeli/abc')).toBe(true)
    expect(isSensitivePath('/laporan-pembeli/abc/selesai')).toBe(true)
    expect(isSensitivePath('/admin/review')).toBe(true)
    expect(isSensitivePath('/')).toBe(false)
    expect(isSensitivePath('/harga-kereta-terpakai/myvi')).toBe(false)
  })

  it('the Meta pixel is gated on that same list', () => {
    const src = readFileSync(join(ROOT, 'components/layout/MetaPixelScript.tsx'), 'utf8')
    expect(src).toContain('isSensitivePath')
  })

  it('PostHog sanitizes every URL property it fills in by itself', () => {
    const src = readFileSync(join(ROOT, 'lib/analytics.ts'), 'utf8')
    expect(src).toContain('sanitize_properties')
    expect(src).toContain('$current_url')
    expect(src).toContain('$referrer')
  })

  it('Google Ads does not send its own page view', () => {
    const src = readFileSync(join(ROOT, 'components/layout/GoogleTagScript.tsx'), 'utf8')
    expect(src).toMatch(/AW-\d+',\s*\{\s*send_page_view:\s*false/)
  })
})

describe('one car, not a page of cars', () => {
  it('accepts a real advert', () => {
    for (const url of [
      'https://www.mudah.my/honda-city-1-5-ivtec-v-spec-115552872.htm',
      'https://www.carlist.my/recon-cars/2023-lexus-rx-350-f-sport/18796998',
      'https://www.carlist.my/used-cars/2019-honda-city-1-5-v/12345678',
    ]) expect(isSearchPage(url), url).toBe(false)
  })

  it('refuses a results or category page', () => {
    for (const url of [
      'https://www.mudah.my/malaysia/cars-for-sale',
      'https://www.mudah.my/malaysia/cars-for-sale?q=honda+city+2019',
      'https://www.carlist.my/cars-for-sale/honda/city/2019',
      'https://www.mudah.my/selangor/cars-for-sale?o=2',
      'https://example-dealer.my/category/used-cars',
    ]) expect(isSearchPage(url), url).toBe(true)
  })

  it('a listing id at the end outranks a category word earlier in the path', () => {
    // Carlist files real adverts UNDER /recon-cars/ and /used-cars/.
    expect(classifyListingUrl('https://www.carlist.my/recon-cars/2023-lexus-rx/18796998'))
      .toBe('listing')
  })

  it('treats an unclassifiable link as a listing rather than refusing a real buyer', () => {
    expect(isSearchPage('https://www.facebook.com/marketplace/item/1234567890123')).toBe(false)
    expect(isSearchPage('not a url')).toBe(false)
  })

  it('reads a page full of listing cards as a search page', () => {
    const many = Array.from({ length: 12 }, (_, i) => `<a href="/honda-city-${1155528 + i}0.htm">x</a>`).join('')
    expect(isSearchPage('https://dealer.example/anything', many)).toBe(true)
    const one = '<a href="/honda-city-11555280.htm">this car</a>'
    expect(isSearchPage('https://dealer.example/anything', one)).toBe(false)
  })
})
