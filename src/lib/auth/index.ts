import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "./session";

// One place to ask "who is signed in?". AUTH_PROVIDER=dev uses the local session cookie and
// the seeded test accounts; AUTH_PROVIDER=clerk is connected in phase 7 (member login).

export type CurrentUser = { id: string; email: string; name: string | null; role: "ADMIN" | "MEMBER" };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (env.AUTH_PROVIDER !== "dev") {
    throw new Error("AUTH_PROVIDER=clerk is not connected yet (phase 7).");
  }
  const userId = await readSession();
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
});

export async function requireAdmin(nextPath = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.role !== "ADMIN") redirect("/login?error=forbidden");
  return user;
}
