// The same feature check written with `in`. Once the lib says the method always
// exists, the false branch narrows Uint8Array to never, and the fallback stops
// compiling.
export function bytes(segment: string): Uint8Array {
  if ('fromBase64' in Uint8Array) {
    return Uint8Array.fromBase64(segment, { alphabet: 'base64url' });
  }
  return Uint8Array.from(atob(segment), c => c.charCodeAt(0));
}
