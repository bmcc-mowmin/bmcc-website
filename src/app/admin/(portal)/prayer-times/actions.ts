"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { done, fail, optionalText, readL10n, text } from "@/lib/admin/forms";
import { CALC_METHODS, DAILY_PRAYERS, HIGH_LAT_RULES, isClock } from "@/lib/prayer/calculate";
import { SOURCE_OPTIONS } from "@/lib/prayer/sources";
import type { ActionResult } from "@/components/admin/ActionForm";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

// After a day is saved/cleared, reload the editor so its inputs show the stored values.
function backToDay(date: string, status: "saved" | "cleared"): never {
  redirect(`/admin/prayer-times?month=${date.slice(0, 7)}&date=${date}&status=${status}#editor`);
}

function refresh() {
  // Prayer times appear in the header on every page.
  revalidatePath("/", "layout");
}

// ── Single-day override ──────────────────────────────────────────────────────

export async function saveDayOverride(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const date = text(form, "date");
  if (!DATE.test(date)) return fail("Pick a valid date.");

  const times: Record<string, string | null> = {};
  for (const p of DAILY_PRAYERS) {
    for (const kind of ["Adhan", "Iqamah"] as const) {
      const v = text(form, `${p}${kind}`);
      if (v && !isClock(v)) return fail(`${p} ${kind}: use HH:MM.`);
      times[`${p}${kind}`] = v || null;
    }
  }

  const jumuah = [0, 1, 2]
    .map((i) => ({
      label: text(form, `jumuah.${i}.label`),
      khutbah: text(form, `jumuah.${i}.khutbah`),
      iqamah: text(form, `jumuah.${i}.iqamah`),
      location: text(form, `jumuah.${i}.location`),
    }))
    .filter((j) => j.khutbah || j.iqamah || j.label);
  for (const j of jumuah) {
    if (!isClock(j.khutbah) || !isClock(j.iqamah)) return fail("Each Jumu'ah row needs a khutbah and an iqamah time.");
    if (!j.label) j.label = "Jumu'ah";
  }

  const note = optionalText(form, "note");
  const empty = Object.values(times).every((v) => !v) && jumuah.length === 0 && !note;
  if (empty) {
    await db.prayerDayOverride.deleteMany({ where: { date: asDate(date) } });
    await audit(admin.id, "delete", "PrayerDayOverride", date);
    refresh();
    backToDay(date, "cleared");
  }

  const data = { ...times, note, jumuah: jumuah.length ? jumuah : Prisma.DbNull };
  await db.prayerDayOverride.upsert({
    where: { date: asDate(date) },
    create: { date: asDate(date), ...data },
    update: data,
  });
  await audit(admin.id, "upsert", "PrayerDayOverride", date, { ...times, note, jumuah });
  refresh();
  backToDay(date, "saved");
}

export async function clearDayOverride(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const date = text(form, "date");
  if (!DATE.test(date)) return fail("Invalid date.");
  await db.prayerDayOverride.deleteMany({ where: { date: asDate(date) } });
  await audit(admin.id, "delete", "PrayerDayOverride", date);
  refresh();
  backToDay(date, "cleared");
}

// ── Uploaded monthly PDF ─────────────────────────────────────────────────────

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function uploadTimetable(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const month = text(form, "month");
  const file = form.get("file");
  if (!MONTH.test(month)) return fail("Invalid month.");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a PDF file.");
  if (file.size > MAX_PDF_BYTES) return fail("The PDF must be 10 MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return fail("That file is not a PDF.");

  const storageKey = `timetables/${month}.pdf`;
  await storage.put(storageKey, bytes, "application/pdf");
  await db.timetablePdf.upsert({
    where: { month },
    create: { month, storageKey, uploadedById: admin.id },
    update: { storageKey, uploadedById: admin.id },
  });
  await audit(admin.id, "upload", "TimetablePdf", month, { size: file.size, name: file.name });
  return done(`Uploaded. Visitors now get this PDF for ${month}.`);
}

export async function removeTimetable(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const month = text(form, "month");
  if (!MONTH.test(month)) return fail("Invalid month.");
  const row = await db.timetablePdf.findUnique({ where: { month } });
  if (row) {
    await storage.remove(row.storageKey);
    await db.timetablePdf.delete({ where: { month } });
    await audit(admin.id, "delete", "TimetablePdf", month);
  }
  return done(`Removed. ${month} uses the generated PDF again.`);
}

// ── Iqamah rules ─────────────────────────────────────────────────────────────

const ruleSchema = z
  .object({
    prayer: z.enum(["FAJR", "DHUHR", "ASR", "MAGHRIB", "ISHA"]),
    mode: z.enum(["OFFSET", "FIXED"]),
    offsetMinutes: z.coerce.number().int().min(0).max(120).optional(),
    fixedTime: z.string().optional(),
    effectiveFrom: z.string().regex(DATE),
    effectiveTo: z.string().regex(DATE).optional().or(z.literal("")),
  })
  .refine((r) => (r.mode === "OFFSET" ? r.offsetMinutes !== undefined : isClock(r.fixedTime)), {
    message: "Give minutes after Adhan, or a fixed HH:MM time.",
  })
  .refine((r) => !r.effectiveTo || r.effectiveTo >= r.effectiveFrom, { message: "The end date is before the start date." });

export async function addIqamahRule(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const raw = Object.fromEntries(form);
  if (raw.mode === "OFFSET") delete raw.fixedTime;
  if (raw.mode === "FIXED") delete raw.offsetMinutes;
  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const r = parsed.data;
  const rule = await db.iqamahRule.create({
    data: {
      prayer: r.prayer,
      mode: r.mode,
      offsetMinutes: r.mode === "OFFSET" ? r.offsetMinutes : null,
      fixedTime: r.mode === "FIXED" ? r.fixedTime : null,
      effectiveFrom: asDate(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? asDate(r.effectiveTo) : null,
    },
  });
  await audit(admin.id, "create", "IqamahRule", rule.id, r);
  refresh();
  return done("Rule added.");
}

export async function deleteIqamahRule(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const id = text(form, "id");
  await db.iqamahRule.deleteMany({ where: { id } });
  await audit(admin.id, "delete", "IqamahRule", id);
  refresh();
  return done("Rule deleted.");
}

// ── Jumu'ah services ─────────────────────────────────────────────────────────

export async function saveJumuahService(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const id = text(form, "id");
  const khutbahTime = text(form, "khutbahTime");
  const iqamahTime = text(form, "iqamahTime");
  if (!isClock(khutbahTime) || !isClock(iqamahTime)) return fail("Khutbah and Iqamah need HH:MM times.");
  const label = readL10n(form, "label");
  const location = readL10n(form, "location");
  const note = readL10n(form, "note");
  if (!label.en || !location.en) return fail("English name and location are required.");
  const data = {
    label,
    location,
    note: note.en ? note : Prisma.DbNull,
    khutbahTime,
    iqamahTime,
    sortOrder: Number(text(form, "sortOrder")) || 0,
    active: form.get("active") === "on",
  };
  const row = id
    ? await db.jumuahService.update({ where: { id }, data })
    : await db.jumuahService.create({ data });
  await audit(admin.id, id ? "update" : "create", "JumuahService", row.id, { ...data, note });
  refresh();
  return done(id ? "Saved." : "Jumu'ah service added.");
}

export async function deleteJumuahService(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const id = text(form, "id");
  await db.jumuahService.deleteMany({ where: { id } });
  await audit(admin.id, "delete", "JumuahService", id);
  refresh();
  return done("Deleted.");
}

// ── Calculation settings ─────────────────────────────────────────────────────

const settingsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  calcMethod: z.enum(CALC_METHODS as [string, ...string[]]),
  highLatRule: z.enum(HIGH_LAT_RULES),
});

export async function saveCalcSettings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const current = await db.prayerSettings.findUnique({ where: { id: 1 } });
  await db.prayerSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data, timezone: current?.timezone ?? "America/Los_Angeles", madhab: "Hanafi" },
    update: parsed.data,
  });
  await audit(admin.id, "update", "PrayerSettings", "1", parsed.data);
  refresh();
  return done("Settings saved. All calculated times now use them.");
}

// ── Times source ─────────────────────────────────────────────────────────────

export async function saveSource(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("prayer");
  const id = text(form, "source");
  const option = SOURCE_OPTIONS.find((o) => o.id === id);
  if (!option) return fail("Unknown source.");
  if (!option.available) return fail(`${option.label} isn't available yet.`);
  await db.prayerSettings.update({ where: { id: 1 }, data: { source: id } });
  await audit(admin.id, "update", "PrayerSettings", "1", { source: id });
  refresh();
  return done(`Prayer times now come from: ${option.label}.`);
}
