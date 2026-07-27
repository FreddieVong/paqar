import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import type { RawClaimRow } from './index'
import { parseVisionRows } from './vision-parse'

export interface VisionExtractResult {
  ok:     boolean
  rows:   RawClaimRow[]
  error?: string
}

export interface VisionImage {
  base64:    string
  mediaType: string   // e.g. 'image/png', 'image/jpeg'
}

// Extraction prompt — the owner uploads screenshots of the JomCheck report's
// accident table. Return every claim row exactly as printed (do NOT dedup —
// the app collapses multiple-approval rows itself), no invented values.
const EXTRACT_PROMPT = `You are extracting the accident/claim table from screenshots of a Malaysian JomCheck vehicle history report.

Return ONLY a JSON object of this exact shape, nothing else:
{"rows": [{"dateOfLoss": string|null, "claimType": string, "accidentType": string, "mileage": number|null, "severity": string|null}]}

Rules:
- One object per row in the "Previous Accidents Submitted" / accident table. Include EVERY row, even ones that look like duplicates of the same incident — do not merge or dedupe them.
- dateOfLoss: the "Date of Loss" column, verbatim (e.g. "14 Apr 2024"). null if blank.
- claimType: the "Type of Claim" column verbatim (e.g. "Own Damage (OD)", "Own Damage - Constructive Total Loss (OD-CTL)", "Windscreen (WS)").
- accidentType: the "Type of Accident" column verbatim (e.g. "Collision", "Windscreen (WS)", "Not Specified").
- mileage: the "Mileage" column as a plain integer (strip commas). Use 0 if the cell shows 0, null if blank or "NOT AVAILABLE".
- severity: the "Severity" column verbatim (e.g. "SEVERE", "NOT RELEVANT / NO SUM INSURED PROVIDED"). null if blank.
- If the report shows NO accidents ("There is no accidents history"), return {"rows": []}.
- Do not invent, estimate, or infer any value. Transcribe only what is printed.`

export async function extractClaimRowsFromImages(images: VisionImage[]): Promise<VisionExtractResult> {
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, rows: [], error: 'ANTHROPIC_API_KEY tidak diset — guna kemasukan manual.' }
  }
  if (images.length === 0) return { ok: false, rows: [], error: 'Tiada gambar.' }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model:      'claude-opus-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          ...images.map(img => ({
            type:   'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: img.base64 },
          })),
          { type: 'text' as const, text: EXTRACT_PROMPT },
        ],
      }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    return { ok: true, rows: parseVisionRows(text) }
  } catch (err) {
    return { ok: false, rows: [], error: `Vision extraction gagal: ${String(err)}` }
  }
}
