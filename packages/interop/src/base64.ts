/**
 * Bytes to base64 and back, without `btoa`.
 *
 * `btoa(String.fromCharCode(...bytes))` is the one-liner and it throws on a
 * real recording: spreading a 4 MB `Uint8Array` into an argument list exceeds
 * the engine's argument limit, and the failure is a `RangeError` at export time
 * rather than anything a reader could diagnose. Three bytes at a time costs
 * nothing measurable next to writing the file.
 *
 * Every embedding format uses it — the `<script>` block in an `.html`, the
 * custom XML part in a `.docx`, the embedded file stream in a `.pdf` — because
 * base64 is the one encoding that survives being handled as TEXT by a program
 * that does not know what it is holding. Word re-serialises a custom XML part
 * when it saves; base64 in a single text node comes back byte for byte.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const left = bytes.length - i;
  if (left === 1) {
    const n = bytes[i]! << 16;
    out += `${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}==`;
  } else if (left === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += `${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}${B64[(n >> 6) & 63]!}=`;
  }
  return out;
}

/** Base64 back to bytes. Refuses anything that is not base64 rather than
 *  returning a shorter array than it was given. */
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new Error('an embedded payload is not base64');
  }
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]!) << 18) | (B64.indexOf(clean[i + 1]!) << 12)
      | ((B64.indexOf(clean[i + 2]!) & 63) << 6) | (B64.indexOf(clean[i + 3]!) & 63);
    if (at < out.length) out[at++] = (n >> 16) & 255;
    if (at < out.length) out[at++] = (n >> 8) & 255;
    if (at < out.length) out[at++] = n & 255;
  }
  return out;
}
