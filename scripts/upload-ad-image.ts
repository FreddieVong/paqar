import { readFileSync, statSync } from 'fs'

/**
 * Uploads one image to the Meta ad account's media library and prints its hash.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/upload-ad-image.ts <file.png>
 *
 * The hash it prints is what create-reviewed-offer.ts wants for --image-hash.
 *
 * Goes through lib/meta-ads/client so the ALLOW_PAUSED_CREATION kill switch and
 * the size check apply. Uploading does not create an ad, does not attach the
 * image to anything, and cannot spend — the image simply sits in the library
 * until createAdCreative references it.
 */
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(line)
    if (m?.[1]) process.env[m[1]] ??= (m[2] ?? '').replace(/^["']|["']$/g, '')
  }
} catch { /* env already exported */ }

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npx tsx scripts/upload-ad-image.ts <file.png>')
    process.exit(1)
  }

  let size: number
  try {
    size = statSync(file).size
  } catch {
    console.error(`✗ Cannot read ${file}`)
    process.exit(1)
  }

  const { uploadAdImage } = await import('../lib/meta-ads/client')

  console.log(`uploading ${file}  (${(size / 1024).toFixed(0)} KB)`)
  const { hash, url } = await uploadAdImage(readFileSync(file))

  console.log(`\n✓ hash  ${hash}`)
  if (url) console.log(`  url   ${url}`)
  console.log('\nNext:')
  console.log('  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/create-reviewed-offer.ts \\')
  console.log(`    --image-hash ${hash}`)
  console.log('  (add --confirm once the dry run reads correctly)')
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
