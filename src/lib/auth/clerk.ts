import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// AUTH_PROVIDER=clerk: Clerk handles sign-in and sign-up; BMCC's own `User` row stays the record
// that memberships, payments, RSVPs and admin roles hang off. A Clerk account is linked to that
// row by `clerkUserId`, or — the first time it signs in — by its VERIFIED primary email, so a
// member's or donor's history and an invited admin's roles carry over.

export async function clerkUserRow() {
  const { userId } = await auth();
  if (!userId) return null;
  const linked = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (linked) return linked;

  // First visit with this Clerk account: look it up once.
  const cu = await currentUser();
  const primary = cu?.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId);
  if (!cu || !primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress.trim().toLowerCase();
  const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;

  const existing = await db.user.findUnique({ where: { email } });
  const user = existing
    ? // Re-link if the Clerk account was recreated (the email is verified, so it's the same person).
      await db.user.update({ where: { id: existing.id }, data: { clerkUserId: userId, name: existing.name ?? name } })
    : await db.user.create({ data: { email, name, clerkUserId: userId } });
  // A membership application made before the account existed belongs to this person.
  await db.household.updateMany({ where: { email, primaryUserId: null }, data: { primaryUserId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}
