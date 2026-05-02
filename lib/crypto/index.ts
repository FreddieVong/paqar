import 'server-only'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

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

/** SHA-256 of value.toUpperCase() with whitespace and hyphens stripped. Returns hex string. */
export function hash(value: string): string {
  const normalised = value.toUpperCase().replace(/[\s\-]/g, '')
  return createHash('sha256').update(normalised).digest('hex')
}
