"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, readL10n, text } from "@/lib/admin/forms";
import type { ActionResult } from "@/components/admin/ActionForm";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// "$1,250,000" or "1250000.50" → cents; blank → null.
function dollars(v: string): number | null | "bad" {
  const clean = v.replace(/[$,\s]/g, "");
  if (!clean) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return "bad";
  return Math.round(Number(clean) * 100);
}
const refresh = () => {
  revalidatePath("/new-bmcc");
  revalidatePath("/admin/new-bmcc");
};

export async function saveCampaign(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("campaign");
  const goal = dollars(text(form, "goal"));
  const offline = dollars(text(form, "offline"));
  if (goal === "bad" || offline === "bad") return fail("Enter amounts in dollars, e.g. 2,500,000.");
  const asOf = text(form, "asOf");
  if (asOf && !DATE.test(asOf)) return fail("Pick a valid date.");
  const showProgress = form.get("showProgress") === "on";
  if (showProgress && !goal) return fail("Set a goal before showing progress on the page.");
  const data = { goalCents: goal, offlineRaisedCents: offline ?? 0, raisedAsOf: asOf ? new Date(`${asOf}T12:00:00Z`) : null, showProgress };
  await db.campaignSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  await audit(user.id, "update", "Campaign", "new-bmcc", data);
  refresh();
  return done("Saved. The project page is updated.");
}

function readUpdate(form: FormData) {
  const date = text(form, "date");
  const title = readL10n(form, "title");
  const body = readL10n(form, "body");
  if (!DATE.test(date)) return { error: "Pick the update's date." } as const;
  if (!title.en || !body.en) return { error: "The English title and text are required." } as const;
  return { data: { date: new Date(`${date}T00:00:00Z`), title, body, published: form.get("published") === "on" } } as const;
}

export async function addUpdate(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("campaign");
  const r = readUpdate(form);
  if ("error" in r) return fail(r.error!);
  const saved = await db.campaignUpdate.create({ data: r.data });
  await audit(user.id, "create", "CampaignUpdate", saved.id);
  refresh();
  return done("Update added.");
}

export async function editUpdate(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("campaign");
  const id = text(form, "id");
  const r = readUpdate(form);
  if ("error" in r) return fail(r.error!);
  const { count } = await db.campaignUpdate.updateMany({ where: { id }, data: r.data });
  if (!count) return fail("Update not found.");
  await audit(user.id, "update", "CampaignUpdate", id);
  refresh();
  return done("Saved.");
}

export async function deleteUpdate(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("campaign");
  const id = text(form, "id");
  const { count } = await db.campaignUpdate.deleteMany({ where: { id } });
  if (!count) return fail("Update not found.");
  await audit(user.id, "delete", "CampaignUpdate", id);
  refresh();
  return done("Deleted.");
}
