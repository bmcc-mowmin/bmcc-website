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
  // Payments, subscriptions, checkouts and memberships made with e2e-… emails.
  await sql(`DELETE FROM "Payment" WHERE "donorEmail" LIKE 'e2e-%'`);
  await sql(`DELETE FROM "Subscription" WHERE email LIKE 'e2e-%'`);
  await sql(`DELETE FROM "CheckoutSession" WHERE email LIKE 'e2e-%' OR "membershipId" IN (SELECT m.id FROM "Membership" m JOIN "Household" h ON h.id = m."householdId" WHERE h.email LIKE 'e2e-%')`);
  await sql(`DELETE FROM "Membership" WHERE "householdId" IN (SELECT id FROM "Household" WHERE email LIKE 'e2e-%')`);
  await sql(`DELETE FROM "Household" WHERE email LIKE 'e2e-%'`);
  await sql(`DELETE FROM "Subscriber" WHERE email LIKE 'e2e-%'`);
  await sql(`DELETE FROM "ContactMessage" WHERE email LIKE 'e2e-%'`);
}

export async function subscriberStatus(email: string) {
  return (await sql<{ status: string; source: string; lang: string }>('SELECT status, source, lang FROM "Subscriber" WHERE email = $1', [email]))[0];
}

// Inserts an approved (or pending) listing directly, for tests that must not depend on seed data.
export async function insertListing(l: {
  name: string;
  parentCategory: string;
  category: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  tags?: string[];
  status?: "APPROVED" | "PENDING";
}) {
  await sql(
    `INSERT INTO "DirectoryListing" (id, name, "listingType", "parentCategory", category, tags, description, author, phone, address, city, state, zip, status, "createdAt", "updatedAt")
     VALUES ($1, $2, 'BUSINESS', $3, $4, $5, 'Test listing created by the end-to-end tests.', $2, $6, $7, $8, $9, $10, $11, now(), now())`,
    [
      `e2e${Math.random().toString(36).slice(2, 12)}`,
      l.name,
      l.parentCategory,
      l.category,
      l.tags ?? [],
      l.phone ?? null,
      l.address ?? null,
      l.city ?? null,
      l.address ? "CA" : null,
      l.address ? "94513" : null,
      l.status ?? "APPROVED",
    ],
  );
}

export async function latestPayment(email: string) {
  return (await sql<{ receiptNumber: string; amountCents: number; fund: string | null; frequency: string; kind: string }>(
    'SELECT "receiptNumber", "amountCents", fund, frequency, kind FROM "Payment" WHERE "donorEmail" = $1 ORDER BY "createdAt" DESC LIMIT 1',
    [email],
  ))[0];
}
