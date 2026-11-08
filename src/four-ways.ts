import { attempt, PAYLOAD, TOKEN } from './token.ts';

type Claims = { name: string };

const swap = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');
const name = (json: string) => (JSON.parse(json) as Claims).name;

export const ways = {
  'atob(segment)': () => name(atob(PAYLOAD)),
  'atob(swapped)': () => name(atob(swap(PAYLOAD))),
  'fromBase64(segment)': () =>
    name(new TextDecoder().decode(Uint8Array.fromBase64(PAYLOAD))),
  "fromBase64(segment, base64url)": () =>
    name(new TextDecoder().decode(Uint8Array.fromBase64(PAYLOAD, { alphabet: 'base64url' }))),
};

if (import.meta.main) {
  console.log(`token   ${TOKEN}`);
  console.log(`payload holds "-" or "_": ${/[-_]/.test(PAYLOAD)}`);
  console.log();
  for (const [label, run] of Object.entries(ways)) {
    const r = attempt(run);
    console.log(label.padEnd(32), r.ok ? r.out : r.error);
  }
}
