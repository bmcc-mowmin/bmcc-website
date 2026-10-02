"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, readL10n, text } from "@/lib/admin/forms";
import { storage } from "@/lib/storage";
import { detectImage, imageKey, MAX_IMAGE_BYTES } from "@/lib/storage/images";
import { invalidateSlots, isSlot, SLOTS } from "@/lib/media";
import type { ActionResult } from "@/components/admin/ActionForm";

function refresh() {
  invalidateSlots();
  revalidatePath("/", "layout");
}

export async function uploadMedia(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("media");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo to upload.");
  if (file.size > MAX_IMAGE_BYTES) return fail("The photo must be 5 MB or smaller.");
  const alt = readL10n(form, "alt");
  if (!alt.en) return fail("Describe the photo in English (for people using screen readers).");
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) return fail("The photo must be a JPEG, PNG or WebP image.");
  const storageKey = imageKey("library", kind.ext);
  await storage.put(storageKey, bytes, kind.type);
  const asset = await db.mediaAsset.create({
    data: { storageKey, filename: file.name.slice(0, 200) || `photo.${kind.ext}`, contentType: kind.type, sizeBytes: file.size, alt, uploadedById: user.id },
  });
  await audit(user.id, "upload", "MediaAsset", asset.id, { filename: asset.filename });
  revalidatePath("/admin/media");
  return done(`Uploaded “${asset.filename}”.`);
}

export async function updateMediaAlt(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("media");
  const id = text(form, "id");
  const alt = readL10n(form, "alt");
  if (!alt.en) return fail("The English description is required.");
  const { count } = await db.mediaAsset.updateMany({ where: { id }, data: { alt } });
  if (!count) return fail("Photo not found.");
  await audit(user.id, "update", "MediaAsset", id, { alt });
  refresh();
  return done("Saved.");
}

export async function deleteMedia(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("media");
  const asset = await db.mediaAsset.findUnique({ where: { id: text(form, "id") }, include: { slots: true } });
  if (!asset) return fail("Photo not found.");
  if (asset.slots.length) {
    const where = asset.slots.map((s) => SLOTS.find((x) => x.slot === s.slot)?.label ?? s.slot).join(", ");
    return fail(`This photo is in use (${where}). Choose another photo there first.`);
  }
  await db.mediaAsset.delete({ where: { id: asset.id } });
  await storage.remove(asset.storageKey).catch((e) => console.error("media file delete failed", e));
  await audit(user.id, "delete", "MediaAsset", asset.id, { filename: asset.filename });
  revalidatePath("/admin/media");
  return done("Deleted.");
}

export async function setSlot(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("media");
  const slot = text(form, "slot");
  if (!isSlot(slot)) return fail("Unknown place on the site.");
  const mediaId = text(form, "mediaId") || null;
  if (mediaId && !(await db.mediaAsset.findUnique({ where: { id: mediaId } }))) return fail("Photo not found.");
  await db.imageSlot.upsert({ where: { slot }, create: { slot, mediaId }, update: { mediaId } });
  await audit(user.id, "set_photo", "ImageSlot", slot, { mediaId });
  refresh();
  return done(mediaId ? "Photo set. The site shows it now." : "Photo removed; the placeholder shows again.");
}
