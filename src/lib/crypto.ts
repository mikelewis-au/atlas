export type Bytes = Uint8Array<ArrayBuffer>

export interface Sealed {
  iv: Bytes
  ct: Bytes
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length))
}

export async function deriveKey(secret: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function importDataKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function seal(key: CryptoKey, data: Bytes): Promise<Sealed> {
  const iv = randomBytes(12)
  return { iv, ct: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)) }
}

/** Rejects when the key is wrong or the data has been altered. */
export async function open(key: CryptoKey, sealed: Sealed): Promise<Bytes> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.ct),
  )
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  return seal(key, encoder.encode(JSON.stringify(value)))
}

export async function openJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  return JSON.parse(decoder.decode(await open(key, sealed))) as T
}

// Crockford base32: no I, L, O or U, so a hand-copied key is hard to misread
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function newRecoveryKey(): string {
  const bytes = randomBytes(20)
  let bits = ''
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
  let key = ''
  for (let i = 0; i < bits.length; i += 5) key += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return key.match(/.{4}/g)!.join('-')
}

export function normaliseRecoveryKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '')
}

export function toB64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromB64(text: string): Bytes {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
