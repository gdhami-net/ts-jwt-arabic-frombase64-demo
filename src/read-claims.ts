function base64UrlToBytes(segment: string): Uint8Array {
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(segment, { alphabet: 'base64url' });
  }
  const standard = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(standard), c => c.charCodeAt(0));
}

export function readClaims<T>(token: string): T {
  const bytes = base64UrlToBytes(token.split('.')[1]);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
