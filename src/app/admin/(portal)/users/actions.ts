"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUrl, env, isProduction } from "@/lib/env";
import { requireSection, type CurrentUser } from "@/lib/auth";
import { ADMIN_ROLES, ROLE_INFO, type AdminRole } from "@/lib/auth/permissions";
import { createToken } from "@/lib/auth/tokens";
import { audit } from "@/lib/audit";
import { buttonHtml, escapeHtml, layoutHtml, sendMail } from "@/lib/mail";
import { done, fail, text } from "@/lib/admin/forms";
import type { ActionResult } from "@/components/admin/ActionForm";

const INVITE_HOURS = 72;

function readRoles(form: FormData): AdminRole[] {
  const picked = form.getAll("roles").map(String);
  return ADMIN_ROLES.filter((r) => picked.includes(r));
}

// At least one active super admin must always remain.
async function otherActiveSuperAdmins(exceptId: string) {
  return db.user.count({ where: { id: { not: exceptId }, disabled: false, adminRoles: { has: "SUPER_ADMIN" } } });
}

async function sendInvite(user: { id: string; email: string; name: string | null }, invitedBy: CurrentUser) {
  const by = invitedBy.name ?? invitedBy.email;
  if (env.AUTH_PROVIDER === "clerk") {
    // Clerk: they create a login with this email; their roles are already waiting for it.
    const link = adminUrl("/admin/login?mode=sign-up");
    await sendMail({
      to: user.email,
      subject: "You're invited to the BMCC admin portal",
      text: `Assalamu alaikum${user.name ? ` ${user.name}` : ""},\n\n${by} invited you to the Brentwood Muslim Community Center admin portal.\n\nCreate your login with this email address (${user.email}):\n${link}\n\nAlready have a BMCC login with this email? Just sign in. If you weren't expecting this, you can ignore this email.`,
      html: layoutHtml(
        "You're invited to the BMCC admin portal",
        `<p>Assalamu alaikum${user.name ? ` ${escapeHtml(user.name)}` : ""},</p><p>${escapeHtml(by)} invited you to the Brentwood Muslim Community Center admin portal.</p><p>Create your login with this email address: <strong>${escapeHtml(user.email)}</strong></p>${buttonHtml(link, "Create your login")}<p style="color:#6b7280;font-size:13px">Already have a BMCC login with this email? Just sign in. If you weren't expecting this, you can ignore this email.</p>`,
      ),
    });
    return link;
  }
  const token = await createToken(user.id, "set_password", INVITE_HOURS);
  const link = adminUrl(`/admin/set-password?token=${token}`);
  await sendMail({
    to: user.email,
    subject: "You're invited to the BMCC admin portal",
    text: `Assalamu alaikum${user.name ? ` ${user.name}` : ""},\n\n${by} invited you to the Brentwood Muslim Community Center admin portal.\n\nSet your password here (the link works once and expires in ${INVITE_HOURS} hours):\n${link}\n\nIf you weren't expecting this, you can ignore this email.`,
    html: layoutHtml(
      "You're invited to the BMCC admin portal",
      `<p>Assalamu alaikum${user.name ? ` ${escapeHtml(user.name)}` : ""},</p><p>${escapeHtml(by)} invited you to the Brentwood Muslim Community Center admin portal.</p>${buttonHtml(link, "Set your password")}<p style="color:#6b7280;font-size:13px">The link works once and expires in ${INVITE_HOURS} hours. If you weren't expecting this, you can ignore this email.</p>`,
    ),
  });
  return link;
}

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().max(100).optional() });

export async function inviteStaff(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireSection("users");
  const parsed = inviteSchema.safeParse({ email: text(form, "email"), name: text(form, "name") || undefined });
  if (!parsed.success) return fail("Enter a valid email address.");
  const roles = readRoles(form);
  if (!roles.length) return fail("Pick at least one role.");
  const { email, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.adminRoles.length) return fail(`${email} is already an admin — change their roles below.`);
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { adminRoles: roles, disabled: false, name: existing.name ?? name } })
    : await db.user.create({ data: { email, name, adminRoles: roles } });

  let link: string;
  try {
    link = await sendInvite(user, me);
  } catch (e) {
    console.error("invite email failed", e);
    return fail("The account was created but the invite email could not be sent. Check the email settings, then use “Resend invite”.");
  }
  await audit(me.id, "invite", "User", user.id, { email, roles });
  revalidatePath("/admin/users");
  // Locally, also show the link so it can be opened without checking Mailpit.
  return done(isProduction ? `Invite sent to ${email}.` : `Invite sent to ${email}. Local link: ${link}`);
}

export async function updateStaffRoles(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireSection("users");
  const id = text(form, "id");
  const roles = readRoles(form);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return fail("User not found.");
  if (!roles.length) return fail("Pick at least one role, or use “Remove admin access”.");
  if (user.adminRoles.includes("SUPER_ADMIN") && !roles.includes("SUPER_ADMIN")) {
    if (id === me.id) return fail("You can't remove your own Super admin role.");
    if (!(await otherActiveSuperAdmins(id))) return fail("There must always be at least one active Super admin.");
  }
  await db.user.update({ where: { id }, data: { adminRoles: roles } });
  await audit(me.id, "update_roles", "User", id, { from: user.adminRoles, to: roles });
  revalidatePath("/admin", "layout");
  return done(`Roles saved: ${roles.map((r) => ROLE_INFO[r].label).join(", ")}.`);
}

export async function setStaffDisabled(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireSection("users");
  const id = text(form, "id");
  const disable = text(form, "disable") === "1";
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return fail("User not found.");
  if (disable && id === me.id) return fail("You can't disable your own account.");
  if (disable && user.adminRoles.includes("SUPER_ADMIN") && !(await otherActiveSuperAdmins(id))) {
    return fail("There must always be at least one active Super admin.");
  }
  await db.user.update({ where: { id }, data: { disabled: disable } });
  await audit(me.id, disable ? "disable" : "enable", "User", id);
  revalidatePath("/admin/users");
  return done(disable ? "Disabled — they are signed out and can't sign in." : "Enabled.");
}

export async function removeStaffAccess(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireSection("users");
  const id = text(form, "id");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return fail("User not found.");
  if (id === me.id) return fail("You can't remove your own admin access.");
  if (user.adminRoles.includes("SUPER_ADMIN") && !(await otherActiveSuperAdmins(id))) {
    return fail("There must always be at least one active Super admin.");
  }
  // The person keeps their account (e.g. as a member); only admin roles are removed.
  await db.user.update({ where: { id }, data: { adminRoles: [] } });
  await audit(me.id, "remove_access", "User", id, { roles: user.adminRoles });
  revalidatePath("/admin/users");
  return done("Admin access removed.");
}

export async function resendInvite(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireSection("users");
  const user = await db.user.findUnique({ where: { id: text(form, "id") } });
  if (!user || !user.adminRoles.length) return fail("User not found.");
  try {
    const link = await sendInvite(user, me);
    await audit(me.id, "resend_invite", "User", user.id);
    return done(isProduction ? `Invite re-sent to ${user.email}.` : `Invite re-sent. Local link: ${link}`);
  } catch (e) {
    console.error("invite email failed", e);
    return fail("The invite email could not be sent. Check the email settings.");
  }
}
