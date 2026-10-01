// Replaces ONLY the Community Directory listings (keeps events, admins, settings, etc.):
//   npm run db:seed:directory
// Uses prisma/seed-data/private/directory.csv when present, else fake samples. Local only.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDirectory } from "../prisma/directory-seed";

if (process.env.APP_ENV === "production") {
  console.error("Refusing to run: APP_ENV=production. Use Admin → Directory → Import in production.");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const reviewer = await db.user.findFirst({ where: { adminRoles: { has: "SUPER_ADMIN" } }, orderBy: { createdAt: "asc" } });
  if (!reviewer) throw new Error("No super admin found — run npm run db:seed first.");
  console.log(`Directory: ${await seedDirectory(db, reviewer.id)}.`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
