// Adds the initial-feed listings from prisma/seed-data/private/directory.csv that aren't in the
// database yet. ADD-ONLY: never deletes or changes anything, so listings that came in through the
// "Submit a Listing" form or were edited in admin are always kept. Local only.
//   npm run db:seed:directory
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
  console.log(`Directory: ${await seedDirectory(db, reviewer.id, { replace: false })}.`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
