// Redirect targets taken from a form or query string ("next", "success", "cancel") must stay on
// this site. Returns a same-site path ("/account?tab=1#x"), or the fallback.
//
// A plain startsWith("/") check is not enough: browsers read "/\evil.example" (and tabs or
// newlines hidden inside it) as "//evil.example", a link to another site.
const BASE = "http://same-site.invalid";

export function safeNext(next: unknown, fallback: string): string {
  if (typeof next !== "string" || next.length > 2000 || !next.startsWith("/")) return fallback;
  // No backslashes or control characters anywhere: they're never needed in our own paths.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback; // "//evil.example" and friends
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
