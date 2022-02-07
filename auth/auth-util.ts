/**
 * Generate a 16 byte salt in base64 format
 * @returns {string} A 16 byte salt in base64 format
 */
 export function getSalt(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/=+$/, '');
}

/**
 * Hash a password using PBKDF2/SHA-256 with 10,000 iterations.
 * @param {string} pass The password to hash
 * @param {string} salt The salt
 * @returns {Promise<string>} The hashed password in base64 format
 */
export async function hashPassword(pass: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();

  const hash = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder.encode(salt),
    iterations: 100000
  }, await crypto.subtle.importKey(
    'raw',
    encoder.encode(pass),
    'PBKDF2',
    false,
    ['deriveBits']
  ), 256);

  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
