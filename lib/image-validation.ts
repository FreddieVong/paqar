/**
 * Server-side validation of an uploaded screenshot.
 *
 * ── WHY THE EXTENSION AND THE MIME HEADER ARE BOTH IGNORED ─────────────────
 *
 * Both are attacker-controlled. A file called `screenshot.png` sent as
 * `image/png` can contain anything at all, and the two fields agreeing proves
 * only that whoever sent them was consistent.
 *
 * So the bytes decide. The magic number at the head of the file is the one
 * claim the uploader cannot make without actually producing that format.
 *
 * ── THE POLYGLOT PROBLEM ───────────────────────────────────────────────────
 *
 * A file can be simultaneously a valid GIF and a valid HTML document, or a
 * valid JPEG carrying an HTML payload after its comment marker. Served from a
 * domain with any trust, such a file becomes stored XSS. Paqar's exposure is
 * narrower than most — the bucket is private and reviewer access is a
 * short-lived signed URL — but "narrow" is not "none", and the reviewer is the
 * account holding ADMIN_SECRET.
 *
 * The defence is an ALLOWLIST of three formats whose headers are checked
 * positively, plus a scan for markup in the first bytes. SVG is refused
 * outright: it is XML, it executes script, and no phone produces one as a
 * screenshot.
 *
 * ── WHY DIMENSIONS ARE READ HERE ───────────────────────────────────────────
 *
 * A decompression bomb is a small file that expands to gigapixels. Reading the
 * declared dimensions from the header costs nothing and refuses one before any
 * decoder touches it — including the OCR provider's.
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export type ImageRejection =
  | 'empty'
  | 'too_large'
  | 'unsupported_format'
  | 'markup_detected'
  | 'dimensions_unreadable'
  | 'too_small'
  | 'too_large_dimensions'

export interface ValidImage {
  format: ImageFormat
  width:  number
  height: number
  bytes:  number
}

export type ImageCheck =
  | { ok: true;  image: ValidImage }
  | { ok: false; reason: ImageRejection }

/** A phone screenshot after client-side compression. Generous, not unbounded. */
export const MAX_BYTES = 8 * 1024 * 1024
/** Below this nothing legible survives; it is a tracking pixel or a mistake. */
export const MIN_DIMENSION = 200
/** Above this is a decompression bomb or a desktop capture nobody needs. */
export const MAX_DIMENSION = 12_000
/** Price, model and mileage can sit on different screens — but not fifteen. */
export const MAX_FILES = 6

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  sig.every((v, i) => b[offset + i] === v)

/** PNG: IHDR carries width and height as big-endian u32 at fixed offsets. */
function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return { width: dv.getUint32(16), height: dv.getUint32(20) }
}

/**
 * JPEG: walk the segment chain to a Start-Of-Frame marker.
 *
 * Sequential scanning rather than a fixed offset, because a JPEG's dimensions
 * live after however many APPn/EXIF segments the camera decided to write.
 */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue }
    const marker = b[i + 1]!
    // SOF0-3, SOF5-7, SOF9-11, SOF13-15 carry the frame header. DHT/DAC/RSTn
    // and SOS do not, and must be skipped by length.
    const isSof = (marker >= 0xc0 && marker <= 0xcf)
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue }
    const len = dv.getUint16(i + 2)
    if (len < 2) return null
    i += 2 + len
  }
  return null
}

/** WebP: three sub-formats, each storing size differently. */
function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null
  const tag = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!)
  const dv  = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (tag === 'VP8 ') {
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
  }
  if (tag === 'VP8L') {
    const bits = dv.getUint32(21, true)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (tag === 'VP8X') {
    const w = b[24]! | (b[25]! << 8) | (b[26]! << 16)
    const h = b[27]! | (b[28]! << 8) | (b[29]! << 16)
    return { width: w + 1, height: h + 1 }
  }
  return null
}

function detect(b: Uint8Array): ImageFormat | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(b, [0xff, 0xd8, 0xff]))                                return 'jpeg'
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(b, [0x57, 0x45, 0x42, 0x50], 8))                       return 'webp'
  return null
}

/**
 * Markup anywhere in the leading bytes disqualifies the file.
 *
 * A real PNG/JPEG/WebP header region contains binary, not `<svg` or `<!DOCTYPE`.
 * Finding either means the file is trying to be two things at once, and the
 * second thing is the dangerous one.
 */
function looksLikeMarkup(b: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(b.subarray(0, 1024)).toLowerCase()
  return /<svg|<!doctype|<html|<script|<\?xml/.test(head)
}

export function validateImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0)      return { ok: false, reason: 'empty' }
  if (bytes.length > MAX_BYTES) return { ok: false, reason: 'too_large' }

  // Markup is checked BEFORE the format, so a polyglot cannot pass by leading
  // with a valid signature.
  if (looksLikeMarkup(bytes)) return { ok: false, reason: 'markup_detected' }

  const format = detect(bytes)
  if (!format) return { ok: false, reason: 'unsupported_format' }

  const size = format === 'png' ? pngSize(bytes)
             : format === 'jpeg' ? jpegSize(bytes)
             : webpSize(bytes)
  if (!size || !size.width || !size.height) return { ok: false, reason: 'dimensions_unreadable' }

  if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
    return { ok: false, reason: 'too_small' }
  }
  if (size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) {
    return { ok: false, reason: 'too_large_dimensions' }
  }

  return { ok: true, image: { format, width: size.width, height: size.height, bytes: bytes.length } }
}

/** The media type to hand the OCR provider. Derived from BYTES, never claimed. */
export function mediaTypeFor(format: ImageFormat): string {
  return `image/${format}`
}

/**
 * What the buyer is told. Deliberately one message for every technical reason.
 *
 * "dimensions_unreadable" and "markup_detected" describe our parser and our
 * threat model; neither helps someone holding a phone. They are told what will
 * work instead.
 */
export const UPLOAD_REJECTION_COPY =
  'Gambar ini tidak dapat dibaca. Guna screenshot PNG, JPG atau WebP daripada telefon anda.'

/**
 * The same message, EXCEPT where a different one changes what the buyer does.
 *
 * The one-message rule above is right for reasons that describe our parser —
 * "markup_detected" and "dimensions_unreadable" tell someone holding a phone
 * nothing they can act on. But three of these are ordinary, fixable mistakes,
 * and answering them with "gambar ini tidak dapat dibaca" sends someone off to
 * retake a screenshot that was never the problem:
 *
 *   unsupported_format  an iPhone HEIC, or a PDF. Nothing wrong with the
 *                       picture; it is the wrong container, and there is a
 *                       one-tap fix on the phone.
 *   too_large           a 12MP photo of a screen instead of a screenshot.
 *   too_small           a thumbnail, or a cropped fragment. OCR will read
 *                       nothing from it and a reviewer will not either.
 */
export function rejectionCopyFor(reason: ImageRejection | 'storage_failed'): string {
  switch (reason) {
    case 'unsupported_format':
      return 'Format gambar ini tidak disokong — selalunya HEIC dari iPhone, atau fail PDF. Guna PNG, JPG atau WebP. Pada iPhone: Settings › Camera › Formats › Most Compatible, atau hantar melalui WhatsApp yang menukarnya sendiri.'
    case 'too_large':
      return 'Fail ini terlalu besar. Ambil screenshot iklan itu, bukan gambar skrin dengan kamera.'
    case 'too_small':
      return 'Gambar ini terlalu kecil untuk dibaca. Hantar screenshot penuh skrin iklan itu, bukan bahagian yang dipotong.'
    default:
      return UPLOAD_REJECTION_COPY
  }
}
