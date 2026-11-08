import { createHmac, timingSafeEqual } from 'node:crypto';

// A made-up person. "Tajriba" is the Arabic word for "test", so this reads
// roughly like "Sidra Test".
export const NAME = 'سدرة تجربة';

// The garbled form the demo expects when these bytes are read as Latin-1.
export const GARBLED = 'Ø³Ø¯Ø±Ø© ØªØ¬Ø±Ø¨Ø©';

export const SECRET = 'demo-secret-for-this-repo-only';

export const CLAIMS = {
  sub: '1042',
  name: NAME,
  role: 'viewer',
  iat: 1778630400,
  exp: 1778634000,
};

export function b64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function signature(signingInput: string): string {
  return createHmac('sha256', SECRET).update(signingInput).digest('base64url');
}

export function makeToken(claims: object): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const input = `${header}.${payload}`;
  return `${input}.${signature(input)}`;
}

export function signatureIsValid(token: string): boolean {
  const [header, payload, sig] = token.split('.');
  const expected = Buffer.from(signature(`${header}.${payload}`));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const TOKEN = makeToken(CLAIMS);
export const PAYLOAD = TOKEN.split('.')[1];

/** Runs a decoder and reports either its result or the error it threw. */
export function attempt(run: () => string): { ok: boolean; out: string; error: string } {
  try {
    return { ok: true, out: run(), error: '' };
  } catch (err) {
    const e = err as Error;
    return { ok: false, out: '', error: `${e.name}: ${e.message}` };
  }
}
