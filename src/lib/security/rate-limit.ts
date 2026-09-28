import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Fixed-window rate limit stored in Postgres, so it holds across multiple app instances.
// Returns true when the action is allowed.
export async function rateLimit(
  key: string,
  { max = env.RATE_LIMIT_MAX, windowSec = env.RATE_LIMIT_WINDOW_SEC }: { max?: number; windowSec?: number } = {},
) {
  const windowMs = windowSec * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"`;
  // Occasionally drop old windows so the table stays small.
  if (Math.random() < 0.02) {
    await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } });
  }
  return row.count <= max;
}
