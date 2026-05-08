import express, { type Request, type Response, type NextFunction } from 'express'
import { scrapePdrm }          from './scrapers/pdrm.js'
import { scrapeJpj }           from './scrapers/jpj.js'
import { scrapeAes }           from './scrapers/aes.js'
import { scrapeLocalCouncils } from './scrapers/local-councils.js'

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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Paqar scraper running on :${PORT}`)
})
