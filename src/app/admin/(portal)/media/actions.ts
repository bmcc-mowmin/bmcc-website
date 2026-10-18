"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, readL10n, text } from "@/lib/admin/forms";
import { storage } from "@/lib/storage";
import { detectImage, imageKey, MAX_IMAGE_BYTES } from "@/lib/storage/images";
import { invalidateSlots, isCollection, isSlot, SLOTS } from "@/lib/media";
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
  const collection = text(form, "collection");
  if (!isCollection(collection)) return fail("Choose where the photo may be used.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) return fail("The photo must be a JPEG, PNG or WebP image.");
  const storageKey = imageKey("library", kind.ext);
  await storage.put(storageKey, bytes, kind.type);
  const asset = await db.mediaAsset.create({
    data: { storageKey, filename: file.name.slice(0, 200) || `photo.${kind.ext}`, contentType: kind.type, sizeBytes: file.size, alt, collection, uploadedById: user.id },
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
  if (mediaId) {
    const asset = await db.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!asset) return fail("Photo not found.");
    const wanted = SLOTS.find((s) => s.slot === slot)!.collection;
    if (asset.collection !== wanted) return fail("That photo's collection doesn't belong in this place. Change its collection first.");
  }
  await db.imageSlot.upsert({ where: { slot }, create: { slot, mediaId }, update: { mediaId } });
  await audit(user.id, "set_photo", "ImageSlot", slot, { mediaId });
  refresh();
  return done(mediaId ? "Photo set. The site shows it now." : "Photo removed; the placeholder shows again.");
}

// Move a photo to another collection. Leaving a collection takes it out of any place on the site
// that belongs to the old one (so an archived photo disappears from the site at once).
export async function setCollection(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("media");
  const id = text(form, "id");
  const collection = text(form, "collection");
  if (!isCollection(collection)) return fail("Unknown collection.");
  const asset = await db.mediaAsset.findUnique({ where: { id }, include: { slots: true } });
  if (!asset) return fail("Photo not found.");
  if (asset.collection === collection) return done("No change.");
  const leaving = asset.slots.filter((s) => SLOTS.find((x) => x.slot === s.slot)?.collection !== collection).map((s) => s.slot);
  await db.$transaction([
    db.mediaAsset.update({ where: { id }, data: { collection } }),
    db.imageSlot.updateMany({ where: { slot: { in: leaving }, mediaId: id }, data: { mediaId: null } }),
  ]);
  await audit(user.id, "set_collection", "MediaAsset", id, { from: asset.collection, to: collection, removedFrom: leaving });
  refresh();
  revalidatePath("/new-bmcc");
  return done(leaving.length ? `Moved. It was taken off: ${leaving.map((s) => SLOTS.find((x) => x.slot === s)?.label ?? s).join(", ")}.` : "Moved.");
}
