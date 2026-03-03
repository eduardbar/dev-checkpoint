import * as crypto from 'crypto';

/** URL-safe character set (no special chars, no ambiguous 0/O/1/l) */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const ALPHABET_LEN = ALPHABET.length;

/**
 * Cryptographically random ID with URL-safe alphabet.
 * Default length 6 — gives 58^6 ≈ 38 billion possible values,
 * sufficient for collision-safe checkpoint IDs on a local filesystem.
 *
 * Zero external dependencies — uses Node.js `crypto.randomBytes`.
 */
export function nanoid(size = 6): string {
  // Use rejection sampling to avoid modulo bias
  const mask = Math.pow(2, Math.ceil(Math.log2(ALPHABET_LEN))) - 1;
  let result = '';
  while (result.length < size) {
    const bytes = crypto.randomBytes(size);
    for (let i = 0; i < bytes.length && result.length < size; i++) {
      const byte = bytes[i] & mask;
      if (byte < ALPHABET_LEN) {
        result += ALPHABET[byte];
      }
    }
  }
  return result;
}
