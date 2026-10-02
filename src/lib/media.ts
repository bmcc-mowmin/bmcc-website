import "server-only";
import { db } from "@/lib/db";
import { cached, invalidate } from "@/lib/content/cache";
import { localize, type L10n } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";
import { mediaUrl } from "@/lib/events";

// Places on the site that show a photo chosen from the media library (Admin → Media library).
// Until a photo is chosen, the page shows the striped placeholder from the design.
export const SLOTS = [
  { slot: "logo", label: "Logo (header, footer and admin)", hint: "A wide PNG or JPEG, at least 400 px wide. Shown about 50 px tall." },
  { slot: "about_about", label: "About Us — “About” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "about_resources", label: "About Us — “Resources” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "about_schedule", label: "About Us — “Schedule” tab", hint: "Landscape, at least 1200 px wide." },
  { slot: "about_services", label: "About Us — “Services” tab", hint: "Landscape, at least 1200 px wide." },
] as const;
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
    return new Map(rows.filter((r) => r.media).map((r) => [r.slot, { url: mediaUrl(r.media!.storageKey)!, alt: r.media!.alt as L10n }]));
  });
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
