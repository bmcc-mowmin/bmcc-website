"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { detectImage, imageKey, MAX_IMAGE_BYTES } from "@/lib/storage/images";
import { fail, readL10n, text } from "@/lib/admin/forms";
import { getCalcSettings } from "@/lib/prayer/schedule";
import { WEEKDAY_CODES } from "@/lib/events/recurrence";
import { isClock } from "@/lib/prayer/calculate";
import { weekdayOf, zonedToUtc } from "@/lib/time";
import type { ActionResult } from "@/components/admin/ActionForm";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string, exceptId?: string) {
  let slug = base || "event";
  for (let i = 2; ; i++) {
    const clash = await db.event.findUnique({ where: { slug } });
    if (!clash || clash.id === exceptId) return slug;
    slug = `${base}-${i}`;
  }
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("events");
  const id = text(form, "id") || undefined;
  const title = readL10n(form, "title");
  const description = readL10n(form, "description");
  const tag = readL10n(form, "tag");
  const location = readL10n(form, "location");
  if (!title.en || !description.en || !tag.en || !location.en) return fail("English title, description, tag and location are required.");

  const date = text(form, "date");
  const allDay = form.get("allDay") === "on";
  const startTime = allDay ? "00:00" : text(form, "startTime");
  const endTime = allDay ? "23:59" : text(form, "endTime");
  if (!DATE.test(date)) return fail("Pick the event date.");
  if (!isClock(startTime) || !isClock(endTime)) return fail("Give a start and end time.");
  if (endTime <= startTime) return fail("The end time must be after the start time.");

  const repeat = text(form, "repeat");
  const until = text(form, "until");
  if (until && (!DATE.test(until) || until < date)) return fail("“Repeat until” must be on or after the event date.");

  const slugInput = text(form, "slug").toLowerCase();
  if (slugInput && !SLUG.test(slugInput)) return fail("The web address may only use lowercase letters, numbers and dashes.");
  const slug = await uniqueSlug(slugInput || slugify(title.en), id);

  const capacityRaw = text(form, "rsvpCapacity");
  const rsvpCapacity = capacityRaw ? Number(capacityRaw) : null;
  if (rsvpCapacity !== null && (!Number.isInteger(rsvpCapacity) || rsvpCapacity < 1 || rsvpCapacity > 10000)) return fail("The RSVP limit must be a whole number of people (or blank for no limit).");

  const { timezone } = await getCalcSettings();
  const data = {
    slug,
    title,
    description,
    tag,
    location,
    allDay,
    startAt: zonedToUtc(date, startTime, timezone),
    endAt: zonedToUtc(date, endTime, timezone),
    rrule: repeat === "weekly" ? `FREQ=WEEKLY;BYDAY=${WEEKDAY_CODES[weekdayOf(date)]}` : null,
    rruleUntil: repeat === "weekly" && until ? zonedToUtc(until, "23:59", timezone) : null,
    published: form.get("published") === "on",
    rsvpEnabled: form.get("rsvpEnabled") === "on",
    rsvpCapacity,
  };

  // Photo: optional upload, or remove the current one.
  const existing = id ? await db.event.findUnique({ where: { id }, select: { imageKey: true } }) : null;
  let newImageKey: string | null | undefined;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return fail("The photo must be 5 MB or smaller.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = detectImage(bytes);
    if (!kind) return fail("The photo must be a JPEG, PNG or WebP image.");
    newImageKey = imageKey("events", kind.ext);
    await storage.put(newImageKey, bytes, kind.type);
  } else if (form.get("removeImage") === "on") {
    newImageKey = null;
  }

  const saved = id
    ? await db.event.update({ where: { id }, data: { ...data, ...(newImageKey !== undefined ? { imageKey: newImageKey } : {}) } })
    : await db.event.create({ data: { ...data, imageKey: newImageKey ?? null } });
  if (newImageKey !== undefined && existing?.imageKey) await storage.remove(existing.imageKey).catch(() => {});

  await audit(admin.id, id ? "update" : "create", "Event", saved.id, { ...data, imageKey: saved.imageKey });
  refresh();
  redirect(`/admin/events/${saved.id}?status=${id ? "saved" : "created"}`);
}

export async function deleteEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("events");
  const id = text(form, "id");
  const row = await db.event.findUnique({ where: { id } });
  if (row) {
    await db.event.delete({ where: { id } });
    if (row.imageKey) await storage.remove(row.imageKey).catch(() => {});
    await audit(admin.id, "delete", "Event", id, { slug: row.slug });
  }
  refresh();
  redirect("/admin/events?status=deleted");
}
