"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail } from "@/lib/admin/forms";
import { invalidateMessageOverrides } from "@/lib/i18n/overrides";
import { builtIn, isKey, LANG_LIST, placeholders } from "@/lib/content/site-text";
import type { ActionResult } from "@/components/admin/ActionForm";

// Saves one piece of site text in every language. Text equal to the built-in text (or left
// empty) removes the edit, so the built-in text — and later improvements to it — show again.
export async function saveSiteText(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("content");
  const key = String(form.get("key") ?? "");
  if (!isKey(key)) return fail("Unknown text.");
  const needed = placeholders(builtIn(key, "en"));

  const changes: Record<string, string | null> = {};
  for (const { code, label } of LANG_LIST) {
    const value = String(form.get(`value.${code}`) ?? "").replace(/\r\n/g, "\n").trim();
    if (value.length > 3000) return fail(`${label}: the text is too long.`);
    const original = builtIn(key, code);
    if (!value || value === original.trim()) {
      changes[code] = null;
      continue;
    }
    const got = placeholders(value);
    if (needed.join() !== got.join()) {
      return fail(`${label}: keep the placeholders exactly as they are (${needed.join(", ") || "none"}). They are filled in by the site, e.g. {name} becomes the person's name.`);
    }
    changes[code] = value;
  }

  const existing = await db.messageOverride.findMany({ where: { key } });
  const diff: Record<string, { from: string | null; to: string | null }> = {};
  await db.$transaction(
    Object.entries(changes).map(([lang, value]) => {
      const before = existing.find((e) => e.lang === lang)?.value ?? null;
      if (before !== value) diff[lang] = { from: before, to: value };
      return value === null
        ? db.messageOverride.deleteMany({ where: { key, lang } })
        : db.messageOverride.upsert({ where: { key_lang: { key, lang } }, create: { key, lang, value, updatedById: user.id }, update: { value, updatedById: user.id } });
    }),
  );
  if (Object.keys(diff).length === 0) return done("No changes.");
  await audit(user.id, "update", "SiteText", key, diff);
  invalidateMessageOverrides();
  revalidatePath("/", "layout");
  return done("Saved. The site shows the new text now.");
}

export async function resetSiteText(form: FormData) {
  const user = await requireSection("content");
  const key = String(form.get("key") ?? "");
  if (!isKey(key)) redirect("/admin/content");
  const { count } = await db.messageOverride.deleteMany({ where: { key } });
  if (count) await audit(user.id, "reset", "SiteText", key);
  invalidateMessageOverrides();
  revalidatePath("/", "layout");
  redirect(`/admin/content/${key}?status=reset`);
}
