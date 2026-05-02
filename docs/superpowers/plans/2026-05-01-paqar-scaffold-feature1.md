# Paqar — Scaffold + Feature 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Paqar Next.js scaffold and saman/blacklist check feature end-to-end using stub data, producing a fully user-testable experience where the swap to real scrapers in Phase 2 is a clean interface-preserving substitution.

**Architecture:** Next.js 14 App Router, Supabase for DB+Auth, polling-based progressive card reveal. Anonymous checks use a `claim_token` URL param; auth attaches the check to a user account inline (phone OTP) or via callback (email magic link). All 7 data source stubs implement the same `DataSourceAdapter` interface; the factory swaps them for real scrapers via a single env var.

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind CSS, shadcn/ui, Supabase (Postgres 15 + Auth), Upstash Redis, nanoid, Zod, PostHog, Sentry, Vitest

---

## File Map

```
/
├── .env.local.example
├── .gitignore
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── middleware.ts
│
├── types/
│   ├── database.ts           ← auto-generated placeholder (supabase gen types)
│   ├── domain.ts             ← User, Vehicle, Check, CheckResult
│   └── api.ts                ← API shapes + SourceData discriminated union
│
├── lib/
│   ├── env.ts                ← Zod env validation, throws at startup
│   ├── analytics.ts          ← PostHog event wrappers (no PII)
│   ├── crypto/
│   │   ├── index.ts          ← encrypt / decrypt / hash (AES-256-GCM)
│   │   └── index.test.ts
│   ├── supabase/
│   │   ├── client.ts         ← browser client
│   │   └── server.ts         ← server + service-role clients
│   ├── validation/
│   │   ├── plate.ts + plate.test.ts
│   │   ├── ic.ts + ic.test.ts
│   │   └── phone.ts + phone.test.ts
│   ├── data-sources/
│   │   ├── types.ts          ← DataSourceAdapter interface
│   │   ├── index.ts          ← getAdapters(country) factory + withTimeout
│   │   ├── stubs/
│   │   │   ├── _helpers.ts   ← getScenario(), delay(), stub delay constants
│   │   │   ├── pdrm.ts
│   │   │   ├── jpj.ts
│   │   │   ├── aes.ts
│   │   │   ├── local-councils.ts
│   │   │   ├── immigration.ts
│   │   │   ├── lhdn.ts
│   │   │   └── ptptn.ts
│   │   └── real/
│   │       └── .gitkeep
│   └── db/
│       ├── checks.ts         ← createCheck, getCheck, updateCheckResult, claimCheck, etc.
│       ├── users.ts          ← getUserById
│       └── vehicles.ts       ← createVehicle, getUserVehicles
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── components/
│   ├── layout/
│   │   ├── Nav.tsx
│   │   └── Shell.tsx
│   ├── check/
│   │   ├── CheckForm.tsx
│   │   ├── ResultCard.tsx
│   │   └── ResultsStream.tsx
│   └── auth/
│       ├── PhoneOtpForm.tsx
│       ├── MagicLinkForm.tsx
│       └── AuthShell.tsx
│
└── app/
    ├── globals.css
    ├── layout.tsx
    ├── page.tsx
    ├── check/[id]/page.tsx
    ├── auth/
    │   ├── page.tsx
    │   └── callback/route.ts
    ├── dashboard/page.tsx
    └── api/checks/
        ├── route.ts          ← POST
        └── [id]/route.ts     ← GET
```

---

## Task 1: Initialise project and git

**Files:** All root config files

- [ ] **Step 1: Initialise Next.js in the existing Paqar directory**

```bash
cd /home/freddievong/Paqar
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --yes
```

Expected: Files created including `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `app/`, `public/`.

- [ ] **Step 2: Install all runtime dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr nanoid zod \
  @upstash/redis @upstash/ratelimit \
  posthog-js @sentry/nextjs \
  class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Install dev dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 4: Initialise shadcn/ui**

```bash
pnpm dlx shadcn@latest init --yes
```

When prompted: style=default, base color=neutral, CSS variables=yes.

Then add the components we need:

```bash
pnpm dlx shadcn@latest add button input label badge progress
```

- [ ] **Step 5: Initialise git**

```bash
git init
git add .
git commit -m "chore: initialise Next.js 14 scaffold with deps"
```

---

## Task 2: Configure toolchain

**Files:** `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Update `tsconfig.json` for strict mode**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 3: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption — generate with: openssl rand -hex 32
AES_KEY=your-64-char-hex-string

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Data sources
DATA_SOURCE_MODE=stub

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Error tracking
SENTRY_DSN=https://your@sentry.io/project
```

- [ ] **Step 5: Append to `.gitignore`**

```
.env.local
.superpowers/
```

- [ ] **Step 6: Copy example and generate a real AES_KEY**

```bash
cp .env.local.example .env.local
openssl rand -hex 32
# Paste output as AES_KEY in .env.local
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: configure TypeScript strict mode, vitest, env template"
```

---

## Task 3: Core types

**Files:** `types/domain.ts`, `types/api.ts`, `types/database.ts`

- [ ] **Step 1: Create `types/domain.ts`**

Use snake_case throughout — these mirror Supabase column names exactly so DB results can be used directly without mapping.

```typescript
export interface Check {
  id: string
  user_id: string | null
  vehicle_id: string | null
  country: string
  status: 'pending' | 'running' | 'complete' | 'expired'
  claim_token: string | null
  idempotency_key: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface CheckResult {
  id: string
  check_id: string
  source: string
  status: 'pending' | 'clear' | 'hit' | 'unavailable' | 'timeout' | 'partial' | 'error'
  label: string
  data: unknown | null
  error_message: string | null
  attempt_count: number
  created_at: string
  checked_at: string | null
}

export interface Vehicle {
  id: string
  user_id: string
  plate_hash: string
  label: string | null
  country: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Create `types/api.ts`**

```typescript
import type { Check, CheckResult } from './domain'

export type SourceData =
  | { source: 'pdrm';           samans: SamanRecord[] }
  | { source: 'jpj';            samans: SamanRecord[] }
  | { source: 'aes';            samans: SamanRecord[] }
  | { source: 'local_councils'; samans: SamanRecord[]; council: string }
  | { source: 'immigration';    blacklisted: boolean; reason: string | null }
  | { source: 'lhdn';           blacklisted: boolean }
  | { source: 'ptptn';          blacklisted: boolean; outstanding: number | null }

export interface SamanRecord {
  offence:    string
  /** ISO 8601: "2026-04-15". All adapters must normalise to this format. */
  date:       string
  amount:     number
  /** Always 'MYR' in MVP. IDR/THB supported in Year 2. */
  currency:   string
  location:   string | null
  discounted: number | null
  /** Always null in stub phase. Real URLs arrive in Phase 2. */
  paymentUrl: null
}

export interface CreateCheckRequest {
  plate: string
  ic: string
  idempotencyKey?: string
}

export interface CreateCheckResponse {
  checkId: string
  claimToken: string
}

export interface PollCheckResponse {
  check: Check
  results: CheckResult[]
}
```

- [ ] **Step 3: Create placeholder `types/database.ts`**

```typescript
// Auto-generated by: pnpm supabase gen types typescript --linked > types/database.ts
// Run this after applying the migration in Task 8.
// Until then this is a placeholder so imports don't break.
export type Database = Record<string, unknown>
```

- [ ] **Step 4: Commit**

```bash
git add types/
git commit -m "feat: add domain and API types"
```

---

## Task 4: Environment validation

**Files:** `lib/env.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/env.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws when AES_KEY is missing', async () => {
    vi.stubEnv('AES_KEY', '')
    await expect(import('./env')).rejects.toThrow('Invalid environment variables')
  })

  it('throws when AES_KEY is not 64 hex chars', async () => {
    vi.stubEnv('AES_KEY', 'tooshort')
    await expect(import('./env')).rejects.toThrow('Invalid environment variables')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/env.test.ts
```

Expected: FAIL — `lib/env.ts` does not exist yet.

- [ ] **Step 3: Create `lib/env.ts`**

```typescript
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
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  throw new Error('Invalid environment variables — check server logs')
}

export const env = parsed.data
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test lib/env.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/env.ts lib/env.test.ts
git commit -m "feat: add Zod environment validation with loud startup failure"
```

---

## Task 5: Crypto module

**Files:** `lib/crypto/index.ts`, `lib/crypto/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/crypto/index.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

// Provide a valid test key before importing the module
beforeAll(() => {
  process.env.AES_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
})

describe('crypto module', () => {
  it('encrypt + decrypt round-trips correctly', async () => {
    const { encrypt, decrypt } = await import('./index')
    const plaintext = 'WVP1234'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encrypt } = await import('./index')
    expect(encrypt('WVP1234')).not.toBe(encrypt('WVP1234'))
  })

  it('hash normalises before hashing', async () => {
    const { hash } = await import('./index')
    expect(hash('wvp 1234')).toBe(hash('WVP1234'))
    expect(hash('WVP-1234')).toBe(hash('WVP1234'))
  })

  it('hash returns 64-char hex', async () => {
    const { hash } = await import('./index')
    expect(hash('WVP1234')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('throws on decrypt with corrupted ciphertext', async () => {
    const { decrypt } = await import('./index')
    expect(() => decrypt('bad:data:here')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/crypto/index.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `lib/crypto/index.ts`**

```typescript
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto'

const ALGORITHM    = 'aes-256-gcm'
const IV_LENGTH    = 16
const AUTH_TAG_LEN = 16

function getKey(): Buffer {
  const hex = process.env.AES_KEY
  if (!hex || hex.length !== 64) throw new Error('AES_KEY missing or invalid')
  return Buffer.from(hex, 'hex')
}

/** Returns `iv:authTag:ciphertext` (base64 segments joined by colon). */
export function encrypt(plaintext: string): string {
  const iv      = randomBytes(IV_LENGTH)
  const cipher  = createCipheriv(ALGORITHM, getKey(), iv)
  const body    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), body.toString('base64')].join(':')
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivB64, authTagB64, bodyB64] = parts as [string, string, string]
  const iv       = Buffer.from(ivB64, 'base64')
  const authTag  = Buffer.from(authTagB64, 'base64')
  const body     = Buffer.from(bodyB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return decipher.update(body).toString('utf8') + decipher.final('utf8')
}

/** SHA-256 of value.toUpperCase() with whitespace stripped. Returns hex string. */
export function hash(value: string): string {
  const normalised = value.toUpperCase().replace(/\s/g, '')
  return createHash('sha256').update(normalised).digest('hex')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/crypto/index.test.ts
```

Expected: 5 passing

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/
git commit -m "feat: AES-256-GCM encrypt/decrypt/hash with tests"
```

---

## Task 6: Validation modules

**Files:** `lib/validation/plate.ts`, `lib/validation/ic.ts`, `lib/validation/phone.ts` (+ `.test.ts` for each)

- [ ] **Step 1: Write the failing tests**

Create `lib/validation/plate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { plateSchema, normalise } from './plate'

describe('plate validation', () => {
  it('normalises to uppercase and strips spaces/hyphens', () => {
    expect(normalise('wvp 1234')).toBe('WVP1234')
    expect(normalise('W-VP-1234')).toBe('WVP1234')
  })

  it('accepts 3-9 alphanumeric chars after normalisation', () => {
    expect(plateSchema.safeParse('WVP1234').success).toBe(true)
    expect(plateSchema.safeParse('W1234').success).toBe(true)
    expect(plateSchema.safeParse('AB').success).toBe(false)  // too short
    expect(plateSchema.safeParse('ABCDEFGHIJ').success).toBe(false) // too long
  })

  it('rejects empty string', () => {
    expect(plateSchema.safeParse('').success).toBe(false)
  })
})
```

Create `lib/validation/ic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { icSchema, normalise } from './ic'

describe('IC validation', () => {
  it('normalises by stripping hyphens', () => {
    expect(normalise('880614-10-5421')).toBe('880614105421')
  })

  it('accepts valid 12-digit IC', () => {
    expect(icSchema.safeParse('880614105421').success).toBe(true)
    expect(icSchema.safeParse('880614-10-5421').success).toBe(true)
  })

  it('rejects IC with invalid month', () => {
    expect(icSchema.safeParse('881314105421').success).toBe(false)
  })

  it('rejects IC with fewer than 12 digits', () => {
    expect(icSchema.safeParse('88061410542').success).toBe(false)
  })
})
```

Create `lib/validation/phone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { phoneSchema } from './phone'

describe('phone validation', () => {
  it('accepts +60 prefix', () => {
    const r = phoneSchema.safeParse('+60123456789')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('+60123456789')
  })

  it('normalises leading 0 to +60', () => {
    const r = phoneSchema.safeParse('0123456789')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('+60123456789')
  })

  it('normalises 60 prefix to +60', () => {
    const r = phoneSchema.safeParse('60123456789')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('+60123456789')
  })

  it('rejects non-Malaysian numbers', () => {
    expect(phoneSchema.safeParse('+1234567890').success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/validation/
```

Expected: FAIL — modules don't exist.

- [ ] **Step 3: Create `lib/validation/plate.ts`**

```typescript
import { z } from 'zod'

export function normalise(plate: string): string {
  return plate.toUpperCase().replace(/[\s\-]/g, '')
}

/** Permissive for MVP: 3–9 alphanumeric chars after normalisation. */
export const plateSchema = z
  .string()
  .transform(normalise)
  .refine((p) => /^[A-Z0-9]{3,9}$/.test(p), {
    message: 'Invalid plate number (expected 3–9 alphanumeric characters)',
  })
```

- [ ] **Step 4: Create `lib/validation/ic.ts`**

```typescript
import { z } from 'zod'

export function normalise(ic: string): string {
  return ic.replace(/-/g, '')
}

function hasValidDatePrefix(ic: string): boolean {
  const month = parseInt(ic.slice(2, 4), 10)
  const day   = parseInt(ic.slice(4, 6), 10)
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

export const icSchema = z
  .string()
  .transform(normalise)
  .refine((ic) => /^\d{12}$/.test(ic), { message: 'IC must be 12 digits' })
  .refine(hasValidDatePrefix, { message: 'IC has invalid date prefix (YYMMDD)' })
```

- [ ] **Step 5: Create `lib/validation/phone.ts`**

```typescript
import { z } from 'zod'

function normaliseRaw(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '')
}

export const phoneSchema = z
  .string()
  .transform(normaliseRaw)
  .refine(
    (p) => /^(\+60|60|0)\d{9,10}$/.test(p),
    { message: 'Invalid Malaysian phone number' }
  )
  .transform((p) => {
    if (p.startsWith('0'))  return '+6' + p
    if (p.startsWith('60')) return '+' + p
    return p
  })
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test lib/validation/
```

Expected: 11 passing

- [ ] **Step 7: Commit**

```bash
git add lib/validation/
git commit -m "feat: plate, IC, and phone validation modules with tests"
```

---

## Task 7: Supabase clients and middleware

**Files:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`

- [ ] **Step 1: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Session-aware server client. Reads auth session from cookies. */
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie mutation is a no-op
          }
        },
      },
    }
  )
}

/** Service-role client. Bypasses RLS. Use only in API routes. */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

- [ ] **Step 3: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 4: Verify TypeScript is happy**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: Supabase browser/server clients and session middleware"
```

---

## Task 8: Database migration

**Files:** `supabase/migrations/001_initial_schema.sql`, `types/database.ts`

- [ ] **Step 1: Create `supabase/migrations/001_initial_schema.sql`**

```sql
-- VEHICLES
create table vehicles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  plate_encrypted  text not null,
  plate_hash       text not null,
  label            text,
  country          text not null default 'MY',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index vehicles_user_id_idx    on vehicles(user_id)    where deleted_at is null;
create index vehicles_plate_hash_idx on vehicles(plate_hash) where deleted_at is null;
alter table vehicles enable row level security;
create policy "vehicles: owner access" on vehicles
  for all using (auth.uid() = user_id);

-- CHECKS
create table checks (
  id               text primary key,
  plate_encrypted  text not null,
  plate_hash       text not null,
  ic_encrypted     text not null,
  ic_hash          text not null,
  country          text not null default 'MY',
  user_id          uuid references auth.users(id),
  vehicle_id       uuid references vehicles(id),
  status           text not null default 'pending'
                   constraint checks_status_values
                   check (status in ('pending','running','complete','expired')),
  claim_token      text unique,
  idempotency_key  text unique,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz,
  deleted_at       timestamptz
);
create index checks_user_id_idx      on checks(user_id, created_at desc)             where deleted_at is null;
create index checks_vehicle_id_idx   on checks(vehicle_id, created_at desc)          where deleted_at is null;
create index checks_cache_lookup_idx on checks(plate_hash, ic_hash, created_at desc) where deleted_at is null;
create index checks_claim_token_idx  on checks(claim_token)  where claim_token is not null;
create index checks_expires_at_idx   on checks(expires_at)   where deleted_at is null;
alter table checks enable row level security;
create policy "checks: owner read" on checks
  for select using (auth.uid() = user_id);

-- CHECK_RESULTS
create table check_results (
  id             uuid primary key default gen_random_uuid(),
  check_id       text not null references checks(id) on delete cascade,
  source         text not null,
  status         text not null default 'pending'
                 constraint check_results_status_values
                 check (status in ('pending','clear','hit','unavailable','timeout','partial','error')),
  label          text not null,
  data           jsonb,
  error_message  text,
  attempt_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  checked_at     timestamptz
);
create index check_results_check_id_idx on check_results(check_id);
alter table check_results enable row level security;
create policy "check_results: owner read" on check_results
  for select using (
    exists (
      select 1 from checks c
      where c.id = check_results.check_id and c.user_id = auth.uid()
    )
  );

-- DOCUMENT_EXPIRIES (schema-ready; Feature 2 populates it)
create table document_expiries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  vehicle_id     uuid references vehicles(id) on delete set null,
  document_type  text not null
                 constraint document_expiries_type_values
                 check (document_type in ('roadtax','insurance','driving_licence')),
  expires_on     date not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint driving_licence_no_vehicle
    check (document_type != 'driving_licence' or vehicle_id is null),
  constraint roadtax_insurance_requires_vehicle
    check (document_type = 'driving_licence' or vehicle_id is not null)
);
create index document_expiries_user_expires_idx
  on document_expiries(user_id, expires_on) where deleted_at is null;
alter table document_expiries enable row level security;
create policy "document_expiries: owner access" on document_expiries
  for all using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

Go to your Supabase project dashboard → SQL Editor → paste the entire migration SQL → Run.

Verify in Table Editor that all 4 tables exist: `vehicles`, `checks`, `check_results`, `document_expiries`.

- [ ] **Step 3: Enable Phone Auth in Supabase**

Supabase Dashboard → Authentication → Providers → Phone → Enable. Configure your SMS provider (Twilio or Vonage). Set OTP expiry to 600 seconds (10 minutes).

- [ ] **Step 4: Generate TypeScript types**

```bash
pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

Replace `YOUR_PROJECT_ID` with the value from your Supabase project URL (e.g. `abcdefghijklmnop`).

- [ ] **Step 5: Commit**

```bash
git add supabase/ types/database.ts
git commit -m "feat: initial schema migration and generated Supabase types"
```

---

## Task 9: DB access layer

**Files:** `lib/db/checks.ts`, `lib/db/users.ts`, `lib/db/vehicles.ts`

- [ ] **Step 1: Create `lib/db/checks.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import type { Check, CheckResult } from '@/types/domain'
import type { SourceResult } from '@/lib/data-sources/types'

const SOURCE_LABELS: Record<string, string> = {
  pdrm:          'PDRM Saman',
  jpj:           'JPJ Saman',
  aes:           'AES Saman',
  local_councils:'Local Councils',
  immigration:   'Immigration',
  lhdn:          'LHDN',
  ptptn:         'PTPTN',
}

const SOURCE_ORDER = ['pdrm','jpj','aes','local_councils','immigration','lhdn','ptptn']

export async function createCheck(params: {
  id: string
  plateEncrypted: string
  plateHash: string
  icEncrypted: string
  icHash: string
  claimToken: string
  idempotencyKey: string | undefined
  expiresAt: Date
}): Promise<void> {
  const supabase = createServiceClient()

  await supabase.from('checks').insert({
    id:               params.id,
    plate_encrypted:  params.plateEncrypted,
    plate_hash:       params.plateHash,
    ic_encrypted:     params.icEncrypted,
    ic_hash:          params.icHash,
    claim_token:      params.claimToken,
    idempotency_key:  params.idempotencyKey ?? null,
    expires_at:       params.expiresAt.toISOString(),
    status:           'pending',
  })

  const resultRows = SOURCE_ORDER.map((source) => ({
    check_id: params.id,
    source,
    status:   'pending',
    label:    SOURCE_LABELS[source] ?? source,
  }))

  await supabase.from('check_results').insert(resultRows)
}

export async function setCheckRunning(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('checks')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function setCheckComplete(id: string): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  await supabase
    .from('checks')
    .update({ status: 'complete', completed_at: now, updated_at: now })
    .eq('id', id)
}

export async function updateCheckResult(
  checkId: string,
  result: SourceResult
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('check_results')
    .update({
      status:        result.status,
      data:          result.data ?? null,
      error_message: result.errorMessage,
      checked_at:    result.checkedAt.toISOString(),
      attempt_count: 1,
    })
    .eq('check_id', checkId)
    .eq('source', result.source)
}

export async function getCheck(
  id: string,
  claimToken?: string
): Promise<{ check: Check; results: CheckResult[] } | null> {
  const supabase = createServiceClient()

  const { data: check } = await supabase
    .from('checks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!check) return null

  // Authorise: must have matching claim_token or be the owner (caller validates session)
  if (claimToken && check.claim_token !== claimToken) return null

  const { data: results } = await supabase
    .from('check_results')
    .select('*')
    .eq('check_id', id)
    .order('created_at', { ascending: true })

  return {
    check: check as Check,
    results: (results ?? []) as CheckResult[],
  }
}

/** Attach an anonymous check to a user. Idempotent. */
export async function claimCheck(
  claimToken: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('checks')
    .update({ user_id: userId, claim_token: null, updated_at: new Date().toISOString() })
    .eq('claim_token', claimToken)
    .is('user_id', null)
}

/** Cache lookup: returns the most recent non-expired complete check for this plate+IC pair. */
export async function getCachedCheck(
  plateHash: string,
  icHash: string
): Promise<{ id: string; claim_token: string | null } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('checks')
    .select('id, claim_token')
    .eq('plate_hash', plateHash)
    .eq('ic_hash', icHash)
    .eq('status', 'complete')
    .gt('expires_at', new Date().toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data ?? null
}

export async function getCheckByIdempotencyKey(
  key: string
): Promise<{ id: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('checks')
    .select('id')
    .eq('idempotency_key', key)
    .single()
  return data ?? null
}
```

- [ ] **Step 2: Create `lib/db/users.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'

export async function getUserById(id: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.auth.admin.getUserById(id)
  return data.user ?? null
}
```

- [ ] **Step 3: Create `lib/db/vehicles.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import type { Vehicle } from '@/types/domain'

export async function createVehicle(params: {
  userId: string
  plateEncrypted: string
  plateHash: string
  label?: string
  country?: string
}): Promise<Vehicle> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      user_id:         params.userId,
      plate_encrypted: params.plateEncrypted,
      plate_hash:      params.plateHash,
      label:           params.label ?? null,
      country:         params.country ?? 'MY',
    })
    .select()
    .single()

  if (error) throw error
  return data as unknown as Vehicle
}

export async function getUserVehicles(userId: string): Promise<Vehicle[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (data ?? []) as unknown as Vehicle[]
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add lib/db/
git commit -m "feat: DB access layer — checks, users, vehicles"
```

---

## Task 10: Adapter types, factory, and withTimeout

**Files:** `lib/data-sources/types.ts`, `lib/data-sources/index.ts`, `lib/data-sources/real/.gitkeep`

- [ ] **Step 1: Create `lib/data-sources/types.ts`**

```typescript
import type { SourceData } from '@/types/api'

export type Country  = 'MY' | 'ID' | 'TH'
export type SourceId =
  | 'pdrm' | 'jpj' | 'aes' | 'local_councils'
  | 'immigration' | 'lhdn' | 'ptptn'

/**
 * 'pending'     — pre-check state, matches DB schema
 * 'partial'     — within-source partial (source responded but data is incomplete,
 *                 e.g. PDRM returned results for 2 of 3 states).
 *                 NOT cross-source partial — missing sources are 'unavailable' or 'timeout'.
 */
export type SourceStatus =
  | 'pending' | 'clear' | 'hit'
  | 'unavailable' | 'timeout' | 'partial' | 'error'

export interface SourceResult {
  source:       SourceId
  status:       SourceStatus
  label:        string
  data:         SourceData | null
  errorMessage: string | null
  checkedAt:    Date
}

export interface DataSourceAdapter {
  readonly sourceId: SourceId
  readonly label:    string
  /**
   * Adapters NEVER retry internally.
   * Retries are the responsibility of the API route.
   */
  check(plate: string, ic: string): Promise<SourceResult>
}
```

- [ ] **Step 2: Create `lib/data-sources/index.ts`**

```typescript
import type { Country, DataSourceAdapter, SourceResult, SourceId } from './types'

import { PdrmStub }          from './stubs/pdrm'
import { JpjStub }           from './stubs/jpj'
import { AesStub }           from './stubs/aes'
import { LocalCouncilsStub } from './stubs/local-councils'
import { ImmigrationStub }   from './stubs/immigration'
import { LhdnStub }          from './stubs/lhdn'
import { PtptnStub }         from './stubs/ptptn'

function getStubAdapters(): DataSourceAdapter[] {
  return [
    new PdrmStub(),
    new JpjStub(),
    new AesStub(),
    new LocalCouncilsStub(),
    new ImmigrationStub(),
    new LhdnStub(),
    new PtptnStub(),
  ]
}

function getRealAdapters(_country: Country): DataSourceAdapter[] {
  // Phase 2: import real adapters here
  throw new Error('Real adapters not implemented — set DATA_SOURCE_MODE=stub')
}

/**
 * Returns the full set of adapters for the given country.
 * Per-source override: DATA_SOURCE_MODE_PDRM=real overrides DATA_SOURCE_MODE=stub.
 */
export function getAdapters(country: Country = 'MY'): DataSourceAdapter[] {
  const mode = process.env.DATA_SOURCE_MODE ?? 'stub'
  if (mode === 'real') return getRealAdapters(country)
  return getStubAdapters()
}

/**
 * Wraps an adapter so check() resolves within `ms` milliseconds
 * or returns { status: 'timeout' }.
 */
export function withTimeout(
  adapter: DataSourceAdapter,
  ms = 10_000
): DataSourceAdapter {
  return {
    sourceId: adapter.sourceId,
    label:    adapter.label,
    async check(plate: string, ic: string): Promise<SourceResult> {
      const timeoutResult: SourceResult = {
        source:       adapter.sourceId,
        status:       'timeout',
        label:        adapter.label,
        data:         null,
        errorMessage: `Timed out after ${ms}ms`,
        checkedAt:    new Date(),
      }

      return Promise.race([
        adapter.check(plate, ic),
        new Promise<SourceResult>((resolve) =>
          setTimeout(() => resolve(timeoutResult), ms)
        ),
      ])
    },
  }
}
```

- [ ] **Step 3: Create `lib/data-sources/real/.gitkeep`**

```bash
touch lib/data-sources/real/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add lib/data-sources/types.ts lib/data-sources/index.ts lib/data-sources/real/
git commit -m "feat: data source adapter interface, factory, and withTimeout"
```

---

## Task 11: Stub adapters

**Files:** `lib/data-sources/stubs/_helpers.ts` + 7 stub files

- [ ] **Step 1: Create `lib/data-sources/stubs/_helpers.ts`**

```typescript
export type Scenario =
  | 'clean' | 'saman1' | 'black' | 'partial' | 'timeout' | 'worst' | 'default'

export function getScenario(plate: string): Scenario {
  if (plate.startsWith('TEST-CLEAN'))   return 'clean'
  if (plate.startsWith('TEST-SAMAN1')) return 'saman1'
  if (plate.startsWith('TEST-BLACK'))  return 'black'
  if (plate.startsWith('TEST-PARTIAL'))return 'partial'
  if (plate.startsWith('TEST-TIMEOUT'))return 'timeout'
  if (plate.startsWith('TEST-WORST'))  return 'worst'
  return 'default'
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Staggered delays so cards appear ~150ms apart
export const STUB_DELAYS = {
  pdrm:          200,
  jpj:           350,
  aes:           500,
  local_councils:650,
  immigration:   800,
  lhdn:          950,
  ptptn:         1100,
} as const
```

- [ ] **Step 2: Create `lib/data-sources/stubs/pdrm.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class PdrmStub implements DataSourceAdapter {
  readonly sourceId = 'pdrm' as const
  readonly label    = 'PDRM Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.pdrm)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'worst') {
      return { ...base, status: 'hit', data: { source: 'pdrm', samans: [{
        offence: 'Melebihi had laju', date: '2026-01-10', amount: 300,
        currency: 'MYR', location: 'Lebuhraya PLUS KL-Ipoh', discounted: 150, paymentUrl: null,
      }] } }
    }
    return { ...base, status: 'clear', data: { source: 'pdrm', samans: [] } }
  }
}
```

- [ ] **Step 3: Create `lib/data-sources/stubs/jpj.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class JpjStub implements DataSourceAdapter {
  readonly sourceId = 'jpj' as const
  readonly label    = 'JPJ Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.jpj)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'saman1' || scenario === 'default') {
      const count  = scenario === 'saman1' ? 2 : 1
      const amount = scenario === 'saman1' ? 340 : 150
      const samans = Array.from({ length: count }, (_, i) => ({
        offence: 'Memandu melebihi had laju', date: `2026-0${i + 1}-15`,
        amount: amount / count, currency: 'MYR', location: 'Jalan Duta, KL',
        discounted: (amount / count) * 0.5, paymentUrl: null,
      }))
      return { ...base, status: 'hit', data: { source: 'jpj', samans } }
    }
    if (scenario === 'worst') {
      return { ...base, status: 'hit', data: { source: 'jpj', samans: [{
        offence: 'Kereta tidak insurans', date: '2025-11-20',
        amount: 500, currency: 'MYR', location: null, discounted: 250, paymentUrl: null,
      }] } }
    }
    return { ...base, status: 'clear', data: { source: 'jpj', samans: [] } }
  }
}
```

- [ ] **Step 4: Create `lib/data-sources/stubs/aes.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class AesStub implements DataSourceAdapter {
  readonly sourceId = 'aes' as const
  readonly label    = 'AES Saman'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.aes)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'saman1') {
      return { ...base, status: 'hit', data: { source: 'aes', samans: [{
        offence: 'Melebihi had laju (AES Kamera)', date: '2026-02-03',
        amount: 150, currency: 'MYR', location: 'Km 42, Lebuhraya PLUS', discounted: 75, paymentUrl: null,
      }] } }
    }
    return { ...base, status: 'clear', data: { source: 'aes', samans: [] } }
  }
}
```

- [ ] **Step 5: Create `lib/data-sources/stubs/local-councils.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class LocalCouncilsStub implements DataSourceAdapter {
  readonly sourceId = 'local_councils' as const
  readonly label    = 'Local Councils'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.local_councils)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, checkedAt: new Date() } as const

    if (scenario === 'timeout') {
      // withTimeout will resolve this first in the timeout scenario,
      // but return the status here so the stub itself also reflects it
      return { ...base, status: 'timeout', data: null, errorMessage: 'Source did not respond in time' }
    }
    if (scenario === 'worst') {
      return { ...base, status: 'hit', errorMessage: null, data: {
        source: 'local_councils', council: 'DBKL', samans: [{
          offence: 'Letak kereta tanpa tiket', date: '2026-03-01',
          amount: 100, currency: 'MYR', location: 'Jalan Imbi, KL', discounted: 50, paymentUrl: null,
        }],
      } }
    }
    return { ...base, status: 'clear', data: { source: 'local_councils', council: 'DBKL', samans: [] }, errorMessage: null }
  }
}
```

- [ ] **Step 6: Create `lib/data-sources/stubs/immigration.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class ImmigrationStub implements DataSourceAdapter {
  readonly sourceId = 'immigration' as const
  readonly label    = 'Immigration Blacklist'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.immigration)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'black') {
      return { ...base, status: 'hit', data: {
        source: 'immigration', blacklisted: true,
        reason: 'Outstanding court order — contact Immigration Dept',
      } }
    }
    return { ...base, status: 'clear', data: { source: 'immigration', blacklisted: false, reason: null } }
  }
}
```

- [ ] **Step 7: Create `lib/data-sources/stubs/lhdn.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class LhdnStub implements DataSourceAdapter {
  readonly sourceId = 'lhdn' as const
  readonly label    = 'LHDN'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.lhdn)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'partial' || scenario === 'worst') {
      return { ...base, status: 'unavailable', data: null,
        errorMessage: 'LHDN portal is currently unavailable' }
    }
    return { ...base, status: 'clear', data: { source: 'lhdn', blacklisted: false } }
  }
}
```

- [ ] **Step 8: Create `lib/data-sources/stubs/ptptn.ts`**

```typescript
import type { DataSourceAdapter, SourceResult } from '../types'
import { getScenario, delay, STUB_DELAYS } from './_helpers'

export class PtptnStub implements DataSourceAdapter {
  readonly sourceId = 'ptptn' as const
  readonly label    = 'PTPTN'

  async check(plate: string, _ic: string): Promise<SourceResult> {
    await delay(STUB_DELAYS.ptptn)
    const scenario = getScenario(plate)
    const base = { source: this.sourceId, label: this.label, errorMessage: null, checkedAt: new Date() } as const

    if (scenario === 'partial') {
      return { ...base, status: 'unavailable', data: null,
        errorMessage: 'PTPTN portal is currently unavailable' }
    }
    return { ...base, status: 'clear', data: { source: 'ptptn', blacklisted: false, outstanding: null } }
  }
}
```

- [ ] **Step 9: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add lib/data-sources/stubs/
git commit -m "feat: all 7 stub data source adapters with scenario triggers"
```

---

## Task 12: POST /api/checks

**Files:** `app/api/checks/route.ts`

- [ ] **Step 1: Create `app/api/checks/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { plateSchema } from '@/lib/validation/plate'
import { icSchema }    from '@/lib/validation/ic'
import { encrypt, hash } from '@/lib/crypto'
import { getAdapters, withTimeout } from '@/lib/data-sources'
import {
  createCheck,
  setCheckRunning,
  setCheckComplete,
  updateCheckResult,
  getCachedCheck,
  getCheckByIdempotencyKey,
} from '@/lib/db/checks'

const requestSchema = z.object({
  plate:           plateSchema,
  ic:              icSchema,
  idempotencyKey:  z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { plate, ic, idempotencyKey } = parsed.data

  // Idempotency check
  if (idempotencyKey) {
    const existing = await getCheckByIdempotencyKey(idempotencyKey)
    if (existing) {
      return NextResponse.json({ checkId: existing.id })
    }
  }

  // Cache check
  const plateHash = hash(plate)
  const icHash    = hash(ic)
  const cached    = await getCachedCheck(plateHash, icHash)
  if (cached) {
    return NextResponse.json({ checkId: cached.id, claimToken: cached.claim_token })
  }

  // Create check
  const checkId    = 'ch_' + nanoid(10)
  const claimToken = crypto.randomUUID()
  const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await createCheck({
    id:             checkId,
    plateEncrypted: encrypt(plate),
    plateHash,
    icEncrypted:    encrypt(ic),
    icHash,
    claimToken,
    idempotencyKey,
    expiresAt,
  })

  // Fire-and-forget processing (safe for stub phase — resolves in <1s)
  void (async () => {
    try {
      await setCheckRunning(checkId)
      const adapters = getAdapters().map((a) => withTimeout(a))
      await Promise.all(
        adapters.map(async (adapter) => {
          const result = await adapter.check(plate, ic)
          await updateCheckResult(checkId, result)
        })
      )
      await setCheckComplete(checkId)
    } catch (err) {
      console.error('[checks] processing error', checkId, err)
    }
  })()

  return NextResponse.json({ checkId, claimToken }, { status: 201 })
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Smoke-test with curl (dev server running)**

```bash
pnpm dev &
curl -s -X POST http://localhost:3000/api/checks \
  -H 'Content-Type: application/json' \
  -d '{"plate":"TEST-SAMAN1","ic":"880614105421","idempotencyKey":"'$(uuidgen)'"}'
```

Expected: `{"checkId":"ch_XXXXXXXXXX","claimToken":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}`

- [ ] **Step 4: Commit**

```bash
git add app/api/checks/route.ts
git commit -m "feat: POST /api/checks — create check with cache + idempotency"
```

---

## Task 13: GET /api/checks/[id]

**Files:** `app/api/checks/[id]/route.ts`

- [ ] **Step 1: Create `app/api/checks/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
import { getCheck }  from '@/lib/db/checks'
import { createClient } from '@/lib/supabase/server'

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix:  'paqar:poll',
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit by IP
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const claimToken = request.nextUrl.searchParams.get('claim_token') ?? undefined

  // Check session for authenticated users
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const row = await getCheck(params.id, claimToken)
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authorise: must be owner or have valid claim_token
  const isOwner       = user != null && row.check.user_id === user.id
  // getCheck already validated claim_token match; if claim_token is now null the check was
  // claimed — only the owner can access it
  const hasValidToken = claimToken != null && row.check.claim_token !== null

  if (!isOwner && !hasValidToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return NextResponse.json(row)
}
```

- [ ] **Step 2: Smoke-test (poll the check from Task 12)**

```bash
CHECK_ID="ch_XXXXXXXXXX"   # replace with ID from Task 12
CLAIM_TOKEN="xxxxxxxx-..."  # replace with claimToken from Task 12
curl -s "http://localhost:3000/api/checks/$CHECK_ID?claim_token=$CLAIM_TOKEN"
```

Expected: JSON with `check.status` of `"complete"` and `results` array of 7 items.

- [ ] **Step 3: Commit**

```bash
git add app/api/checks/
git commit -m "feat: GET /api/checks/[id] — poll results with rate limiting"
```

---

## Task 14: App layout, Nav, Shell

**Files:** `app/globals.css`, `app/layout.tsx`, `components/layout/Nav.tsx`, `components/layout/Shell.tsx`

- [ ] **Step 1: Update `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand: #0f766e;
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Paqar — Malaysian Car Ownership Check',
  description: 'Check saman, blacklist status, and document expiries for your car.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white font-sans antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Create `components/layout/Nav.tsx`**

```typescript
import Link from 'next/link'

export function Nav() {
  return (
    <nav className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-teal-700 flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-sm" />
        </div>
        <span className="font-extrabold text-slate-900 tracking-tight">Paqar</span>
      </Link>
      <Link href="/auth" className="text-sm text-teal-700 font-semibold hover:underline">
        Sign in
      </Link>
    </nav>
  )
}
```

- [ ] **Step 4: Create `components/layout/Shell.tsx`**

```typescript
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      {children}
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx components/layout/
git commit -m "feat: app layout, Nav, and Shell components"
```

---

## Task 15: CheckForm component

**Files:** `components/check/CheckForm.tsx`

- [ ] **Step 1: Create `components/check/CheckForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import type { CreateCheckResponse } from '@/types/api'

export function CheckForm() {
  const router = useRouter()
  const [plate, setPlate]     = useState('')
  const [ic, setIc]           = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate, ic, idempotencyKey }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string }
        setError(msg ?? 'Something went wrong')
        return
      }

      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      router.push(`/check/${checkId}?claim_token=${claimToken}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="plate" className="text-xs font-semibold uppercase tracking-widest text-slate-900">
          Plate number
        </Label>
        <Input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="WVP 1234"
          className="mt-1.5 font-semibold tracking-widest text-base"
          autoComplete="off"
          required
        />
      </div>

      <div>
        <Label htmlFor="ic" className="text-xs font-semibold uppercase tracking-widest text-slate-900">
          IC number
        </Label>
        <Input
          id="ic"
          value={ic}
          onChange={(e) => setIc(e.target.value)}
          placeholder="880614-10-5421"
          inputMode="numeric"
          className="mt-1.5 text-base"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3 text-sm"
      >
        {loading ? 'Checking…' : 'Run check →'}
      </Button>

      <p className="text-xs text-slate-400 text-center">
        Your IC is encrypted and never stored in plain text.
      </p>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/check/CheckForm.tsx
git commit -m "feat: CheckForm component with plate + IC inputs"
```

---

## Task 16: ResultCard and ResultsStream components

**Files:** `components/check/ResultCard.tsx`, `components/check/ResultsStream.tsx`

- [ ] **Step 1: Create `components/check/ResultCard.tsx`**

```typescript
import type { CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord } from '@/types/api'
import { Badge } from '@/components/ui/badge'

const STATUS_STYLES = {
  pending:     'bg-slate-50 border-slate-200',
  clear:       'bg-green-50 border-green-200',
  hit:         'bg-red-50 border-red-200',
  unavailable: 'bg-slate-50 border-slate-200',
  timeout:     'bg-slate-50 border-slate-200',
  partial:     'bg-amber-50 border-amber-200',
  error:       'bg-slate-50 border-slate-200',
}

const DOT_STYLES = {
  pending:     'bg-slate-200',
  clear:       'bg-green-500',
  hit:         'bg-red-600',
  unavailable: 'bg-slate-300',
  timeout:     'bg-slate-300',
  partial:     'bg-amber-400',
  error:       'bg-slate-300',
}

const LABEL_STYLES = {
  pending:     'text-slate-400',
  clear:       'text-green-700',
  hit:         'text-red-700',
  unavailable: 'text-slate-400',
  timeout:     'text-slate-400',
  partial:     'text-amber-700',
  error:       'text-slate-400',
}

function renderDetail(result: CheckResult): string | null {
  if (result.status === 'pending')     return 'Checking…'
  if (result.status === 'unavailable') return "Couldn't reach this source right now"
  if (result.status === 'timeout')     return "Couldn't reach this source right now"
  if (result.status === 'error')       return "Couldn't reach this source right now"
  if (result.status === 'clear')       return 'Clear'

  const data = result.data as SourceData | null
  if (!data) return null

  if ('samans' in data && data.samans.length > 0) {
    const total = data.samans.reduce((s: number, r: SamanRecord) => s + r.amount, 0)
    return `${data.samans.length} saman · RM${total}`
  }
  if ('blacklisted' in data && data.blacklisted) return 'Blacklisted'
  return 'Clear'
}

export function ResultCard({ result }: { result: CheckResult }) {
  const s = result.status as keyof typeof STATUS_STYLES
  return (
    <div
      className={`rounded-xl border-[1.5px] px-4 py-3 flex items-center justify-between transition-all duration-300 ${STATUS_STYLES[s]}`}
    >
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${LABEL_STYLES[s]}`}>
          {result.label}
        </p>
        <p className="text-sm font-bold text-slate-900 mt-0.5">
          {renderDetail(result) ?? '—'}
        </p>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_STYLES[s]}`} />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/check/ResultsStream.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }  from 'next/navigation'
import { Progress }   from '@/components/ui/progress'
import { Button }     from '@/components/ui/button'
import { ResultCard } from './ResultCard'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'
import type { Check, CheckResult } from '@/types/domain'
import type { PollCheckResponse } from '@/types/api'

const POLL_INTERVAL_MS = 1_500
const TOTAL_SOURCES    = 7

interface Props {
  checkId:    string
  claimToken: string
}

export function ResultsStream({ checkId, claimToken }: Props) {
  const router = useRouter()
  const [check,      setCheck]      = useState<Check | null>(null)
  const [results,    setResults]    = useState<CheckResult[]>([])
  const [error,      setError]      = useState<string | null>(null)
  const [authedUser, setAuthedUser] = useState<string | null | undefined>(undefined)

  // Resolve current auth state once on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setAuthedUser(data.user?.id ?? null)
    })
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/checks/${checkId}?claim_token=${encodeURIComponent(claimToken)}`
      )
      if (!res.ok) { setError('Could not load results'); return }
      const data = await res.json() as PollCheckResponse
      setCheck(data.check)
      setResults(data.results)
    } catch {
      setError('Network error — retrying…')
    }
  }, [checkId, claimToken])

  useEffect(() => {
    void poll()
    const interval = setInterval(() => {
      if (check?.status === 'complete') { clearInterval(interval); return }
      void poll()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [poll, check?.status])

  // Auto-claim: authenticated user lands on an unclaimed check
  useEffect(() => {
    if (
      check?.status === 'complete' &&
      authedUser != null &&
      check.user_id == null &&
      check.claim_token != null
    ) {
      void claimCheck(check.claim_token, authedUser).then(() => void poll())
    }
  }, [check, authedUser, poll])

  const completedCount = results.filter((r) => r.status !== 'pending').length
  const isComplete     = check?.status === 'complete'

  // Show "Save" CTA only when check is complete, unclaimed, and user is not authenticated
  const showSaveCta = isComplete && check?.user_id == null && authedUser === null

  if (error) return <p className="text-sm text-red-600 py-4">{error}</p>

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span className="font-semibold text-teal-700">
            {isComplete ? 'Check complete' : 'Checking 7 sources'}
          </span>
          <span>{completedCount} of {TOTAL_SOURCES}</span>
        </div>
        <Progress
          value={(completedCount / TOTAL_SOURCES) * 100}
          className="h-1 bg-slate-100 [&>div]:bg-teal-700"
        />
      </div>

      {/* Result cards */}
      <div className="space-y-2">
        {results.map((result) => (
          <ResultCard key={result.source} result={result} />
        ))}
      </div>

      {/* Save & create account CTA */}
      {showSaveCta && (
        <div className="border-[1.5px] border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
          <p className="text-sm font-semibold text-teal-800 mb-1">
            Get notified if anything changes
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Save this vehicle to your account and we'll alert you if new saman or blacklist entries appear.
          </p>
          <Button
            onClick={() => {
              const next = `/check/${checkId}?claim_token=${claimToken}`
              router.push(`/auth?claim_token=${claimToken}&next=${encodeURIComponent(next)}`)
            }}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm"
          >
            Save &amp; create account
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/check/
git commit -m "feat: ResultCard and ResultsStream polling components"
```

---

## Task 17: Landing page

**Files:** `app/page.tsx`

- [ ] **Step 1: Create `app/page.tsx`**

```typescript
import { Nav }       from '@/components/layout/Nav'
import { Shell }     from '@/components/layout/Shell'
import { CheckForm } from '@/components/check/CheckForm'

export default function HomePage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Check your car.
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Saman, blacklist &amp; document status in one place.
          </p>
        </div>
        <CheckForm />
      </Shell>
    </>
  )
}
```

- [ ] **Step 2: Start dev server and verify the page renders**

```bash
pnpm dev
```

Open `http://localhost:3000` — should see Nav with Paqar logo, heading, plate + IC inputs, teal "Run check" button.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: landing page with check form"
```

---

## Task 18: Results page

**Files:** `app/check/[id]/page.tsx`

- [ ] **Step 1: Create `app/check/[id]/page.tsx`**

```typescript
import { notFound }      from 'next/navigation'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { ResultsStream } from '@/components/check/ResultsStream'

interface Props {
  params:      { id: string }
  searchParams: { claim_token?: string }
}

export default function CheckPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) notFound()

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-4 pb-4">
          <p className="text-[11px] font-bold text-teal-700 uppercase tracking-widest mb-1">
            {params.id}
          </p>
        </div>
        <ResultsStream checkId={params.id} claimToken={claimToken} />
      </Shell>
    </>
  )
}
```

- [ ] **Step 2: End-to-end test — happy path**

1. Go to `http://localhost:3000`
2. Enter plate `TEST-SAMAN1`, IC `880614105421`
3. Click "Run check →"
4. Should redirect to `/check/ch_...?claim_token=...`
5. Should see progress bar advance, cards appearing one by one
6. JPJ card should show "2 saman · RM340", AES should show "1 saman · RM150"
7. All other cards should be "Clear"

- [ ] **Step 3: End-to-end test — degradation path**

1. Enter plate `TEST-PARTIAL`
2. LHDN and PTPTN cards should show "Couldn't reach this source right now" in grey, not missing

- [ ] **Step 4: Commit**

```bash
git add app/check/
git commit -m "feat: results page with streaming card reveal"
```

---

## Task 19: Auth components and page

**Files:** `components/auth/PhoneOtpForm.tsx`, `components/auth/MagicLinkForm.tsx`, `components/auth/AuthShell.tsx`, `app/auth/page.tsx`

- [ ] **Step 1: Create `components/auth/PhoneOtpForm.tsx`**

```typescript
'use client'

import { useState }     from 'react'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'

type State = 'phone' | 'otp'

interface Props {
  claimToken?: string
  redirectTo:  string
  onEmailClick: () => void
}

export function PhoneOtpForm({ claimToken, redirectTo, onEmailClick }: Props) {
  const [state,    setState]    = useState<State>('phone')
  const [phone,    setPhone]    = useState('+60')
  const [otp,      setOtp]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const supabase = createClient()

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Check client-side rate limit before hitting Supabase (server enforces the real limit)
    const res = await fetch('/api/auth/otp-rate-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    if (!res.ok) {
      setError('Too many OTP requests. Please wait before trying again.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.signInWithOtp({ phone })
    if (err) { setError(err.message); setLoading(false); return }
    setState('otp')
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone, token: otp, type: 'sms',
    })
    if (err || !data.user) { setError(err?.message ?? 'Verification failed'); setLoading(false); return }
    if (claimToken) await claimCheck(claimToken, data.user.id)
    window.location.href = redirectTo
  }

  if (state === 'otp') {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <p className="text-sm text-slate-500">
          Enter the 6-digit code sent to <strong>{phone}</strong>
        </p>
        <div>
          <Label htmlFor="otp" className="text-xs font-semibold uppercase tracking-widest">OTP</Label>
          <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="123456" inputMode="numeric" maxLength={6} className="mt-1.5 tracking-[.3em] text-lg font-bold" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
          {loading ? 'Verifying…' : 'Verify →'}
        </Button>
        <button type="button" onClick={() => setState('phone')}
          className="w-full text-sm text-slate-400 hover:text-teal-700 text-center">
          ← Change number
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendOtp} className="space-y-4">
      <div>
        <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-widest">
          Phone number
        </Label>
        <div className="flex gap-2 mt-1.5">
          <div className="bg-slate-50 border border-slate-200 rounded-md px-3 flex items-center text-sm font-semibold text-slate-700 whitespace-nowrap">
            +60
          </div>
          <Input id="phone" value={phone.replace(/^\+60/, '')}
            onChange={(e) => setPhone('+60' + e.target.value.replace(/^0/, ''))}
            placeholder="12-345 6789" inputMode="tel" className="flex-1 text-base" required />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
        {loading ? 'Sending…' : 'Send OTP →'}
      </Button>
      <div className="text-center">
        <span className="text-sm text-slate-400">Prefer email? </span>
        <button type="button" onClick={onEmailClick}
          className="text-sm text-teal-700 font-semibold hover:underline">
          Get a magic link
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `components/auth/MagicLinkForm.tsx`**

```typescript
'use client'

import { useState }     from 'react'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface Props {
  claimToken?: string
  redirectTo:  string
  onBack:      () => void
}

export function MagicLinkForm({ claimToken, redirectTo, onBack }: Props) {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', redirectTo)
    if (claimToken) callbackUrl.searchParams.set('claim_token', claimToken)

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold text-slate-900">Check your email</p>
        <p className="text-sm text-slate-500">
          We sent a sign-in link to <strong>{email}</strong>. It expires in 10 minutes.
        </p>
        <button onClick={onBack} className="text-sm text-teal-700 font-semibold hover:underline">
          ← Back to phone
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest">Email</Label>
        <Input id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" className="mt-1.5 text-base" required />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
        {loading ? 'Sending…' : 'Send magic link →'}
      </Button>
      <button type="button" onClick={onBack}
        className="w-full text-sm text-slate-400 hover:text-teal-700 text-center">
        ← Back to phone sign-in
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create `components/auth/AuthShell.tsx`**

```typescript
'use client'

import { useState }        from 'react'
import { PhoneOtpForm }    from './PhoneOtpForm'
import { MagicLinkForm }   from './MagicLinkForm'

interface Props {
  claimToken?: string
  redirectTo:  string
}

export function AuthShell({ claimToken, redirectTo }: Props) {
  const [mode, setMode] = useState<'phone' | 'email'>('phone')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1">
          Save your check and get alerts when anything changes.
        </p>
      </div>

      {mode === 'phone'
        ? <PhoneOtpForm claimToken={claimToken} redirectTo={redirectTo}
            onEmailClick={() => setMode('email')} />
        : <MagicLinkForm claimToken={claimToken} redirectTo={redirectTo}
            onBack={() => setMode('phone')} />
      }
    </div>
  )
}
```

- [ ] **Step 4: Create `app/auth/_actions.ts`**

```typescript
'use server'

import { claimCheck as dbClaimCheck } from '@/lib/db/checks'

export async function claimCheck(claimToken: string, userId: string): Promise<void> {
  await dbClaimCheck(claimToken, userId)
}
```

- [ ] **Step 5: Create `app/auth/page.tsx`**

```typescript
import { Nav }       from '@/components/layout/Nav'
import { Shell }     from '@/components/layout/Shell'
import { AuthShell } from '@/components/auth/AuthShell'

interface Props {
  searchParams: { claim_token?: string; next?: string }
}

export default function AuthPage({ searchParams }: Props) {
  const redirectTo = searchParams.next ?? '/'

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6">
          <AuthShell
            claimToken={searchParams.claim_token}
            redirectTo={redirectTo}
          />
        </div>
      </Shell>
    </>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/auth/ app/auth/page.tsx app/auth/_actions.ts
git commit -m "feat: auth components — phone OTP primary, email magic link secondary"
```

---

## Task 20: Auth callback route

**Files:** `app/auth/callback/route.ts`

- [ ] **Step 1: Create `app/auth/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { claimCheck }    from '@/lib/db/checks'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code       = searchParams.get('code')
  const next       = searchParams.get('next') ?? '/'
  const claimToken = searchParams.get('claim_token') ?? undefined

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user && claimToken) {
      await claimCheck(claimToken, data.user.id)
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback/
git commit -m "feat: auth callback — exchange code, claim check, redirect"
```

---

## Task 21: OTP rate-limit endpoint

**Files:** `app/api/auth/otp-rate-check/route.ts`

- [ ] **Step 1: Create `app/api/auth/otp-rate-check/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'
import { z }         from 'zod'
import { phoneSchema } from '@/lib/validation/phone'

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, '1 h'),
  prefix:  'paqar:otp',
})

const schema = z.object({ phone: phoneSchema })

export async function POST(request: NextRequest) {
  const body   = await request.json() as unknown
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
  }

  // Key is the normalised phone number — 3 OTPs per phone per hour
  const { success, remaining } = await ratelimit.limit(parsed.data.phone)
  if (!success) {
    return NextResponse.json(
      { error: 'OTP rate limit exceeded', remaining: 0 },
      { status: 429 }
    )
  }

  return NextResponse.json({ ok: true, remaining })
}
```

- [ ] **Step 2: Add the new file path to the File Map at the top of this plan**

Add `app/api/auth/otp-rate-check/route.ts` under `app/api/checks/` in the File Map.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/
git commit -m "feat: OTP rate-limit endpoint — 3 requests per phone per hour"
```

---

## Task 23: Stub dashboard

**Files:** `app/dashboard/page.tsx`

- [ ] **Step 1: Create `app/dashboard/page.tsx`**

```typescript
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-8 text-center">
          <p className="text-slate-400 text-sm">Dashboard coming in Feature 3.</p>
        </div>
      </Shell>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/
git commit -m "feat: stub dashboard page"
```

---

## Task 24: Analytics and error tracking

**Files:** `lib/analytics.ts`, Sentry config

- [ ] **Step 1: Create `lib/analytics.ts`**

```typescript
import posthog from 'posthog-js'

let initialised = false

export function initAnalytics() {
  if (initialised || typeof window === 'undefined') return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host:        process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
  })
  initialised = true
}

export const analytics = {
  checkStarted: (props: { country: string; is_test: boolean }) =>
    posthog.capture('check_started', props),

  checkCompleted: (props: {
    country: string; status: string;
    hit_count: number; unavailable_count: number; is_test: boolean
  }) => posthog.capture('check_completed', props),

  authStarted:    (props: { method: 'phone' | 'email' }) =>
    posthog.capture('auth_started', props),

  authCompleted:  (props: { method: 'phone' | 'email'; is_new_user: boolean }) =>
    posthog.capture('auth_completed', props),

  checkClaimed:   (props: { method: 'phone' | 'email' }) =>
    posthog.capture('check_claimed', props),
}
```

- [ ] **Step 2: Initialise analytics in `app/layout.tsx`**

Add a client component wrapper. Create `components/layout/AnalyticsProvider.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { initAnalytics } from '@/lib/analytics'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { initAnalytics() }, [])
  return <>{children}</>
}
```

Update `app/layout.tsx` — wrap `{children}` with `<AnalyticsProvider>`:

```typescript
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'
// ...
<body className="bg-white font-sans antialiased">
  <AnalyticsProvider>{children}</AnalyticsProvider>
</body>
```

- [ ] **Step 3: Configure Sentry**

```bash
pnpm dlx @sentry/wizard@latest -i nextjs --skip-connect-git
```

Follow prompts. This creates `sentry.client.config.ts`, `sentry.server.config.ts`, and updates `next.config.ts`.

Add PII scrubbing to `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    // Strip PII fields from all events before sending
    const PII_KEYS = ['plate','ic','plate_encrypted','ic_encrypted','claim_token']
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>
      PII_KEYS.forEach((k) => { if (k in data) data[k] = '[Filtered]' })
    }
    return event
  },
})
```

Apply the same `beforeSend` to `sentry.server.config.ts`.

- [ ] **Step 4: Final TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all passing

- [ ] **Step 6: Commit**

```bash
git add lib/analytics.ts components/layout/AnalyticsProvider.tsx \
  app/layout.tsx sentry.client.config.ts sentry.server.config.ts next.config.ts
git commit -m "feat: PostHog analytics and Sentry error tracking with PII scrubbing"
```

---

## Task 25: Full verification pass

- [ ] **Step 1: Scaffold**

```bash
pnpm dev
```

Open `http://localhost:3000` — page renders, no console errors.

- [ ] **Step 2: Env validation**

Temporarily remove `AES_KEY` from `.env.local`, run `pnpm dev`.
Expected: server throws with message listing the missing field.
Restore `AES_KEY`.

- [ ] **Step 3: Check flow — happy path**

Submit plate `TEST-SAMAN1` + IC `880614105421`.
Expected: redirected to `/check/ch_...`, cards stream in, JPJ shows "2 saman · RM340", AES shows "1 saman · RM150", all others clear.

- [ ] **Step 4: Check flow — degradation**

Submit `TEST-PARTIAL`. Expected: LHDN and PTPTN cards show "Couldn't reach this source right now" in grey — never missing.

- [ ] **Step 5: Cache hit**

Submit the same plate+IC twice. Expected: second response returns immediately, same `checkId`.

- [ ] **Step 6: Idempotency**

POST to `/api/checks` twice with the same `idempotencyKey` UUID. Expected: same `checkId` both times.

- [ ] **Step 7: Auth — phone OTP layout**

Click "Run check" on any plate, then click "Save & create account". Expected: `/auth` page shows phone input prominently, "Get a magic link" as small text link below.

- [ ] **Step 8: TypeScript strict**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 9: All tests**

```bash
pnpm test
```

Expected: all passing

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "feat: complete Feature 1 — saman/blacklist check with stub data"
```
