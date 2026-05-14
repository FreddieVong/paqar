import express, { type Request, type Response, type NextFunction } from 'express'
import { scrapePdrm }          from './scrapers/pdrm.js'
import { scrapeJpj }           from './scrapers/jpj.js'
import { scrapeAes }           from './scrapers/aes.js'
import { scrapeLocalCouncils } from './scrapers/local-councils.js'
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
  res.json({ ok: true, ts: new Date().toISOString() })
})

// ── Saman endpoints ───────────────────────────────────────────────────────────
app.post('/check/pdrm', async (req, res) => {
  const { plate } = req.body as { plate?: string }
  if (!plate) { res.status(400).json({ error: 'plate required' }); return }
  const result = await scrapePdrm(plate)
  console.log('[pdrm]', JSON.stringify({ status: result.status, error: (result as {error?:string}).error }))
  res.json(result)
})

app.post('/check/jpj', async (req, res) => {
  const { plate } = req.body as { plate?: string }
  if (!plate) { res.status(400).json({ error: 'plate required' }); return }
  const result = await scrapeJpj(plate)
  console.log('[jpj]', JSON.stringify({ status: result.status, error: (result as {error?:string}).error }))
  res.json(result)
})

app.post('/check/aes', async (req, res) => {
  const { plate } = req.body as { plate?: string }
  if (!plate) { res.status(400).json({ error: 'plate required' }); return }
  const result = await scrapeAes(plate)
  res.json(result)
})

app.post('/check/local_councils', async (req, res) => {
  const { plate } = req.body as { plate?: string }
  if (!plate) { res.status(400).json({ error: 'plate required' }); return }
  const result = await scrapeLocalCouncils(plate)
  res.json(result)
})

// ── Market prices ─────────────────────────────────────────────────────────────
app.post('/check/mudah-market', async (req, res) => {
  const { make, model, year } = req.body as { make?: string; model?: string; year?: string }
  if (!make || !model) { res.status(400).json({ error: 'make and model required' }); return }
  const result = await scrapeMudahMarket(make, model, year ?? '')
  console.log('[mudah-market]', JSON.stringify({ make, model, year, count: result.listings.length, error: result.error }))
  res.json(result)
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Paqar scraper running on :${PORT}`)
})
