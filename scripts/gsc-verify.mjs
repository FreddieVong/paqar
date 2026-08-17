#!/usr/bin/env node
// Search Console access check. READ-ONLY, and structurally incapable of being
// anything else.
//
// WHY THIS EXISTS. Every ranking figure in docs/seo/REVENUE-PILOT-2026-08-14.md
// is marked [user-supplied] — transcribed from exports, never verified — because
// this environment has no Search Console access. That is the largest gap in the
// report, and this script is the smallest thing that closes it.
//
// WHAT IT DOES. Lists the properties the service account can read, and exits.
// It fetches no metrics, submits no sitemap, and requests no indexing. Those
// are separate jobs; this one only answers "is access working?".
//
// SCOPE. https://www.googleapis.com/auth/webmasters.readonly — the read-only
// scope. Not `webmasters` (read/write), and the Search Console role required is
// Restricted, not Owner. A token minted here cannot submit a sitemap, request
// indexing, remove a URL, or change any setting, even if the code tried.
//
// SECRETS. The key never appears in output. This script prints property URLs,
// permission levels, and the service-account e-mail — which is not a secret and
// is the one value you need in order to grant access. It never prints the
// private key, the token, or the raw JSON, and it does not write them anywhere.
//
// CREDENTIAL LOCATION, in the order tried:
//
//   1. $GSC_SERVICE_ACCOUNT_KEY_FILE   absolute path to the JSON key
//   2. ~/.config/paqar/gsc-service-account.json   the default, outside the repo
//   3. $GSC_SERVICE_ACCOUNT_JSON       the JSON itself, for CI secret stores
//
// The default path is deliberately outside the repository: a key inside a git
// worktree is one `git add -A` away from being committed. .gitignore also
// covers the in-repo filename as a second line of defence, but the first line
// is not putting it there.
//
// Usage:  node scripts/gsc-verify.mjs

import { readFileSync, existsSync } from 'fs'
import { createSign } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'

const SCOPE      = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL  = 'https://oauth2.googleapis.com/token'
const SITES_URL  = 'https://www.googleapis.com/webmasters/v3/sites'
const DEFAULT_KEY_PATH = join(homedir(), '.config', 'paqar', 'gsc-service-account.json')

function die(message, hint) {
  console.error(`✗ ${message}`)
  if (hint) console.error(`\n${hint}`)
  process.exit(1)
}

// ── Load the key ────────────────────────────────────────────────────────────

function loadKey() {
  const explicitPath = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE
  const inlineJson   = process.env.GSC_SERVICE_ACCOUNT_JSON

  let raw = null
  let source = null

  if (explicitPath) {
    if (!existsSync(explicitPath)) die(`GSC_SERVICE_ACCOUNT_KEY_FILE is set but no file exists at that path`)
    raw = readFileSync(explicitPath, 'utf8')
    source = 'GSC_SERVICE_ACCOUNT_KEY_FILE'
  } else if (existsSync(DEFAULT_KEY_PATH)) {
    raw = readFileSync(DEFAULT_KEY_PATH, 'utf8')
    source = DEFAULT_KEY_PATH
  } else if (inlineJson) {
    raw = inlineJson
    source = 'GSC_SERVICE_ACCOUNT_JSON'
  } else {
    die(
      'No Search Console credential found.',
      [
        'Provide one of:',
        `  · a JSON key at ${DEFAULT_KEY_PATH}`,
        '  · $GSC_SERVICE_ACCOUNT_KEY_FILE pointing at a JSON key',
        '  · $GSC_SERVICE_ACCOUNT_JSON containing the JSON itself',
        '',
        'Setup steps are in docs/seo/REVENUE-PILOT-2026-08-14.md, section 18.',
      ].join('\n')
    )
  }

  let key
  try {
    key = JSON.parse(raw)
  } catch {
    // Deliberately does not echo the content.
    die(`Credential from ${source} is not valid JSON`)
  }

  for (const field of ['client_email', 'private_key', 'token_uri']) {
    if (!key[field]) die(`Credential from ${source} is missing "${field}" — is this a service-account key?`)
  }
  if (key.type !== 'service_account') {
    die(`Credential from ${source} has type "${key.type}" — expected "service_account"`)
  }

  return { key, source }
}

// ── Mint a read-only token ──────────────────────────────────────────────────

const b64url = buf => Buffer.from(buf).toString('base64url')

async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims  = b64url(JSON.stringify({
    iss:   key.client_email,
    scope: SCOPE,                 // read-only, and the only scope requested
    aud:   key.token_uri || TOKEN_URL,
    iat:   now,
    exp:   now + 3600,
  }))

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = b64url(signer.sign(key.private_key))
  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch(key.token_uri || TOKEN_URL, {
    method:  'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    // Google's error body can echo the assertion. Report the status and its
    // short error code only — never the body.
    let code = ''
    try { code = (await res.json()).error ?? '' } catch { /* ignore */ }
    die(
      `Token request failed (HTTP ${res.status}${code ? `, ${code}` : ''})`,
      'Common causes: the Search Console API is not enabled on the project, or the key has been revoked.'
    )
  }

  const { access_token } = await res.json()
  if (!access_token) die('Token response contained no access_token')
  return access_token
}

// ── List properties ─────────────────────────────────────────────────────────

async function main() {
  const { key, source } = loadKey()

  console.log('Search Console access check')
  console.log('─'.repeat(60))
  console.log(`credential source : ${source === 'GSC_SERVICE_ACCOUNT_JSON' ? 'GSC_SERVICE_ACCOUNT_JSON (inline)' : source}`)
  // Not a secret, and the value you paste into Search Console to grant access.
  console.log(`service account   : ${key.client_email}`)
  console.log(`scope             : ${SCOPE}`)
  console.log('')

  const token = await accessToken(key)

  const res = await fetch(SITES_URL, { headers: { authorization: `Bearer ${token}` } })
  if (res.status === 403) {
    die(
      'Authenticated, but not authorised for any property (HTTP 403).',
      `Add ${key.client_email} in Search Console → Settings → Users and permissions,\nwith the Restricted role. Nothing higher is needed.`
    )
  }
  if (!res.ok) die(`Property list failed (HTTP ${res.status})`)

  const { siteEntry = [] } = await res.json()

  if (siteEntry.length === 0) {
    console.log('✓ Authenticated, but the account has access to no properties yet.')
    console.log(`\n  Add ${key.client_email} in Search Console → Settings →`)
    console.log('  Users and permissions, with the Restricted role.')
    process.exit(0)
  }

  console.log(`properties (${siteEntry.length}):`)
  for (const s of siteEntry) {
    console.log(`  ${String(s.permissionLevel ?? '?').padEnd(18)} ${s.siteUrl}`)
  }

  const paqar = siteEntry.filter(s => String(s.siteUrl).includes('paqar.my'))
  console.log('')
  if (paqar.length === 0) {
    console.log('⚠ No paqar.my property in the list — access was granted to a different property.')
    process.exit(1)
  }

  console.log(`✓ Read access to ${paqar.length} paqar.my ${paqar.length === 1 ? 'property' : 'properties'}.`)
  console.log('  Search Console figures in docs/seo/ can now be marked [measured].')
}

main().catch(err => {
  // Never print err.stack: a fetch error can carry the request body.
  die(`Unexpected failure: ${err?.message ?? 'unknown error'}`)
})
