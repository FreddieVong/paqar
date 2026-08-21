import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('/home/freddievong/Paqar/.env.local','utf8').split('\n')
  .map(l => l.match(/^([^#=\s]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } })
await p.goto('http://localhost:3000/admin/review', { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.fill('input[name="secret"]', env.ADMIN_SECRET)
await p.click('button:has-text("Log Masuk")')
await p.waitForTimeout(4000); await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000)
const body = await p.innerText('body')
const i = body.indexOf('HARGA PASARAN')
console.log(body.slice(i, i + 260).replace(/\n{2,}/g, '\n').trim())
await b.close()
