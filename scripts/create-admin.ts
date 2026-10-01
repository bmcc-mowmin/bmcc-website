// Creates (or upgrades) a Super admin and prints a one-time "set your password" link.
// This is how the FIRST admin is made in production, where the seed never runs:
//
//   npm run admin:create -- someone@brmcc.org "Their Name"
//
// After that, admins invite each other from Admin users in the portal.
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- someone@example.org "Their Name"');
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const name = nameParts.join(" ") || null;
  const existing = await db.user.findUnique({ where: { email } });
  const roles = Array.from(new Set([...(existing?.adminRoles ?? []), "SUPER_ADMIN" as const]));
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { adminRoles: roles, disabled: false } })
    : await db.user.create({ data: { email, name, adminRoles: ["SUPER_ADMIN"] } });

  const raw = randomBytes(32).toString("base64url");
  await db.authToken.deleteMany({ where: { userId: user.id, purpose: "set_password", usedAt: null } });
  await db.authToken.create({
    data: {
      userId: user.id,
      purpose: "set_password",
      tokenHash: createHash("sha256").update(raw).digest("hex"),
      expiresAt: new Date(Date.now() + 72 * 3600_000),
    },
  });
  const base = process.env.ADMIN_HOST
    ? `${new URL(process.env.APP_URL ?? "https://localhost").protocol}//${process.env.ADMIN_HOST}`
    : (process.env.APP_URL ?? "http://localhost:3000");
  console.log(`${email} is a Super admin.`);
  console.log(`Set-password link (works once, expires in 72 hours):\n${base}/admin/set-password?token=${raw}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
