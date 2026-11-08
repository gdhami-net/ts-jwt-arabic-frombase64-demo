// Does the atob fallback give the same answer as Uint8Array.fromBase64?
// The native method is removed for the second run, so the fallback branch of
// read-claims.ts really executes. Padding is tried both ways.

import { b64url } from './token.ts';
import { readClaims } from './read-claims.ts';

function withoutNative<T>(run: () => T): T {
  const saved = Object.getOwnPropertyDescriptor(Uint8Array, 'fromBase64')!;
  Reflect.deleteProperty(Uint8Array, 'fromBase64');
  try {
    return run();
  } finally {
    Object.defineProperty(Uint8Array, 'fromBase64', saved);
  }
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomText(rnd: () => number): string {
  const blocks = [[0x20, 0x7e], [0x00c0, 0x024f], [0x0621, 0x064a], [0x0660, 0x0669], [0x4e00, 0x4e80], [0x1f300, 0x1f340]];
  let out = '';
  const len = 1 + Math.floor(rnd() * 40);
  for (let i = 0; i < len; i++) {
    const [lo, hi] = blocks[Math.floor(rnd() * blocks.length)];
    out += String.fromCodePoint(lo + Math.floor(rnd() * (hi - lo + 1)));
  }
  return out;
}

const tokenOf = (segment: string) => `h.${segment}.s`;

export function compareFallback(samples: number, seed = 61) {
  const rnd = mulberry32(seed);
  let different = 0;
  let unpadded = 0;
  let segmentsWithUrlChars = 0;

  for (let i = 0; i < samples; i++) {
    const claims = { name: randomText(rnd), n: i };
    const segment = b64url(JSON.stringify(claims));
    if (segment.length % 4 !== 0) unpadded++;
    if (/[-_]/.test(segment)) segmentsWithUrlChars++;

    const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4);
    for (const form of [segment, padded]) {
      const native = readClaims<{ name: string }>(tokenOf(form));
      const fallback = withoutNative(() => readClaims<{ name: string }>(tokenOf(form)));
      if (native.name !== claims.name || fallback.name !== claims.name) different++;
    }
  }
  return { samples, different, unpadded, segmentsWithUrlChars };
}

export { withoutNative };

if (import.meta.main) {
  const r = compareFallback(20_000);
  console.log(`payloads tried:                   ${r.samples}, each unpadded and padded`);
  console.log(`missing "=" padding as generated: ${r.unpadded}`);
  console.log(`holding "-" or "_":               ${r.segmentsWithUrlChars}`);
  console.log(`answers that differed:            ${r.different}`);
}
