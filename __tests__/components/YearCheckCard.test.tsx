// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { YearCheckCard } from '@/components/report/YearCheckCard'

afterEach(cleanup)

/**
 * The card the 12 Sep buyer needed and did not get.
 *
 * Their advert said 2020; JPJ said registered 2019. The report priced the
 * car as a 2019, headed itself "Proton Exora 2020", wrote "Exora 2019" into
 * the negotiation script, and never once said the two disagreed. A seller
 * advertising a 2019 as a 2020 is worth about a year of depreciation — and
 * it is the first thing the buyer should ask about.
 */
describe('YearCheckCard', () => {
  it('renders nothing when the years agree', () => {
    const { container } = render(<YearCheckCard adYear="2019" registrationYear="2019" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when either year is unknown', () => {
    expect(render(<YearCheckCard adYear={null} registrationYear="2019" />).container.innerHTML).toBe('')
    cleanup()
    expect(render(<YearCheckCard adYear="2020" registrationYear={undefined} />).container.innerHTML).toBe('')
  })

  it('names both years plainly and says which one the report uses', () => {
    render(<YearCheckCard adYear="2020" registrationYear="2019" />)
    expect(screen.getByText('Semakan Tahun')).toBeTruthy()
    expect(screen.getByText(/Iklan kata 2020/)).toBeTruthy()
    expect(screen.getByText(/didaftar 2019/)).toBeTruthy()
    expect(screen.getByText(/Laporan ini guna 2019/)).toBeTruthy()
  })

  it('tells the buyer what to do, in the house words', () => {
    render(<YearCheckCard adYear="2020" registrationYear="2019" />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/Tanya seller/)
    expect(text).toMatch(/jangan bayar harga 2020/)
    expect(text).not.toMatch(/penjual/i)
    expect(text).not.toMatch(/tipu|scam|penipu/i)
  })

  it('handles the other direction too — an advert that understates the year', () => {
    render(<YearCheckCard adYear="2018" registrationYear="2019" />)
    expect(screen.getByText(/Iklan kata 2018/)).toBeTruthy()
    expect(screen.getByText(/didaftar 2019/)).toBeTruthy()
  })
})

describe('wiring', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('the report page passes the advert year through, and the content mounts the card', () => {
    const page = strip(readFileSync('app/laporan-pembeli/[checkId]/page.tsx', 'utf8'))
    expect(page).toMatch(/adYear=\{row\.check\.year/)
    const content = strip(readFileSync('components/report/BuyerReportContent.tsx', 'utf8'))
    expect(content).toContain('<YearCheckCard')
    // Before the price comparison: the mismatch changes how the figures read.
    expect(content.indexOf('<YearCheckCard')).toBeLessThan(content.indexOf('Perbandingan Harga'))
  })

  it('the headline year is the one the report is priced on, not the advert\'s', () => {
    const page = strip(readFileSync('app/laporan-pembeli/[checkId]/page.tsx', 'utf8'))
    const label = page.slice(page.indexOf('const reviewedLabel = correctedCarLabel('), page.indexOf('})', page.indexOf('const reviewedLabel')))
    expect(label).toContain('identity?.year ?? row.check.year')
    expect(page.indexOf('const identity = resolveCarIdentity')).toBeLessThan(page.indexOf('const reviewedLabel'))
  })
})

describe('the seller questions carry the year gap', () => {
  it('adds the question, right after the generic five, only when the years disagree', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const content = strip(readFileSync('components/report/BuyerReportContent.tsx', 'utf8'))
    const block = content.slice(content.indexOf("'Ada accident besar sebelum ini?'"), content.indexOf('].slice(0, 7)'))
    expect(block).toMatch(/adYear && vehicleData\?\.registrationYear && adYear !== vehicleData\.registrationYear/)
    expect(block).toMatch(/Iklan tulis \$\{adYear\} tapi geran \$\{vehicleData\.registrationYear\} — kenapa\?/)
  })
})
