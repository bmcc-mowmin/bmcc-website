import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Clerk → BMCC: keeps a linked person's email and name current, and unlinks a deleted Clerk
// account (their memberships, receipts and RSVPs stay; signing up again with the same email
// links them back). Register https://<site>/api/webhooks/clerk in Clerk for user.updated and
// user.deleted, and set CLERK_WEBHOOK_SECRET.
export async function POST(request: NextRequest) {
  if (env.AUTH_PROVIDER !== "clerk" || !env.CLERK_WEBHOOK_SECRET) return new Response("Not configured", { status: 404 });
  let event;
  try {
    event = await verifyWebhook(request, { signingSecret: env.CLERK_WEBHOOK_SECRET });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "user.deleted" && event.data.id) {
    await db.user.updateMany({ where: { clerkUserId: event.data.id }, data: { clerkUserId: null } });
  }

  if (event.type === "user.updated") {
    const u = event.data;
    const user = await db.user.findUnique({ where: { clerkUserId: u.id } });
    if (user) {
      const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id);
      const email = primary?.verification?.status === "verified" ? primary.email_address.trim().toLowerCase() : null;
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || user.name;
      // Change the email only if no other BMCC record already uses it (never merge records here).
      const emailFree = email && email !== user.email && !(await db.user.findUnique({ where: { email } }));
      await db.user.update({ where: { id: user.id }, data: { name, ...(emailFree ? { email } : {}) } });
      if (email && email !== user.email && !emailFree) console.warn(`Clerk email change for ${user.id} not applied: ${email} belongs to another record`);
    }
  }
  return new Response("ok");
}
