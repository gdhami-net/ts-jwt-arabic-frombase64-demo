# ts-jwt-arabic-frombase64-demo

One signed token with a made-up Arabic name in its payload, decoded four ways,
plus the fallback, a tampered copy and the TypeScript step.

The name is `سدرة تجربة`. "Tajriba" is the Arabic word for "test", so it reads
roughly like "Sidra Test". It isn't anybody's name.

## What it proves

| Claim | Script |
|---|---|
| On one token: plain `atob` throws, `atob` after the alphabet swap prints garbage, `fromBase64` with the default alphabet throws, `fromBase64` with `base64url` plus `TextDecoder` prints the name | `npm run four-ways` |
| `atob` throws only when the segment holds `-` or `_`, about 10% of generated tokens with Arabic names and none with Latin names | `npm run crash-rate` |
| The feature-detected fallback gives the same answer as the native method, with and without `=` padding | `npm run fallback` |
| Changing one letter of the payload still decodes, and a real signature check fails | `npm run tamper` |
| The default Angular tsconfig reports TS2550, and the exact `lib` that fixes it | `npm run tsc-step` |
| Angular 22's build target includes browsers older than the method | `npm run browsers` |

`npm run check` asserts all of the above and exits non-zero if one fails.

## How to run it

Needs Node 25 or newer (the scripts use `Uint8Array.fromBase64` and run the
`.ts` files directly).

```
npm install
npm run check
```

No network, no secrets. The token is signed with a key that exists only in
`src/token.ts`.

## Tool versions

| Tool | Version |
|---|---|
| Node | 26.1.0 |
| TypeScript | 6.0.3 (the line Angular 22 needs) |
| jwt-decode | 4.0.0 |
| browserslist | 4.29.5 |
| baseline-browser-mapping | 2.11.35 |

The tsconfig in `tsc-step/` is the template from Angular CLI 22.2.x with the
strict options turned on, plus `noEmit` and a `files` list.

## Edge cases the post leaves out

- **The 10% depends on the names.** The list in `src/crash-rate.ts` is 36 common
  given names and 30 common family names. Another list gives another number.
  What doesn't change: Arabic letters can only cause it through `د` (dal) followed
  directly by another letter, at one byte offset in three, out of the common
  letters tested. Two rarer letters outside the common set, U+063E and U+063F,
  can also do it, and so can the Persian `پ` (U+067E).
- **ASCII can do it too.** A `>`, `?` or `~` as the third byte of a group gives
  `-` or `_`. A URL with a query string in a claim can trigger it. The Latin
  tokens here had none in the right place.
- **Invisible garbage.** Letters such as ل م ن ه و ي are D9 8x in UTF-8. Read as
  Latin-1, the 0x8x byte is a C1 control character, which most screens don't
  show, so the garbled text looks shorter than it is. The demo name uses letters
  whose second byte is 0xA0 or higher, so all of it is visible.
- **`lastChunkHandling: 'strict'`** refuses an unpadded segment with `SyntaxError`,
  and JWT segments are unpadded by design. Don't pass it for a token. The demo's
  own token is 124 characters and needs no padding, so the assertion uses a
  short segment that does.
- **The `in` check.** `'fromBase64' in Uint8Array` doesn't compile once the lib
  is added: the false branch narrows `Uint8Array` to `never`. See
  `tsc-step/in-operator.ts`.
- **The hint from TS2550.** `"lib": ["esnext"]` fixes that line and loses `atob`
  and `TextDecoder`, because `lib` replaces the default list. `dom` has to be in
  the list.
- **No real old browser here.** The fallback is exercised by removing the method
  from `Uint8Array` in Node, not by running Safari 17.
- **Server rendering.** MDN's data has Node at 25.0.0 for this method. Angular
  22.0.x supports Node `^22.22.3 || ^24.15.0 || ^26.0.0`, so an SSR build on 22 or
  24 also goes through the fallback. Not run here.
- **`new TextDecoder()`** replaces bad bytes with U+FFFD. Pass `{ fatal: true }`
  if you'd rather get an exception.
- **Browser floor.** `npm run browsers` runs the query Angular CLI 22 uses,
  through the versions of browserslist and baseline-browser-mapping pinned here.
  Newer data can change the floor.
- **The name in the token is not checked** against any rule. Length, script,
  normalization and bidi handling in your UI are separate problems.

## License

MIT
