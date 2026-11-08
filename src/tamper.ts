// Decoding checks nothing. Change one letter of the payload, keep the old
// signature, and decode it anyway.

import { signatureIsValid, TOKEN } from './token.ts';
import { readClaims } from './read-claims.ts';

type Claims = { sub: string; name: string; role: string };

/** Finds the one base64url letter whose change turns sub 1042 into 1043. */
export function tamper(token: string): string {
  const [header, payload, sig] = token.split('.');
  const target = JSON.stringify(readClaims<Claims>(token)).replace('"sub":"1042"', '"sub":"1043"');
  const wanted = Buffer.from(target, 'utf8').toString('base64url');
  let changes = 0;
  for (let i = 0; i < payload.length; i++) if (payload[i] !== wanted[i]) changes++;
  if (changes !== 1) throw new Error(`expected one changed letter, got ${changes}`);
  return `${header}.${wanted}.${sig}`;
}

export const TAMPERED = tamper(TOKEN);

export function changedLetter(a: string, b: string): { at: number; from: string; to: string } {
  const [pa, pb] = [a.split('.')[1], b.split('.')[1]];
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return { at: i, from: pa[i], to: pb[i] };
  }
  throw new Error('no difference');
}

if (import.meta.main) {
  const c = changedLetter(TOKEN, TAMPERED);
  console.log(`changed payload letter ${c.at}: ${c.from} -> ${c.to}, signature untouched`);
  for (const [label, token] of [['original', TOKEN], ['tampered', TAMPERED]] as const) {
    const claims = readClaims<Claims>(token);
    console.log(`${label}  sub=${claims.sub}  name=${claims.name}  signature valid: ${signatureIsValid(token)}`);
  }
}
