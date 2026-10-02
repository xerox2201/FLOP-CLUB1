/**
 * SHA-256 / HMAC-SHA256 for the Provably Fair verifier.
 *
 * Uses WebCrypto (globalThis.crypto.subtle) only, so the exact same code runs
 * in the browser (mini-app) and on the server (Node >= 20). Never import
 * node:crypto here: this module is bundled for the client.
 */

function subtle(): any {
  const c: any = (globalThis as any).crypto;
  if (!c?.subtle) {
    throw new Error('WebCrypto subtle is unavailable in this runtime');
  }
  return c.subtle;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return toHex(await subtle().digest('SHA-256', data));
}

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await subtle().importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await subtle().sign('HMAC', cryptoKey, enc.encode(message)));
}
