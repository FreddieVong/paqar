import express, { type Request, type Response, type NextFunction } from 'express'
import { scrapePdrm }          from './scrapers/pdrm.js'
import { scrapeJpj }           from './scrapers/jpj.js'
import { scrapeAes }           from './scrapers/aes.js'
import { scrapeLocalCouncils } from './scrapers/local-councils.js'
import { scrapeImmigration }   from './scrapers/immigration.js'
import { scrapeLhdn }          from './scrapers/lhdn.js'
import { scrapePtptn }         from './scrapers/ptptn.js'

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
  res.json(result)
})

app.post('/check/jpj', async (req, res) => {
  const { plate } = req.body as { plate?: string }
  if (!plate) { res.status(400).json({ error: 'plate required' }); return }
  const result = await scrapeJpj(plate)
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

app.post('/check/immigration', async (req, res) => {
  const { ic } = req.body as { ic?: string }
  if (!ic) { res.status(400).json({ error: 'ic required' }); return }
  const result = await scrapeImmigration(ic)
  res.json(result)
})

app.post('/check/lhdn', async (req, res) => {
  const { ic } = req.body as { ic?: string }
  if (!ic) { res.status(400).json({ error: 'ic required' }); return }
  const result = await scrapeLhdn(ic)
  res.json(result)
})

app.post('/check/ptptn', async (req, res) => {
  const { ic } = req.body as { ic?: string }
  if (!ic) { res.status(400).json({ error: 'ic required' }); return }
  const result = await scrapePtptn(ic)
  res.json(result)
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Paqar scraper running on :${PORT}`)
})
