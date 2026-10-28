// Which address is the visitor's, for per-visitor rate limits.
//
// X-Forwarded-For is a list the visitor can start themselves ("X-Forwarded-For: 1.2.3.4"); each
// proxy only APPENDS. So the first entry is whatever the visitor wants, and only the entries added
// by our own proxies can be trusted. Two settings choose the trustworthy source:
//
//   CLIENT_IP_HEADER     a single-address header set by a trusted edge that overwrites any
//                        value the visitor sent, e.g. "cf-connecting-ip" behind Cloudflare
//                        (Render's own edge is Cloudflare, so it is set there too).
//   TRUSTED_PROXY_HOPS   otherwise, how many trusted proxies append to X-Forwarded-For; the
//                        visitor is the entry that many places from the right (default 1).

type HeaderGetter = { get(name: string): string | null };

export function pickClientIp(h: HeaderGetter, opts: { header?: string; hops: number }): string {
  if (opts.header) {
    const v = h.get(opts.header)?.trim();
    if (v) return v;
  }
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length > 0) {
    const hops = Math.max(1, opts.hops);
    // Fewer entries than trusted hops: the left-most is the best we have (nothing to spoof past).
    return chain.at(Math.max(0, chain.length - hops)) ?? "unknown";
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
