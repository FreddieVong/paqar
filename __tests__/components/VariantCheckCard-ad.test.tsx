// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VariantCheckCard } from '@/components/report/VariantCheckCard'

afterEach(cleanup)

/**
 * The buyer's variant card knew the record and told the buyer to compare
 * it with the advert themselves. We know what the advert says — the intake
 * read it — so the card now does the comparison and says the result.
 */
describe('VariantCheckCard with the advert\'s variant', () => {
  const base = { make: 'PROTON', model: 'EXORA', officialVariant: 'EXORA PREMIUM', description: 'PROTON EXORA PREMIUM', registrationYear: '2019' }

  it('says the advert matches the record when it does', () => {
    render(<VariantCheckCard {...base} adVariant="1.6 Premium" />)
    expect(screen.getByText(/Iklan kata “1\.6 Premium” — sepadan dengan rekod/)).toBeTruthy()
  })

  it('names the mismatch and what to do', () => {
    render(<VariantCheckCard {...base} adVariant="1.6 Executive" />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/Iklan kata “1\.6 Executive”/)
    expect(text).toMatch(/“EXECUTIVE” tiada dalam rekod/)
    expect(text).toMatch(/jangan bayar harga varian itu/i)
    expect(text).not.toMatch(/penjual|tipu/i)
  })

  it('says nothing about the advert when there is no advert variant', () => {
    render(<VariantCheckCard {...base} />)
    expect(document.body.textContent).not.toMatch(/Iklan kata/)
  })

  it('says nothing about the advert without an official record to compare', () => {
    render(<VariantCheckCard make="PROTON" model="EXORA" officialVariant={null} adVariant="1.6 Executive" />)
    expect(document.body.textContent).not.toMatch(/Iklan kata/)
  })
})

describe('wiring', () => {
  it('the page reads the advert variant from the intake and the report passes it to the card', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const page = strip(readFileSync('app/laporan-pembeli/[checkId]/page.tsx', 'utf8'))
    expect(page).toContain('intakeExtractedForCheck(params.checkId)')
    expect(page).toContain('adVariant={adVariant}')
    const content = strip(readFileSync('components/report/BuyerReportContent.tsx', 'utf8'))
    expect(content).toMatch(/<VariantCheckCard[\s\S]*?adVariant=\{adVariant\}/)
  })
})
