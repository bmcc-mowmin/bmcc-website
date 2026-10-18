import "server-only";
import { db } from "@/lib/db";
import { cached, invalidate } from "@/lib/content/cache";
import { localize, type L10n } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";
import { mediaUrl } from "@/lib/events";

// Every photo belongs to one collection, which decides where it may appear:
//   general   — anywhere on the site;
//   new-bmcc  — only on the New BMCC project page (the land, plans, progress);
//   archive   — nowhere (kept for the record, e.g. old photos from earlier fundraisers).
export const COLLECTIONS = [
  { id: "general", label: "General", hint: "Can be used anywhere on the site." },
  { id: "new-bmcc", label: "New BMCC project", hint: "Only on the New BMCC project page (the land, plans and progress)." },
  { id: "archive", label: "Archive", hint: "Kept but shown nowhere — e.g. old or outdated photos from earlier fundraisers." },
] as const;
export type Collection = (typeof COLLECTIONS)[number]["id"];
export const isCollection = (v: unknown): v is Collection => COLLECTIONS.some((c) => c.id === v);

// Places on the site that show a photo chosen from the media library (Admin → Media library).
// Each takes photos from one collection only. Until a photo is chosen, the page shows its default.
export const SLOTS = [
  { slot: "logo", collection: "general", label: "Logo (header, footer and admin)", hint: "A wide PNG or JPEG, at least 400 px wide. Shown about 50 px tall." },
  { slot: "home_photo", collection: "general", label: "Home — wide photo under the opening", hint: "Landscape, at least 1600 px wide. Leave empty to show no photo." },
  { slot: "about_about", collection: "general", label: "About Us — “About” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "about_resources", collection: "general", label: "About Us — “Resources” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "about_schedule", collection: "general", label: "About Us — “Schedule” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "about_services", collection: "general", label: "About Us — “Services” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "new_bmcc_hero", collection: "new-bmcc", label: "New BMCC project — main photo", hint: "The land or the plans, landscape, at least 1600 px wide." },
  { slot: "new_bmcc_why", collection: "general", label: "New BMCC project — “Why a new masjid” photo", hint: "A current photo of today's crowded prayers, landscape." },
] as const satisfies readonly { slot: string; collection: Collection; label: string; hint: string }[];
export type Slot = (typeof SLOTS)[number]["slot"];
export const isSlot = (v: unknown): v is Slot => SLOTS.some((s) => s.slot === v);

export const DEFAULT_LOGO = "/brand/bmcc-logo.jpeg";
const NAME = "image-slots";

export async function getSlotImages() {
  return cached(NAME, 15_000, async () => {
    // If the database can't be reached, the placeholders and the built-in logo show.
    const rows = await db.imageSlot.findMany({ where: { mediaId: { not: null } }, include: { media: true } }).catch((e) => {
      if (process.env.NEXT_PHASE !== "phase-production-build") console.error("photo slots unavailable", e); // no database while building
      return [];
    });
    // A photo shows only in a slot of its own collection (an archived photo never shows).
    const ok = (r: (typeof rows)[number]) => r.media && SLOTS.find((s) => s.slot === r.slot)?.collection === r.media.collection;
    return new Map(rows.filter(ok).map((r) => [r.slot, { url: mediaUrl(r.media!.storageKey)!, alt: r.media!.alt as L10n }]));
  });
}

// The New BMCC project page's gallery: every photo in that collection, in order.
export async function collectionPhotos(collection: Collection, lang: Lang) {
  const rows = await db.mediaAsset.findMany({ where: { collection }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({ id: r.id, url: mediaUrl(r.storageKey)!, alt: localize(r.alt as L10n, lang) }));
}

// The photo for a slot in the visitor's language, or null (= show the placeholder).
export async function slotImage(slot: Slot, lang: Lang) {
  const img = (await getSlotImages()).get(slot);
  return img ? { url: img.url, alt: localize(img.alt, lang) } : null;
}

export async function logoUrl() {
  return (await getSlotImages()).get("logo")?.url ?? DEFAULT_LOGO;
}

export function invalidateSlots() {
  invalidate(NAME);
}
