import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIntake } from '@/lib/intake-auth'
import { setIntakeExtraction } from '@/lib/db/listing-intake'
import {
  mergeListing, readyForCoverage,
  type MergeKey, type MergedListing, type Provenance,
} from '@/lib/listing-merge'
import type { ExtractedListing } from '@/lib/listing-extract'

/**
 * Apply the buyer's corrections and return the re-merged summary.
 *
 * Edits are merged rather than assigned: they take precedence for THIS review,
 * but provenance is preserved so nothing downstream mistakes a buyer's
 * correction for a verified fact. See lib/listing-merge.
 */
const schema = z.object({
  brand:         z.string().max(50).optional(),
  model:         z.string().max(50).optional(),
  year:          z.string().regex(/^\d{4}$/).optional(),
  variant:       z.string().max(50).optional(),
  askingPriceRm: z.number().int().min(1000).max(2_000_000).optional(),
  mileageKm:     z.number().int().min(1).max(1_500_000).optional(),
  plate:         z.string().max(15).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const intake = await authorizeIntake(request, params.id)
  if (!intake) return NextResponse.json({ error: 'expired' }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const prior = intake.extracted
  // Rebuild from the ORIGINAL sources plus the new edits, rather than mutating
  // the merged output. Mutating would lose the provenance of everything the
  // buyer did not touch, and a later edit could not be un-done.
  const merged = mergeListing({
    fromUrl:         prior ? extractedFromMerged(prior, 'url_metadata') : null,
    fromScreenshots: prior ? extractedFromMerged(prior, 'screenshot_ocr') : null,
    buyerEdits:      parsed.data as Partial<Record<MergeKey, string | number>>,
    plateFromOcr:    prior?.plate.provenance === 'screenshot_ocr' ? prior.plate.value : null,
  })

  await setIntakeExtraction(params.id, merged, readyForCoverage(merged) ? 'ready' : 'draft')
  return NextResponse.json({ summary: merged, ready: readyForCoverage(merged) })
}

/**
 * Recover a single source's view from the merged record.
 *
 * The merge keeps one value per field with its provenance, so a field
 * attributed to another source is simply absent here. Enough to re-run the
 * merge with new edits without storing three parallel copies of everything.
 */
function extractedFromMerged(m: MergedListing, want: Provenance): ExtractedListing {
  const pick = <K extends keyof MergedListing>(k: K) =>
    m[k].provenance === want
      ? { value: m[k].value as never, status: m[k].status, evidence: null }
      : { value: null, status: 'missing' as const, evidence: null }
  return {
    brand: pick('brand'), model: pick('model'), year: pick('year'),
    askingPriceRm: pick('askingPriceRm'), mileageKm: pick('mileageKm'), variant: pick('variant'),
  }
}
