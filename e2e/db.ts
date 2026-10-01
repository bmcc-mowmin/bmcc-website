// Direct database access for test setup/cleanup only (local database). Plain SQL via `pg`, because
// Playwright can't load the ESM-only generated Prisma client.
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return (await pool.query(text, params)).rows as T[];
}

export const resetRateLimits = () => sql('DELETE FROM "RateLimitBucket"');
export const deleteListings = (namePrefix: string) => sql('DELETE FROM "DirectoryListing" WHERE name LIKE $1', [`${namePrefix}%`]);
export const countListings = async (name: string) =>
  Number((await sql<{ n: string }>('SELECT count(*) AS n FROM "DirectoryListing" WHERE name = $1', [name]))[0].n);

// Removes anything earlier test runs created (all test data is named or addressed "E2E…"/"e2e-…").
export async function cleanTestData() {
  await sql(`DELETE FROM "DirectoryListing" WHERE name LIKE 'E2E%'`);
  await sql(`DELETE FROM "Announcement" WHERE text->>'en' LIKE 'E2E%'`);
  await sql(`DELETE FROM "Event" WHERE slug LIKE 'e2e-%'`);
  await sql(`UPDATE "User" SET "adminRoles" = '{}', disabled = true WHERE email LIKE 'e2e-%@example.com'`);
}
