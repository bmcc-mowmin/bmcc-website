import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "./session";
import { can, isStaff, type AdminRole, type Section } from "./permissions";

// One place to ask "who is signed in?". AUTH_PROVIDER=dev uses the local session cookie and
// the seeded test accounts; AUTH_PROVIDER=clerk is connected at go-live (GO_LIVE.md).

export type CurrentUser = { id: string; email: string; name: string | null; adminRoles: AdminRole[] };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (env.AUTH_PROVIDER !== "dev") {
    throw new Error("AUTH_PROVIDER=clerk is connected at go-live (GO_LIVE.md). Use AUTH_PROVIDER=dev locally.");
  }
  const userId = await readSession();
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, adminRoles: true, disabled: true },
  });
  // A disabled account is signed out everywhere on its next request.
  if (!user || user.disabled) return null;
  return { id: user.id, email: user.email, name: user.name, adminRoles: user.adminRoles };
});

export const ADMIN_LOGIN = "/admin/login";

// Signed in with at least one admin role.
export async function requireStaff(nextPath = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${ADMIN_LOGIN}?next=${encodeURIComponent(nextPath)}`);
  if (!isStaff(user.adminRoles)) redirect(`${ADMIN_LOGIN}?error=forbidden`);
  return user;
}

// Signed in AND allowed in this section. Use in every admin page and every server action.
export async function requireSection(section: Section): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!can(user.adminRoles, section)) redirect("/admin?denied=1");
  return user;
}

// Any signed-in person (member, donor or staff). Member pages redirect to the public sign-in.
export async function requireMember(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
