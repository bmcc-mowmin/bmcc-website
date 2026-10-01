"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, readL10n, text } from "@/lib/admin/forms";
import { getCalcSettings } from "@/lib/prayer/schedule";
import { zonedToUtc } from "@/lib/time";
import type { ActionResult } from "@/components/admin/ActionForm";

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/; // <input type="datetime-local">

export async function saveAnnouncement(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(form, "id") || undefined;
  const textL10n = readL10n(form, "text");
  if (!textL10n.en) return fail("The English text is required.");
  if (textL10n.en.length > 240) return fail("Keep the ticker text under 240 characters.");

  const link = text(form, "link");
  if (link && !/^\/[^/]/.test(link) && !/^https:\/\//.test(link) && link !== "/") {
    return fail("The link must be a site path like /events or a full https:// address.");
  }

  const { timezone } = await getCalcSettings();
  const start = LOCAL.exec(text(form, "startAt"));
  const endRaw = text(form, "endAt");
  const end = endRaw ? LOCAL.exec(endRaw) : null;
  if (!start) return fail("Choose when it starts showing.");
  if (endRaw && !end) return fail("Invalid end date.");
  const startAt = zonedToUtc(start[1], start[2], timezone);
  const endAt = end ? zonedToUtc(end[1], end[2], timezone) : null;
  if (endAt && endAt <= startAt) return fail("The end must be after the start.");

  const data = {
    text: textL10n,
    link: link || null,
    startAt,
    endAt,
    sortOrder: Number(text(form, "sortOrder")) || 0,
    active: form.get("active") === "on",
  };
  const row = id ? await db.announcement.update({ where: { id }, data }) : await db.announcement.create({ data });
  await audit(admin.id, id ? "update" : "create", "Announcement", row.id, data);
  revalidatePath("/", "layout");
  return done(id ? "Saved." : "Announcement added.");
}

export async function deleteAnnouncement(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  await db.announcement.deleteMany({ where: { id } });
  await audit(admin.id, "delete", "Announcement", id);
  revalidatePath("/", "layout");
  return done("Deleted.");
}
