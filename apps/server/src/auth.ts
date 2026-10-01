import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ParsedInitData {
  user: TelegramUser;
  authDate: number;
  hash: string;
  queryId?: string;
}

export function verifyTelegramInitData(initData: string, botToken: string): ParsedInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) return null;

  const userJson = params.get('user');
  if (!userJson) return null;

  const user: TelegramUser = JSON.parse(userJson);
  const authDate = Number(params.get('auth_date') ?? 0);

  if (Date.now() / 1000 - authDate > 86400) return null;

  return {
    user,
    authDate,
    hash,
    queryId: params.get('query_id') ?? undefined,
  };
}

export function signToken(payload: object, secret: string, expiresInSec = 604800): string {
  // Safety net: JWT must contain uid for auth middleware to work.
  // A missing uid causes silent "notoken" errors downstream.
  if (!(payload as any)?.uid) {
    throw new Error('signToken: payload.uid is required');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

  const h = b64(header);
  const p = b64(body);
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');

  return `${h}.${p}.${sig}`;
}

export function verifyToken(token: string, secret: string): any | null {
  try {
    const [h, p, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
    if (sig !== expected) return null;

    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
