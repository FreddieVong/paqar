import express, { type Request, type Response, type NextFunction } from 'express'
import { scrapeMudahMarket }   from './scrapers/mudah-market.js'

const app  = express()
const PORT = process.env.PORT ?? '3001'
const KEY  = process.env.API_KEY ?? ''

app.use(express.json())

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') return next()
  const provided = req.headers['x-api-key']
  if (!KEY || provided !== KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  // version: bump when scraping behavior changes — lets deploys be verified
  // from outside without Railway dashboard access
  res.json({ ok: true, version: '2026-08-06-market-only', ts: new Date().toISOString() })
})

// ── Market prices (Mudah listing scraper) ────────────────────────────────────
// This is the service's only job. The saman endpoints (pdrm/jpj/aes/
// local_councils) were removed 2026-08-06 — nothing in the app had called them
// since the free check pivoted from saman lookup to market pricing.
app.post('/check/mudah-market', async (req, res) => {
  const { make, model, year, debug } = req.body as { make?: string; model?: string; year?: string; debug?: boolean }
  if (!make || !model) { res.status(400).json({ error: 'make and model required' }); return }
  const result = await scrapeMudahMarket(make, model, year ?? '', debug === true)
  console.log('[mudah-market]', JSON.stringify({ make, model, year, count: result.listings.length, error: result.error }))
  res.json(result)
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Paqar scraper running on :${PORT}`)
})
