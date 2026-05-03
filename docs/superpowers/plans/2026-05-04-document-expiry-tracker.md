# Document Expiry Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Document Expiry Tracker — a dashboard at `/dashboard` where signed-in users track roadtax, insurance, and driving licence expiry dates, with Resend email reminders at 90/60/30/7/1 days before expiry.

**Architecture:** Server Component dashboard reads session and vehicle data; `ExpiryCard` Client Component handles inline date form with a server action. Vercel Cron fires daily at 00:00 UTC, queries `document_expiries` for each of the 5 notification windows, and sends Resend emails. Post-check CTA in `ResultsStream` surfaces the tracker to signed-in users.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Auth), Resend (email), Vercel Cron, TypeScript strict, Tailwind CSS, Plus Jakarta Sans / DM Sans

---

## File Map

```
Modify:
  types/domain.ts                              ← add DocumentExpiry interface
  lib/env.ts                                   ← add RESEND_API_KEY, CRON_SECRET (optional)
  lib/db/vehicles.ts                           ← add getOrCreateVehicleForUser()
  components/layout/Nav.tsx                    ← auth-aware: show Dashboard link when signed in
  components/check/ResultsStream.tsx           ← add showDocsCta for signed-in users
  .env.local.example                           ← add new env var templates
  .env.local                                   ← add real RESEND_API_KEY + CRON_SECRET

Create:
  supabase/migrations/002_document_expiry_unique.sql   ← unique index on (user_id, document_type)
  lib/db/document-expiries.ts                  ← DB access layer for document_expiries table
  lib/email/expiry-notification.ts             ← Resend email helper
  app/dashboard/_actions.ts                    ← server action: saveDocumentExpiry
  app/dashboard/page.tsx                       ← replace stub with real dashboard
  app/api/cron/check-expiries/route.ts         ← daily cron job
  components/dashboard/ExpiryCard.tsx          ← single document expiry card + inline form
  vercel.json                                  ← cron schedule config
```

---

## Task 1: DB migration — unique index

**Files:**
- Create: `supabase/migrations/002_document_expiry_unique.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Ensures each user has at most one non-deleted entry per document type.
-- Required for upsert on (user_id, document_type).
create unique index document_expiries_user_type_unique
  on document_expiries(user_id, document_type)
  where deleted_at is null;
```

- [ ] **Step 2: Apply in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste and run the SQL above.

Verify: in Table Editor → `document_expiries` → Indexes, you should see `document_expiries_user_type_unique`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_document_expiry_unique.sql
git commit -m "feat: unique index on document_expiries(user_id, document_type)"
```

---

## Task 2: Install Resend + environment variables

**Files:**
- Modify: `.env.local.example`
- Modify: `.env.local`
- Modify: `lib/env.ts`

- [ ] **Step 1: Install Resend**

```bash
pnpm add resend
```

- [ ] **Step 2: Add env var templates to `.env.local.example`**

Append these lines to `.env.local.example`:

```
# Email (Resend) — get key from resend.com
RESEND_API_KEY=re_your_api_key

# Cron security — generate with: openssl rand -hex 32
CRON_SECRET=your-64-char-hex-string
```

- [ ] **Step 3: Add real values to `.env.local`**

Add to `.env.local`:
```
RESEND_API_KEY=re_...       # from resend.com dashboard
CRON_SECRET=<output of: openssl rand -hex 32>
```

Sign up at [resend.com](https://resend.com) if needed — free tier (3,000 emails/month) is sufficient for MVP.

- [ ] **Step 4: Update `lib/env.ts` — add optional fields**

Read `lib/env.ts`, then add `RESEND_API_KEY` and `CRON_SECRET` as optional fields in the Zod schema (optional because local dev may not have them):

```typescript
import 'server-only'
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1),
  AES_KEY: z.string().regex(
    /^[0-9a-f]{64}$/,
    'AES_KEY must be 64 lowercase hex characters (32 bytes)'
  ),
  UPSTASH_REDIS_REST_URL:   z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  DATA_SOURCE_MODE: z.enum(['stub', 'real']).default('stub'),
  NEXT_PUBLIC_POSTHOG_KEY:  z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  SENTRY_DSN:               z.string().url(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CRON_SECRET:    z.string().min(1).optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  throw new Error('Invalid environment variables — check server logs')
}

export const env = parsed.data
```

- [ ] **Step 5: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add .env.local.example lib/env.ts
git commit -m "feat: add Resend + CRON_SECRET env vars"
```

---

## Task 3: Domain type + DB layer

**Files:**
- Modify: `types/domain.ts`
- Create: `lib/db/document-expiries.ts`
- Modify: `lib/db/vehicles.ts`

- [ ] **Step 1: Add `DocumentExpiry` to `types/domain.ts`**

Append to the end of `types/domain.ts`:

```typescript
export type DocType = 'roadtax' | 'insurance' | 'driving_licence'

export interface DocumentExpiry {
  id: string
  user_id: string
  vehicle_id: string | null
  document_type: DocType
  expires_on: string   // ISO 8601 date "YYYY-MM-DD"
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Create `lib/db/document-expiries.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import type { DocumentExpiry, DocType } from '@/types/domain'

export async function getUserDocumentExpiries(userId: string): Promise<DocumentExpiry[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('document_expiries')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DocumentExpiry[]
}

export async function upsertDocumentExpiry(params: {
  userId: string
  vehicleId: string | null
  docType: DocType
  expiresOn: string
}): Promise<DocumentExpiry> {
  const supabase = createServiceClient()

  // Try update first (existing record for this user+docType)
  const { data: existing } = await supabase
    .from('document_expiries')
    .select('id')
    .eq('user_id', params.userId)
    .eq('document_type', params.docType)
    .is('deleted_at', null)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('document_expiries')
      .update({
        expires_on:  params.expiresOn,
        vehicle_id:  params.vehicleId,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data as DocumentExpiry
  }

  const { data, error } = await supabase
    .from('document_expiries')
    .insert({
      user_id:       params.userId,
      vehicle_id:    params.vehicleId,
      document_type: params.docType,
      expires_on:    params.expiresOn,
    })
    .select()
    .single()
  if (error) throw error
  return data as DocumentExpiry
}

/** Returns expiries where expires_on equals the given ISO date string. */
export async function getExpiriesOnDate(targetDate: string): Promise<DocumentExpiry[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('document_expiries')
    .select('*')
    .eq('expires_on', targetDate)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as DocumentExpiry[]
}
```

- [ ] **Step 3: Add `getOrCreateVehicleForUser` to `lib/db/vehicles.ts`**

Read `lib/db/vehicles.ts` first, then append this function:

```typescript
import { decrypt } from '@/lib/crypto'

export async function getOrCreateVehicleForUser(userId: string): Promise<{
  vehicle: Vehicle
  platePlain: string
} | null> {
  const supabase = createServiceClient()

  // 1. Check existing vehicle
  const { data: existing } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    const platePlain = decrypt(existing.plate_encrypted as string)
    return { vehicle: existing as Vehicle, platePlain }
  }

  // 2. No vehicle — try to create from most recent check
  const { data: check } = await supabase
    .from('checks')
    .select('plate_encrypted, plate_hash')
    .eq('user_id', userId)
    .eq('status', 'complete')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!check) return null

  const { data: newVehicle, error } = await supabase
    .from('vehicles')
    .insert({
      user_id:         userId,
      plate_encrypted: check.plate_encrypted,
      plate_hash:      check.plate_hash,
      country:         'MY',
    })
    .select()
    .single()

  if (error) throw error

  const platePlain = decrypt(check.plate_encrypted as string)
  return { vehicle: newVehicle as Vehicle, platePlain }
}
```

- [ ] **Step 4: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add types/domain.ts lib/db/document-expiries.ts lib/db/vehicles.ts
git commit -m "feat: DocumentExpiry type, DB layer, vehicle resolver"
```

---

## Task 4: Server action

**Files:**
- Create: `app/dashboard/_actions.ts`

- [ ] **Step 1: Create `app/dashboard/_actions.ts`**

```typescript
'use server'

import { createClient }          from '@/lib/supabase/server'
import { upsertDocumentExpiry }  from '@/lib/db/document-expiries'
import { getOrCreateVehicleForUser } from '@/lib/db/vehicles'
import type { DocType } from '@/types/domain'

export async function saveDocumentExpiry(params: {
  docType: DocType
  expiresOn: string  // ISO 8601: "2027-03-15"
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Tidak log masuk' }

  // Validate date: must be between today and 15 years from now
  const expiry = new Date(params.expiresOn)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date()
  maxDate.setFullYear(maxDate.getFullYear() + 15)

  if (isNaN(expiry.getTime()) || expiry < today || expiry > maxDate) {
    return { error: 'Tarikh tidak sah — mestilah antara hari ini dan 15 tahun akan datang' }
  }

  // Resolve vehicle (required for roadtax/insurance, not for driving_licence)
  let vehicleId: string | null = null

  if (params.docType !== 'driving_licence') {
    const result = await getOrCreateVehicleForUser(user.id)
    if (!result) return { error: 'Tiada kenderaan ditemui — buat semakan dahulu' }
    vehicleId = result.vehicle.id
  }

  try {
    await upsertDocumentExpiry({
      userId:    user.id,
      vehicleId,
      docType:   params.docType,
      expiresOn: params.expiresOn,
    })
    return { error: null }
  } catch (err) {
    console.error('[saveDocumentExpiry]', err)
    return { error: 'Ralat menyimpan — sila cuba semula' }
  }
}
```

- [ ] **Step 2: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/_actions.ts
git commit -m "feat: saveDocumentExpiry server action with validation"
```

---

## Task 5: ExpiryCard component

**Files:**
- Create: `components/dashboard/ExpiryCard.tsx`

- [ ] **Step 1: Create `components/dashboard/ExpiryCard.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { saveDocumentExpiry }       from '@/app/dashboard/_actions'
import type { DocType, DocumentExpiry } from '@/types/domain'

type ExpiryStatus = 'safe' | 'warning' | 'urgent' | 'expired' | 'missing'

const DOC_CONFIG: Record<DocType, { label: string; icon: string }> = {
  roadtax:         { label: 'Cukai Jalan',   icon: '🚗' },
  insurance:       { label: 'Insurans',       icon: '🛡️' },
  driving_licence: { label: 'Lesen Memandu',  icon: '🪪' },
}

const CARD_STYLES: Record<ExpiryStatus, string> = {
  safe:    'bg-[#F0FDF4] border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] border-[#FDE68A]',
  urgent:  'bg-[#FEF2F2] border-[#FECACA]',
  expired: 'bg-[#FEF2F2] border-[#FECACA]',
  missing: 'bg-[#F9FAFB] border-[#E5E7EB]',
}

const ICON_BG: Record<ExpiryStatus, string> = {
  safe:    'bg-[#DCFCE7]',
  warning: 'bg-[#FEF9C3]',
  urgent:  'bg-[#FEE2E2]',
  expired: 'bg-[#FEE2E2]',
  missing: 'bg-[#F3F4F6]',
}

function getStatus(expiresOn: string | null): ExpiryStatus {
  if (!expiresOn) return 'missing'
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiresOn)
  const days   = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
  if (days < 0)  return 'expired'
  if (days === 0) return 'expired'
  if (days <= 29) return 'urgent'
  if (days <= 60) return 'warning'
  return 'safe'
}

function getDaysLabel(expiresOn: string | null): string {
  if (!expiresOn) return 'Belum ditambah'
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiresOn)
  const days   = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
  if (days < 0)  return `Tamat ${Math.abs(days)} hari lepas`
  if (days === 0) return 'Tamat hari ini!'
  if (days <= 29) return `${days} hari lagi — Segera!`
  if (days <= 60) return `${days} hari lagi ⚠`
  return `${days} hari lagi`
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Props {
  docType:  DocType
  expiry:   DocumentExpiry | null
  onSaved:  () => void
}

export function ExpiryCard({ docType, expiry, onSaved }: Props) {
  const [expanded,    setExpanded]    = useState(false)
  const [dateValue,   setDateValue]   = useState(expiry?.expires_on ?? '')
  const [fieldError,  setFieldError]  = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()
  const cfg    = DOC_CONFIG[docType]
  const status = getStatus(expiry?.expires_on ?? null)

  function handleSave() {
    if (!dateValue) { setFieldError('Sila masukkan tarikh'); return }
    setFieldError(null)
    startTransition(async () => {
      const result = await saveDocumentExpiry({ docType, expiresOn: dateValue })
      if (result.error) { setFieldError(result.error); return }
      setExpanded(false)
      onSaved()
    })
  }

  return (
    <div className={`border-[1.5px] rounded-[14px] p-4 transition-all ${CARD_STYLES[status]}`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${ICON_BG[status]}`}>
          {cfg.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-[13px] text-[#111827]">{cfg.label}</p>
          {expiry
            ? <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                Tamat: {formatDisplayDate(expiry.expires_on)}
              </p>
            : <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">Tarikh belum ditambah</p>
          }
          <p className={`font-heading font-bold text-[12px] mt-0.5 ${
            status === 'safe'    ? 'text-[#15803D]' :
            status === 'warning' ? 'text-[#B45309]' :
            status === 'urgent' || status === 'expired' ? 'text-[#B91C1C]' :
            'text-[#9CA3AF]'
          }`}>
            {getDaysLabel(expiry?.expires_on ?? null)}
          </p>
        </div>

        {/* Action button */}
        {!expanded && (
          <button
            onClick={() => { setExpanded(true); setDateValue(expiry?.expires_on ?? '') }}
            className={`font-heading font-semibold text-[12px] border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white flex-shrink-0 ${
              expiry ? 'text-[#064E4A]' : 'text-[#6B7280] border-dashed'
            }`}
          >
            {expiry ? 'Edit' : '+ Tambah'}
          </button>
        )}
      </div>

      {/* Inline form */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Tarikh Tamat
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#064E4A] rounded-xl px-4 py-3
                       font-heading font-semibold text-[15px] text-[#111827]
                       focus:outline-none focus:ring-[3px] focus:ring-[#064E4A]/10 mb-3"
          />
          {fieldError && (
            <p className="font-body text-[12px] text-[#DC2626] mb-3">{fieldError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px] rounded-xl py-3 disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Menyimpan…' : 'Simpan →'}
            </button>
            <button
              onClick={() => { setExpanded(false); setFieldError(null) }}
              className="font-heading font-semibold text-[13px] text-[#6B7280] px-4"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ExpiryCard.tsx
git commit -m "feat: ExpiryCard component — all states, inline form, server action"
```

---

## Task 6: Dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

Replace the entire stub with:

- [ ] **Step 1: Replace `app/dashboard/page.tsx`**

```typescript
import { redirect }    from 'next/navigation'
import { Nav }         from '@/components/layout/Nav'
import { Shell }       from '@/components/layout/Shell'
import { ExpiryCard }  from '@/components/dashboard/ExpiryCard'
import { createClient }               from '@/lib/supabase/server'
import { getUserDocumentExpiries }    from '@/lib/db/document-expiries'
import { getOrCreateVehicleForUser }  from '@/lib/db/vehicles'
import type { DocType, DocumentExpiry } from '@/types/domain'

const DOC_TYPES: DocType[] = ['roadtax', 'insurance', 'driving_licence']

function overallStatus(expiries: DocumentExpiry[]): 'all_clear' | 'attention' | 'urgent' {
  const statuses = DOC_TYPES.map(dt => {
    const e = expiries.find(x => x.document_type === dt)
    if (!e) return 'missing'
    const days = Math.floor(
      (new Date(e.expires_on).getTime() - new Date().setHours(0,0,0,0)) / 86_400_000
    )
    if (days < 0)  return 'expired'
    if (days <= 29) return 'urgent'
    if (days <= 60) return 'warning'
    return 'safe'
  })
  if (statuses.some(s => s === 'expired' || s === 'urgent')) return 'urgent'
  if (statuses.some(s => s === 'warning' || s === 'missing')) return 'attention'
  return 'all_clear'
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?next=/dashboard')
  }

  const [expiries, vehicleResult] = await Promise.all([
    getUserDocumentExpiries(user.id),
    getOrCreateVehicleForUser(user.id),
  ])

  const status = overallStatus(expiries)

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 space-y-5">

          {/* Status banner */}
          <div className={`rounded-[14px] px-4 py-3.5 flex items-center gap-3 ${
            status === 'all_clear' ? 'bg-[#064E4A]' :
            status === 'attention' ? 'bg-[#B45309]' : 'bg-[#DC2626]'
          }`}>
            <span className="text-2xl">
              {status === 'all_clear' ? '✅' : status === 'attention' ? '⚠️' : '🔴'}
            </span>
            <div>
              <p className="font-heading font-bold text-[14px] text-white">
                {status === 'all_clear'
                  ? 'Semua dokumen dalam order'
                  : status === 'attention'
                  ? 'Beberapa dokumen perlu perhatian'
                  : 'Ada dokumen perlu tindakan segera'}
              </p>
              <p className="font-body text-[12px] text-white/70 mt-0.5">
                {status === 'all_clear'
                  ? 'Tiada dokumen tamat tempoh dalam masa terdekat'
                  : 'Semak kad di bawah untuk butiran'}
              </p>
            </div>
          </div>

          {/* Vehicle pill */}
          {vehicleResult ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-heading font-extrabold text-[18px] text-[#111827] tracking-[.06em]">
                  {vehicleResult.platePlain.toUpperCase()}
                </p>
                <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">Kenderaan anda</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-xl px-4 py-3">
              <p className="font-heading font-bold text-[13px] text-[#B45309]">
                Tiada kenderaan ditemui
              </p>
              <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                Buat semakan kenderaan dahulu untuk mulakan penjejakan.
              </p>
            </div>
          )}

          {/* Section title */}
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280]">
            Status Dokumen
          </p>

          {/* Expiry cards */}
          <div className="space-y-3">
            {DOC_TYPES.map(dt => (
              <ExpiryCard
                key={dt}
                docType={dt}
                expiry={expiries.find(e => e.document_type === dt) ?? null}
                onSaved={() => { /* router.refresh() via revalidatePath in action */ }}
              />
            ))}
          </div>

          {/* Email reminder note */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3.5 flex items-center gap-3">
            <span className="text-lg">📧</span>
            <div>
              <p className="font-heading font-bold text-[13px] text-[#111827]">Peringatan E-mel Aktif</p>
              <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                Kami akan hantar e-mel 90, 60, 30, 7 &amp; 1 hari sebelum tamat tempoh.
              </p>
            </div>
          </div>

        </div>
      </Shell>
    </>
  )
}
```

- [ ] **Step 2: Update `saveDocumentExpiry` action to revalidate path**

Open `app/dashboard/_actions.ts` and add `revalidatePath` so the dashboard refreshes after saving:

Add import at top:
```typescript
import { revalidatePath } from 'next/cache'
```

Add before the final `return { error: null }`:
```typescript
revalidatePath('/dashboard')
```

Also update the `ExpiryCard.tsx` `onSaved` callback — it no longer needs to do anything since `revalidatePath` handles refresh automatically. The `onSaved` prop can just be `() => {}` in the parent.

- [ ] **Step 3: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx app/dashboard/_actions.ts
git commit -m "feat: dashboard page — expiry cards, status banner, vehicle pill"
```

---

## Task 7: Auth-aware Nav

**Files:**
- Modify: `components/layout/Nav.tsx`

Make Nav an async Server Component that shows "Dashboard" when signed in, "Log Masuk" when not.

- [ ] **Step 1: Replace `components/layout/Nav.tsx`**

```typescript
import Link  from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

export async function Nav() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-[#F3F4F6]">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/paqar-logo.png"
            alt="Paqar"
            width={96}
            height={56}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="font-heading font-semibold text-[13px] text-[#064E4A] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 hover:border-[#064E4A] transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/auth"
              className="font-heading font-semibold text-[13px] text-[#064E4A] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 hover:border-[#064E4A] transition-colors"
            >
              Log Masuk
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/layout/Nav.tsx
git commit -m "feat: nav shows Dashboard link when signed in"
```

---

## Task 8: Post-check CTA for signed-in users

**Files:**
- Modify: `components/check/ResultsStream.tsx`

Currently `showSaveCta` shows the "save account" prompt for anonymous users. Add `showDocsCta` for signed-in users.

- [ ] **Step 1: Update `ResultsStream.tsx`**

Read the current file. Find the `showSaveCta` line and add `showDocsCta` alongside it:

```typescript
// Find this line:
const showSaveCta    = isComplete && check?.user_id == null && authedUser === null

// Add directly after it:
const showDocsCta    = isComplete && authedUser != null
```

Then, after the closing `}` of the `{showSaveCta && (...)}` block, add:

```tsx
      {showDocsCta && (
        <div className="border-[1.5px] border-[#064E4A]/30 rounded-xl p-4 bg-[#064E4A]/5">
          <p className="font-heading font-bold text-[14px] text-[#064E4A] mb-1">
            Pantau dokumen kenderaan anda
          </p>
          <p className="font-body text-[12px] text-[#6B7280] mb-3">
            Tambah tarikh tamat cukai jalan, insurans &amp; lesen. Kami akan ingatkan anda sebelum tamat tempoh.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px]"
          >
            Tambah Dokumen →
          </Button>
        </div>
      )}
```

- [ ] **Step 2: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/check/ResultsStream.tsx
git commit -m "feat: post-check CTA for signed-in users — link to document tracker"
```

---

## Task 9: Email helper + Cron job

**Files:**
- Create: `lib/email/expiry-notification.ts`
- Create: `app/api/cron/check-expiries/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create `lib/email/expiry-notification.ts`**

```typescript
import { Resend } from 'resend'
import { env }    from '@/lib/env'
import type { DocType } from '@/types/domain'

const DOC_LABELS_BM: Record<DocType, string> = {
  roadtax:         'Cukai Jalan',
  insurance:       'Insurans',
  driving_licence: 'Lesen Memandu',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export async function sendExpiryNotification(params: {
  toEmail:   string
  docType:   DocType
  expiresOn: string
  platePlain: string | null
  daysUntil: number
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[expiry-notification] RESEND_API_KEY not set — skipping email')
    return
  }

  const resend = new Resend(env.RESEND_API_KEY)
  const label  = DOC_LABELS_BM[params.docType]
  const plate  = params.platePlain ?? 'kenderaan anda'
  const dateStr = formatDate(params.expiresOn)

  const subject = `⚠️ ${label} ${plate} tamat dalam ${params.daysUntil} hari`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#064E4A;font-size:20px;margin-bottom:8px;">Peringatan Paqar</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">
        <strong>${label}</strong> untuk <strong>${plate}</strong> akan tamat tempoh dalam
        <strong>${params.daysUntil} hari</strong>.
      </p>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="color:#6B7280;font-size:13px;margin:0 0 4px;">Tarikh tamat:</p>
        <p style="color:#111827;font-size:17px;font-weight:700;margin:0;">${dateStr}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;">
        Pastikan anda membaharui sebelum tamat untuk elak saman atau masalah undang-undang.
      </p>
      <a href="https://paqar.my/dashboard"
         style="display:inline-block;background:#064E4A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;margin-top:16px;">
        Semak Dashboard →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
        Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
      </p>
    </div>
  `

  await resend.emails.send({
    from:    'Paqar <onboarding@resend.dev>',  // replace with verified domain when paqar.my DNS is set up
    to:      params.toEmail,
    subject,
    html,
  })
}
```

- [ ] **Step 2: Create `app/api/cron/check-expiries/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { getExpiriesOnDate }         from '@/lib/db/document-expiries'
import { sendExpiryNotification }    from '@/lib/email/expiry-notification'
import { decrypt }                   from '@/lib/crypto'
import { env }                       from '@/lib/env'
import type { DocType }              from '@/types/domain'

const NOTIFICATION_DAYS = [1, 7, 30, 60, 90] as const

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const auth = request.headers.get('authorization')
  const expectedToken = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null

  if (expectedToken && auth !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today    = new Date()
  today.setHours(0, 0, 0, 0)

  let emailsSent = 0
  const errors: string[] = []

  for (const daysUntil of NOTIFICATION_DAYS) {
    const targetDate = addDays(today, daysUntil)
    const expiries   = await getExpiriesOnDate(targetDate)

    for (const expiry of expiries) {
      try {
        // Get user email via admin API
        const { data: userData } = await supabase.auth.admin.getUserById(expiry.user_id)
        const email = userData.user?.email
        if (!email) continue

        // Resolve plate (best effort — may be null if vehicle deleted)
        let platePlain: string | null = null
        if (expiry.vehicle_id) {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('plate_encrypted')
            .eq('id', expiry.vehicle_id)
            .single()
          if (vehicle?.plate_encrypted) {
            platePlain = decrypt(vehicle.plate_encrypted as string)
          }
        }

        await sendExpiryNotification({
          toEmail:    email,
          docType:    expiry.document_type as DocType,
          expiresOn:  expiry.expires_on,
          platePlain,
          daysUntil,
        })
        emailsSent++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`expiry ${expiry.id}: ${msg}`)
        console.error('[cron/check-expiries]', expiry.id, err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: today.toISOString().split('T')[0],
    emailsSent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
```

- [ ] **Step 3: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiries",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs at 00:00 UTC daily (08:00 MYT).

- [ ] **Step 4: TSC check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add lib/email/expiry-notification.ts app/api/cron/check-expiries/route.ts vercel.json
git commit -m "feat: Resend email notification + daily cron job for expiry reminders"
```

---

## Task 10: Verification pass

- [ ] **Step 1: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Tests**

```bash
pnpm test
```

Expected: 19/19 still passing

- [ ] **Step 3: Start dev server and verify flow**

```bash
pnpm dev
```

Open http://localhost:3000

- [ ] **Step 4: Verify auth gate**

Open http://localhost:3000/dashboard while **not** signed in.
Expected: redirects to `/auth?next=/dashboard`

- [ ] **Step 5: Verify signed-in dashboard**

Sign in, then navigate to http://localhost:3000/dashboard.
Expected:
- Status banner visible (orange if no docs added)
- Vehicle plate shown (from most recent check) OR "Tiada kenderaan" message
- Three grey cards with "+ Tambah" buttons

- [ ] **Step 6: Verify adding a document**

Click "+ Tambah" on Cukai Jalan card.
Expected: inline form expands with date picker.
Enter a date > 60 days from today → click "Simpan".
Expected: card turns green, shows days remaining, form collapses.

- [ ] **Step 7: Verify urgency colours**

Enter a date 15 days from today on Insurans.
Expected: amber card.
Enter a date 5 days from today on Lesen Memandu.
Expected: red card with "— Segera!"

- [ ] **Step 8: Verify post-check CTA**

Run a check (plate + IC). When complete, if signed in:
Expected: teal "Pantau dokumen kenderaan anda" card at bottom linking to `/dashboard`.
If NOT signed in: "Simpan & buat akaun" card (unchanged).

- [ ] **Step 9: Verify Nav**

When signed in: Nav shows "Dashboard" link.
When signed out: Nav shows "Log Masuk".

- [ ] **Step 10: Test cron endpoint manually**

```bash
curl -s "http://localhost:3000/api/cron/check-expiries" \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

Expected: `{"ok":true,"date":"...","emailsSent":0}` (no expiries due today unless you added one expiring on that exact day)

- [ ] **Step 11: Verify cron auth**

```bash
curl -s "http://localhost:3000/api/cron/check-expiries"
```

Expected: `{"error":"Unauthorized"}` with 401 status

- [ ] **Step 12: Final commit**

```bash
git add -A
git commit -m "feat: Feature 2 — Document Expiry Tracker complete"
```
