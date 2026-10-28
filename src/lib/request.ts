import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { pickClientIp } from "@/lib/security/client-ip";

let warned = false;

// Visitor IP for rate limiting — see src/lib/security/client-ip.ts for which header is trusted.
export async function clientIp() {
  const h = await headers();
  if (env.CLIENT_IP_HEADER && !h.get(env.CLIENT_IP_HEADER) && !warned) {
    warned = true;
    console.warn(`CLIENT_IP_HEADER=${env.CLIENT_IP_HEADER} is set but the request has no such header; using X-Forwarded-For instead. Check the hosting/proxy setup.`);
  }
  return pickClientIp(h, { header: env.CLIENT_IP_HEADER, hops: env.TRUSTED_PROXY_HOPS });
}
