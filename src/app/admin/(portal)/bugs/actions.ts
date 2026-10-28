"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { done, fail, text } from "@/lib/admin/forms";
import { deleteBugFiles, notifyAssignee, notifyReporter } from "@/lib/bugs";
import { AREAS, ASSIGNEE_STATUSES, bugRef, CLOSED_STATUSES, dueDate, isArea, isPriority, isStatus, parseBugRef, priorityLabel, statusLabel, areaLabel } from "@/lib/bugs/rules";
import type { ActionResult } from "@/components/admin/ActionForm";


function refresh(number?: number) {
  revalidatePath("/admin/bugs");
  if (number) revalidatePath(`/admin/bugs/${number}`);
  revalidatePath("/admin");
}

async function load(id: string) {
  return db.bugReport.findUnique({ where: { id } });
}

// Priority, area and owner. Setting a priority and an owner on a new report moves it to Triaged;
// the due date follows the priority (P1 1 day, P2 3 days, P3 14 days, P4 none).
export async function triageBug(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("bugs_triage");
  const bug = await load(text(form, "id"));
  if (!bug) return fail("Bug not found.");
  const area = text(form, "area") || null;
  const priority = text(form, "priority") || null;
  const assigneeId = text(form, "assigneeId") || null;
  if (area && !isArea(area)) return fail("Choose an area.");
  if (priority && !isPriority(priority)) return fail("Choose a priority.");
  if (assigneeId && !(await db.user.findFirst({ where: { id: assigneeId, disabled: false, NOT: { adminRoles: { isEmpty: true } } } }))) return fail("Choose an admin as the owner.");

  const now = new Date();
  const triagedAt = bug.triagedAt ?? (priority && assigneeId ? now : null);
  const data: Parameters<typeof db.bugReport.update>[0]["data"] = { area, priority: priority as never, assigneeId };
  if (priority !== bug.priority) data.dueAt = priority ? dueDate(priority as never, triagedAt ?? now) : null;
  if (bug.status === "NEW" && priority && assigneeId) {
    data.status = "TRIAGED";
    data.triagedAt = now;
  }
  await db.bugReport.update({ where: { id: bug.id }, data });

  const events: { kind: string; body: string }[] = [];
  if (area !== bug.area) events.push({ kind: "area", body: `Area: ${areaLabel(bug.area)} → ${areaLabel(area)}` });
  if (priority !== bug.priority) events.push({ kind: "priority", body: `Priority: ${priorityLabel(bug.priority)} → ${priorityLabel(priority)}` });
  if (assigneeId !== bug.assigneeId) {
    const who = assigneeId ? await db.user.findUnique({ where: { id: assigneeId } }) : null;
    events.push({ kind: "assignee", body: who ? `Assigned to ${who.name ?? who.email}` : "Unassigned" });
  }
  if (data.status) events.push({ kind: "status", body: `Status: ${statusLabel(bug.status)} → ${statusLabel("TRIAGED")}` });
  if (events.length) await db.bugEvent.createMany({ data: events.map((e) => ({ ...e, bugId: bug.id, actorId: user.id })) });
  await audit(user.id, "triage", "BugReport", bug.id, { area, priority, assigneeId });

  if (assigneeId && assigneeId !== bug.assigneeId && assigneeId !== user.id) {
    await notifyAssignee(bug.id, assigneeId, user.name ?? user.email).catch((e) => console.error("assignee email failed", e));
  }
  refresh(bug.number);
  return done(events.length ? "Saved." : "Nothing changed.");
}

export async function setBugStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("bugs");
  const bug = await load(text(form, "id"));
  if (!bug) return fail("Bug not found.");
  const status = text(form, "status");
  if (!isStatus(status)) return fail("Choose a status.");
  if (status === bug.status) return done("Nothing changed.");
  const triager = can(user.adminRoles, "bugs_triage");
  if (!triager && (bug.assigneeId !== user.id || !ASSIGNEE_STATUSES.includes(status))) {
    return fail("Only the owner can change this bug's status, and only super admins can close or reopen bugs.");
  }
  if (status === "DUPLICATE") return fail("Use “Mark as duplicate” so the original bug is linked.");
  const closing = status === "FIXED" || (CLOSED_STATUSES as readonly string[]).includes(status);
  await db.bugReport.update({
    where: { id: bug.id },
    data: { status, resolvedAt: closing ? (bug.resolvedAt ?? new Date()) : null, ...(status === "TRIAGED" ? { duplicateOfId: null } : {}) },
  });
  const note = text(form, "note");
  await db.bugEvent.create({ data: { bugId: bug.id, actorId: user.id, kind: "status", body: `Status: ${statusLabel(bug.status)} → ${statusLabel(status)}${note ? `\n${note}` : ""}` } });
  await audit(user.id, "status", "BugReport", bug.id, { from: bug.status, to: status });

  let emailed = false;
  if (text(form, "notify") === "1" && (status === "FIXED" || status === "NEED_INFO" || status === "CLOSED" || status === "WONT_FIX" || status === "CANNOT_REPRODUCE")) {
    emailed = await notifyReporter(bug.id, "status").catch(() => false);
    if (emailed) await db.bugEvent.create({ data: { bugId: bug.id, actorId: user.id, kind: "reply", body: `Reporter emailed: ${statusLabel(status)}` } });
  }
  refresh(bug.number);
  return done(`Status set to ${statusLabel(status)}.${emailed ? " The reporter was emailed." : ""}`);
}

export async function markDuplicate(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("bugs_triage");
  const bug = await load(text(form, "id"));
  if (!bug) return fail("Bug not found.");
  const number = parseBugRef(text(form, "of"));
  const original = number ? await db.bugReport.findUnique({ where: { number } }) : null;
  if (!original) return fail("Enter the number of the original bug, e.g. BUG-0003.");
  if (original.id === bug.id) return fail("A bug can't be a duplicate of itself.");
  await db.bugReport.update({ where: { id: bug.id }, data: { status: "DUPLICATE", duplicateOfId: original.id, resolvedAt: new Date() } });
  await db.bugEvent.createMany({
    data: [
      { bugId: bug.id, actorId: user.id, kind: "duplicate", body: `Closed as a duplicate of ${bugRef(original.number)}` },
      { bugId: original.id, actorId: user.id, kind: "duplicate", body: `${bugRef(bug.number)} was closed as a duplicate of this bug` },
    ],
  });
  await audit(user.id, "duplicate", "BugReport", bug.id, { of: original.id });
  refresh(bug.number);
  refresh(original.number);
  return done(`Closed as a duplicate of ${bugRef(original.number)}.`);
}

// An internal note, or a reply emailed to the reporter.
export async function addBugComment(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("bugs");
  const bug = await load(text(form, "id"));
  if (!bug) return fail("Bug not found.");
  const body = text(form, "body").slice(0, 5000);
  if (!body) return fail("Write a comment first.");
  const toReporter = text(form, "toReporter") === "1";
  if (toReporter && !bug.reporterEmail) return fail("The reporter didn't leave an email address.");
  if (toReporter) {
    const sent = await notifyReporter(bug.id, "reply", body).catch((e) => {
      console.error("reporter email failed", e);
      return false;
    });
    if (!sent) return fail("The email couldn't be sent. Try again later.");
  }
  await db.bugEvent.create({ data: { bugId: bug.id, actorId: user.id, kind: toReporter ? "reply" : "note", body } });
  await audit(user.id, toReporter ? "reply" : "note", "BugReport", bug.id);
  refresh(bug.number);
  return done(toReporter ? "Reply emailed to the reporter." : "Note added.");
}

export async function deleteBug(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("bugs_triage");
  const bug = await load(text(form, "id"));
  if (!bug) return fail("Bug not found.");
  await deleteBugFiles(bug.id);
  await db.bugReport.delete({ where: { id: bug.id } });
  await audit(user.id, "delete", "BugReport", bug.id, { number: bug.number, title: bug.title });
  refresh();
  redirect("/admin/bugs?deleted=1");
}

export async function saveAreaOwners(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("bugs_triage");
  const staff = new Set((await db.user.findMany({ where: { disabled: false, NOT: { adminRoles: { isEmpty: true } } }, select: { id: true } })).map((u) => u.id));
  const owners = AREAS.map((a) => ({ area: a.id, ownerId: text(form, `owner.${a.id}`) || null }));
  if (owners.some((o) => o.ownerId && !staff.has(o.ownerId))) return fail("Owners must be active admins.");
  await db.$transaction(owners.map((o) => db.bugAreaOwner.upsert({ where: { area: o.area }, create: o, update: { ownerId: o.ownerId } })));
  await audit(user.id, "area_owners", "BugAreaOwner", "all", owners);
  revalidatePath("/admin/bugs", "layout");
  return done("Area owners saved.");
}
