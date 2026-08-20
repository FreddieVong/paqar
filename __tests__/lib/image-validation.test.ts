import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  validateImage, mediaTypeFor, MAX_BYTES, MIN_DIMENSION, MAX_DIMENSION,
} from '@/lib/image-validation'

/** Real headers, hand-built — the bytes are the whole subject of this suite. */
function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(24)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  new DataView(b.buffer).setUint32(16, w)
  new DataView(b.buffer).setUint32(20, h)
  return b
}

function jpeg(w: number, h: number): Uint8Array {
  // SOI, then an APP0 segment to prove the scanner walks the chain, then SOF0.
  const b = new Uint8Array(40)
  b.set([0xff, 0xd8], 0)
  b.set([0xff, 0xe0, 0x00, 0x10], 2)          // APP0, length 16
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08], 20)   // SOF0
  new DataView(b.buffer).setUint16(25, h)
  new DataView(b.buffer).setUint16(27, w)
  return b
}

function webpVP8L(w: number, h: number): Uint8Array {
  const b = new Uint8Array(40)
  b.set([0x52, 0x49, 0x46, 0x46], 0)          // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8)          // WEBP
  b.set([0x56, 0x50, 0x38, 0x4c], 12)         // VP8L
  const bits = ((h - 1) << 14) | (w - 1)
  new DataView(b.buffer).setUint32(21, bits, true)
  return b
}

describe('format is decided by bytes, never by a claim', () => {
  it.each([
    ['png',  png(1080, 1920)],
    ['jpeg', jpeg(1080, 1920)],
    ['webp', webpVP8L(1080, 1920)],
  ])('accepts a real %s and reads its dimensions', (fmt, bytes) => {
    const r = validateImage(bytes)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.image.format).toBe(fmt)
      expect(r.image.width).toBe(1080)
      expect(r.image.height).toBe(1920)
    }
  })

  it('refuses a file whose name and MIME would have said png', () => {
    // The caller may believe this is a PNG. The bytes disagree, and the bytes win.
    const r = validateImage(new TextEncoder().encode('this is plain text'))
    expect(r).toEqual({ ok: false, reason: 'unsupported_format' })
  })
})

/**
 * A polyglot is simultaneously a valid image and a valid HTML/SVG document.
 * Served with any trust it becomes stored XSS, and the account most exposed
 * here is the reviewer holding ADMIN_SECRET.
 */
describe('polyglots and markup are refused', () => {
  it.each([
    ['svg',      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['html',     '<!DOCTYPE html><html><body><script>alert(1)</script>'],
    ['xml',      '<?xml version="1.0"?><svg/>'],
    ['bare script', '<script>alert(1)</script>'],
  ])('refuses a %s payload', (_l, text) => {
    const r = validateImage(new TextEncoder().encode(text))
    expect(r).toEqual({ ok: false, reason: 'markup_detected' })
  })

  it('refuses a file that leads with a valid PNG signature but carries markup', () => {
    const head = png(1080, 1920)
    const evil = new TextEncoder().encode('<script>alert(document.cookie)</script>')
    const both = new Uint8Array(head.length + evil.length)
    both.set(head); both.set(evil, head.length)

    // Markup is checked BEFORE the format precisely so a valid signature
    // cannot be used as a passport.
    expect(validateImage(both)).toEqual({ ok: false, reason: 'markup_detected' })
  })
})

describe('size and dimension bounds', () => {
  it('refuses an empty file', () => {
    expect(validateImage(new Uint8Array(0))).toEqual({ ok: false, reason: 'empty' })
  })

  it('refuses a file over the byte ceiling', () => {
    const big = new Uint8Array(MAX_BYTES + 1)
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    expect(validateImage(big)).toEqual({ ok: false, reason: 'too_large' })
  })

  it('refuses something too small to read text from', () => {
    expect(validateImage(png(MIN_DIMENSION - 1, 800))).toEqual({ ok: false, reason: 'too_small' })
  })

  /** A decompression bomb is small on disk and gigapixels in memory. */
  it('refuses declared dimensions above the ceiling before any decoder runs', () => {
    expect(validateImage(png(MAX_DIMENSION + 1, 800)))
      .toEqual({ ok: false, reason: 'too_large_dimensions' })
  })

  it('refuses a header it cannot read dimensions from', () => {
    const truncated = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(validateImage(truncated)).toEqual({ ok: false, reason: 'dimensions_unreadable' })
  })
})

describe('mediaTypeFor', () => {
  it('derives the type from the detected format, not from the upload', () => {
    expect(mediaTypeFor('png')).toBe('image/png')
    expect(mediaTypeFor('jpeg')).toBe('image/jpeg')
    expect(mediaTypeFor('webp')).toBe('image/webp')
  })
})

/**
 * REAL FILES, not fixtures I wrote.
 *
 * Hand-built headers only prove the parser agrees with my understanding of the
 * spec. These prove it agrees with files produced by real encoders — including
 * the EXIF/APP0 segment chain a phone camera writes, which a minimal fixture
 * never exercises.
 *
 * public/paqar-logo.png is the case that justifies this whole module: it is
 * named .png and is actually a JPEG. If the pipeline trusted the extension it
 * would hand a JPEG to a PNG decoder, and would hand the OCR provider a media
 * type its own bytes contradict.
 */
describe('real encoder output', () => {
  const read = (p: string) =>
    new Uint8Array(readFileSync(join(__dirname, '..', '..', p)))

  it('reads a real JPEG through its EXIF chain, ignoring the .png name', () => {
    const r = validateImage(read('public/paqar-logo.png'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.image.format, 'the bytes say JPEG whatever the name says').toBe('jpeg')
      expect(r.image.width).toBe(1024)
      expect(r.image.height).toBe(1024)
    }
  })

  it('reads a real PNG', () => {
    // 383x120 — a logo, correctly refused as too small for a screenshot, which
    // is the right answer for THIS validator rather than a parse failure.
    const r = validateImage(read('public/paqar-logo-email.png'))
    expect(r).toEqual({ ok: false, reason: 'too_small' })
  })
})
