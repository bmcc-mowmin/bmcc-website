import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// One-time links (e.g. an admin invite). The raw token only ever exists in the emailed link;
// the database stores its SHA-256 hash, so a database leak can't be used to take over accounts.

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

export async function createToken(userId: string, purpose: string, ttlHours: number) {
  const raw = randomBytes(32).toString("base64url");
  // A new link replaces any earlier unused one for the same purpose.
  await db.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  await db.authToken.create({ data: { userId, purpose, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ttlHours * 3600_000) } });
  return raw;
}

// The token's user if it is valid, unused and not expired (does not consume it).
export async function peekToken(raw: string, purpose: string) {
  if (!raw || raw.length > 100) return null;
  const row = await db.authToken.findUnique({ where: { tokenHash: hash(raw) }, include: { user: true } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date() || row.user.disabled) return null;
  return row;
}

export async function consumeToken(raw: string, purpose: string) {
  const row = await peekToken(raw, purpose);
  if (!row) return null;
  // Only one request can win: the update matches only while usedAt is still null.
  const { count } = await db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? row.user : null;
}
