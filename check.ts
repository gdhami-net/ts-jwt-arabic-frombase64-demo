// Asserts every claim the post makes. Exits non-zero if one fails.

import { jwtDecode } from 'jwt-decode';
import { ADDED_IN, supportFloor } from './src/browsers.ts';
import { asciiThatCrash, lettersThatCrash, measure } from './src/crash-rate.ts';
import { compareFallback, withoutNative } from './src/fallback.ts';
import { ways } from './src/four-ways.ts';
import { readClaims } from './src/read-claims.ts';
import { changedLetter, TAMPERED } from './src/tamper.ts';
import { attempt, b64url, CLAIMS, GARBLED, makeToken, NAME, PAYLOAD, signatureIsValid, TOKEN } from './src/token.ts';
import { compile } from './tsc-step/run.ts';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed++;
    console.log(`PASS  ${label}${detail ? `  [${detail}]` : ''}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}${detail ? `  [${detail}]` : ''}`);
  }
}

type Claims = { sub: string; name: string; role: string };

// One token, four decoders.
assert('the token holds "-" or "_" in its payload', /[-_]/.test(PAYLOAD));
const results = Object.fromEntries(Object.entries(ways).map(([k, run]) => [k, attempt(run)]));
assert('plain atob throws InvalidCharacterError', results['atob(segment)'].error.startsWith('InvalidCharacterError'), results['atob(segment)'].error);
assert('atob after the swap prints garbage', results['atob(swapped)'].out === GARBLED, results['atob(swapped)'].out);
assert('fromBase64 with the default alphabet throws SyntaxError', results['fromBase64(segment)'].error.startsWith('SyntaxError'), results['fromBase64(segment)'].error);
assert('fromBase64 with base64url plus TextDecoder gives the name', results['fromBase64(segment, base64url)'].out === NAME, results['fromBase64(segment, base64url)'].out);

// A token that doesn't crash.
const quiet = makeToken({ ...CLAIMS, name: 'سارة تجربة' });
const quietPayload = quiet.split('.')[1];
assert('a name with no dal gives a payload with no "-" or "_"', !/[-_]/.test(quietPayload));
const quietName = attempt(() => (JSON.parse(atob(quietPayload)) as Claims).name);
assert('plain atob does not throw on it, and garbles it', quietName.ok && quietName.out !== 'سارة تجربة', quietName.out);

// How common the crash is.
const m = measure(200_000);
assert('Arabic names: exact count of payloads with "-" or "_"', m.arabic === 20433, `${m.arabic} of ${m.samples}, ${((100 * m.arabic) / m.samples).toFixed(1)}%`);
assert('Latin names: no payload has "-" or "_"', m.latin === 0, `${m.latin} of ${m.samples}`);
assert('every Arabic crash had a dal before a letter', m.arabicCrashWithoutDal === 0);
const found = lettersThatCrash();
const letters = [...found.keys()];
assert('dal is the only Arabic letter that can cause it', letters.length === 1 && letters[0] === 'د', letters.join(' '));
assert('it happens at one byte offset in three, for every following letter', found.get('د') === 36, `${found.get('د')} of ${36 * 3} offset and letter combinations`);
const ascii = asciiThatCrash();
assert('in ASCII only >, ? and ~ can produce "-" or "_"', ascii === '>?~', ascii);

// The fallback.
const fb = compareFallback(20_000);
assert('fallback and native agree on 20,000 payloads, padded and unpadded', fb.different === 0, `${fb.different} differed, ${fb.unpadded} unpadded, ${fb.segmentsWithUrlChars} with "-" or "_"`);
const viaFallback = withoutNative(() => ({
  native: typeof Uint8Array.fromBase64,
  name: readClaims<Claims>(TOKEN).name,
}));
assert('the fallback branch runs when the method is gone', viaFallback.native === 'undefined' && viaFallback.name === NAME, viaFallback.name);
const unpadded = b64url('{"a":1}');
const strict = attempt(() => String(Uint8Array.fromBase64(unpadded, { alphabet: 'base64url', lastChunkHandling: 'strict' }).length));
const loose = attempt(() => String(Uint8Array.fromBase64(unpadded, { alphabet: 'base64url' }).length));
assert('strict lastChunkHandling refuses an unpadded segment, the default accepts it', unpadded.length % 4 !== 0 && strict.error.startsWith('SyntaxError') && loose.ok, strict.error);

// Tampering.
const change = changedLetter(TOKEN, TAMPERED);
assert('one payload letter changed, signature kept', TOKEN.split('.')[2] === TAMPERED.split('.')[2], `letter ${change.at}: ${change.from} -> ${change.to}`);
assert('the tampered token still decodes, with the new sub', readClaims<Claims>(TAMPERED).sub === '1043');
assert('the original signature checks out', signatureIsValid(TOKEN));
assert('the tampered signature does not', !signatureIsValid(TAMPERED));

// TypeScript.
const plain = compile('tsconfig.angular-default.json');
assert('the default Angular tsconfig reports TS2550', plain.status !== 0 && plain.output.includes("error TS2550: Property 'fromBase64' does not exist on type 'Uint8ArrayConstructor'"), plain.output.split('\n')[0]);
assert('adding esnext.typedarrays compiles clean', compile('tsconfig.with-lib.json').status === 0);
const alone = compile('tsconfig.lib-alone.json');
assert('listing only esnext.typedarrays loses the base types', alone.status !== 0 && alone.output.includes('TS2318'), alone.output.split('\n')[0]);
const esnext = compile('tsconfig.lib-esnext.json');
assert('the hint alone (lib: esnext) loses atob and TextDecoder', esnext.status !== 0 && esnext.output.includes("Cannot find name 'atob'") && esnext.output.includes("Cannot find name 'TextDecoder'"), esnext.output.split('\n')[0]);
const inOperator = compile('tsconfig.in-operator.json');
assert('the "in" check narrows Uint8Array to never', inOperator.status !== 0 && inOperator.output.includes("Property 'from' does not exist on type 'never'"), inOperator.output.split('\n')[0]);

// jwt-decode, named in the post.
assert('jwt-decode reads the same name', jwtDecode<Claims>(TOKEN).name === NAME);
assert('jwt-decode also reads the tampered token', jwtDecode<Claims>(TAMPERED).sub === '1043');

// Browser support.
const floor = supportFloor();
for (const browser of Object.keys(ADDED_IN)) {
  assert(`Angular 22 supports a ${browser} older than the method`, floor[browser] < ADDED_IN[browser], `oldest ${floor[browser]}, method from ${ADDED_IN[browser]}`);
}

console.log();
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
