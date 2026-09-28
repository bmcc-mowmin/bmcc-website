import "server-only";
import { headers } from "next/headers";

// Visitor IP for rate limiting. Behind a proxy/load balancer the first X-Forwarded-For entry is
// the client; make sure the production proxy overwrites (not appends to) that header.
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
