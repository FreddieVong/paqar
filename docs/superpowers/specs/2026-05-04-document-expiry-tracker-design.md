# Paqar — Feature 2: Document Expiry Tracker

## Context

After the saman/blacklist check delivers value (Feature 1), the Document Expiry Tracker is the retention loop that converts anonymous one-time users into account holders. Users save their roadtax, insurance, and driving licence expiry dates. Paqar emails them at 90, 60, 30, 7, and 1 days before each document expires.

This is the primary reason a user creates an account and returns monthly. The "all clear" experience — opening the app and seeing everything green — is as valuable as the alert experience.

---

## Scope

**In scope:**
- Three document types: Cukai Jalan (roadtax), Insurans (insurance), Lesen Memandu (driving licence)
- Manual expiry date entry (user types the date — it's printed on their documents)
- Dashboard page at `/dashboard` showing all three document statuses
- Post-check CTA: appears at the bottom of the check results page after a signed-in user's check completes
- Email notifications via Resend at 90/60/30/7/1 days before each expiry
- Vercel Cron daily job to check upcoming expiries and fire emails

**Out of scope (future):**
- Document photo upload + AI date extraction (Wave 2, when Claude API parsing is built for Buyer Report)
- Web Push notifications (email first; Web Push added later)
- Multiple vehicles (one vehicle per user for MVP)
- Notification preference settings (all 5 reminder cadences always on — no need for user config)

---

## User Flow

### Path A — Post-check (primary acquisition)
1. User completes saman check → is signed in (or just signed in)
2. Bottom of results page shows "Pantau dokumen kenderaan anda" CTA card
3. User taps → lands on `/dashboard` with empty document cards
4. User taps "+ Tambah" on each card → types expiry date → saves
5. Done — reminders are set

### Path B — Direct (returning users)
1. Signed-in user navigates to `/dashboard` directly (via nav)
2. Sees current document statuses (green/amber/red)
3. Taps "Edit" to update a date

---

## Document Types

| Type | BM Name | Belongs to | Notes |
|---|---|---|---|
| `roadtax` | Cukai Jalan | Vehicle | `vehicle_id` required |
| `insurance` | Insurans | Vehicle | `vehicle_id` required |
| `driving_licence` | Lesen Memandu | User | `vehicle_id` must be null (per DB constraint) |

---

## Expiry Status Logic

Calculated at render time from `expires_on` vs today's date:

| Days remaining | Status | Colour | BM label |
|---|---|---|---|
| > 60 days | `safe` | Green `#16A34A` | "X hari lagi" |
| 30–60 days | `warning` | Amber `#B45309` | "X hari lagi ⚠" |
| 1–29 days | `urgent` | Red `#DC2626` | "X hari lagi — Segera!" |
| 0 | `expired` | Red | "Tamat hari ini!" |
| < 0 | `expired` | Dark red | "Tamat X hari lepas" |
| Not set | `missing` | Grey | "Belum ditambah" |

---

## Pages & Components

### `/dashboard` page
Server Component. Shows:
- Status banner (green "all clear" or amber/red "needs attention")
- Vehicle plate pill (plate from the user's most recent check, from `checks` table)
- Three `ExpiryCard` components (one per document type)
- Link to notification settings (toggle future, read-only for MVP)

**Auth gate:** Redirect unauthenticated users to `/auth?next=/dashboard`.

### `ExpiryCard` component
Client Component. Props: `docType`, `expiresOn: string | null`, `vehicleId: string | null`, `userId: string`.

States:
- **Missing** — grey card, "+ Tambah" dashed button, expands inline form on tap
- **Set** — coloured card (green/amber/red), date + days-remaining, "Edit" button

Inline form (when expanded):
- Date input (native `type="date"`, auto-formats to DD/MM/YYYY for display)
- "Simpan" button → calls server action `upsertDocumentExpiry`
- "Batal" link to collapse

### Post-check CTA
Shown in `ResultsStream` when `isComplete && user is signed in`. A teal-bordered card at the bottom of the results list linking to `/dashboard`.

Conditions:
- Only shown when check is complete
- Only shown when user IS signed in (they have an account and can add documents)
- Not shown to anonymous users (they see "Save & create account" instead)

### Nav update
Add a dashboard link. When user is signed in: show "Dashboard" link in nav instead of / alongside "Log Masuk". When signed out: show "Log Masuk" only.

---

## Data Layer

### `document_expiries` table (already exists in DB)
```sql
id, user_id, vehicle_id (nullable), document_type, expires_on, created_at, updated_at, deleted_at
```

DB constraints already enforce:
- `driving_licence`: `vehicle_id` must be null
- `roadtax` / `insurance`: `vehicle_id` must not be null

### New DB functions (`lib/db/document-expiries.ts`)

```typescript
// Get all expiries for a user
getUserDocumentExpiries(userId: string): Promise<DocumentExpiry[]>

// Upsert a single expiry (insert or update on conflict)
upsertDocumentExpiry(params: {
  userId: string
  vehicleId: string | null
  docType: 'roadtax' | 'insurance' | 'driving_licence'
  expiresOn: string  // ISO 8601 date: "2027-03-15"
}): Promise<DocumentExpiry>

// Get expiries due for notification on a given date
getExpiriesDueForNotification(targetDate: string): Promise<DocumentExpiry[]>
// Used by cron job — returns expiries where expires_on = targetDate + N days for N in [1,7,30,60,90]
```

### New domain type (`types/domain.ts` addition)
```typescript
export interface DocumentExpiry {
  id: string
  user_id: string
  vehicle_id: string | null
  document_type: 'roadtax' | 'insurance' | 'driving_licence'
  expires_on: string   // ISO 8601 date string
  created_at: string
  updated_at: string
}
```

---

## Server Action

`app/dashboard/_actions.ts`:

```typescript
'use server'
import { upsertDocumentExpiry } from '@/lib/db/document-expiries'
import { createClient } from '@/lib/supabase/server'

export async function saveDocumentExpiry(params: {
  docType: 'roadtax' | 'insurance' | 'driving_licence'
  expiresOn: string
  vehicleId: string | null
}): Promise<void>
```

Validates:
- User is authenticated (reads session from cookies)
- `expiresOn` is between today and 15 years from now (rejects past dates and clearly wrong values)
- `vehicleId` is null for `driving_licence`, non-null for the other two

---

## Email Notification System

### Vercel Cron (`app/api/cron/check-expiries/route.ts`)

Runs daily at **08:00 MYT** (00:00 UTC). For each notification day offset (1, 7, 30, 60, 90):
1. Calculate target date = today + offset days
2. Query `document_expiries` where `expires_on = target_date` and `deleted_at is null`
3. For each result: look up user email, send Resend email

Cron schedule in `vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/check-expiries", "schedule": "0 0 * * *" }]
}
```

Security: cron route checks `Authorization: Bearer $CRON_SECRET` header.

### Email template (Resend)

Subject: `⚠️ [Document] anda tamat dalam [N] hari — WVP 1234`

Body (plain HTML):
```
Hai,

[Document BM name] kenderaan anda (WVP 1234) akan tamat tempoh dalam [N] hari.

Tarikh tamat: [DD MMM YYYY]

Pastikan anda membaharui sebelum tamat untuk elak saman.

[Semak Dashboard →]  ← links to /dashboard
```

---

## Environment Variables

Add to `.env.local` and `.env.local.example`:
```
RESEND_API_KEY=re_...
CRON_SECRET=random-hex-string   # generated with: openssl rand -hex 32
```

---

## Vehicle Resolution for MVP

For MVP (one vehicle), the dashboard resolves the user's vehicle like this:
1. Query `vehicles` table for `user_id = currentUser.id` (most recent, non-deleted)
2. If found → use that `vehicle_id` for roadtax/insurance documents
3. If not found → check if user has any `checks` — if yes, create a vehicle record from the most recent check's `plate_hash` (we can't decrypt the plate for display, so we show it from the `checks.plate_encrypted` field decrypted at read time)
4. If no checks either → show "Belum ada kenderaan — buat semakan dahulu"

---

## Verification Checklist

1. `/dashboard` redirects unauthenticated users to `/auth?next=/dashboard`
2. Empty state shows three grey cards with "+ Tambah" buttons
3. Tapping "+ Tambah" expands the inline form for that card only
4. Saving a date updates the card to the correct colour (green/amber/red) based on days remaining
5. Post-check CTA appears for signed-in users after a complete check
6. Post-check CTA does NOT appear for anonymous users (they see "Save & create account" instead)
7. Cron endpoint returns 401 without the correct `CRON_SECRET`
8. Email notification sent correctly for a document expiring in exactly 7 days (manual test via `/api/cron/check-expiries` with test date)
9. `driving_licence` saved with `vehicle_id = null`; `roadtax` and `insurance` saved with correct `vehicle_id`
10. `pnpm tsc --noEmit` passes with 0 errors
