import "server-only";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";

export type TickerItem = { id: string; text: string; href: string | null };

// Items whose start/end window includes now, in admin sort order. Empty = hide the ticker.
export async function getActiveAnnouncements(lang: Lang, now = new Date()): Promise<TickerItem[]> {
  const rows = await db.announcement.findMany({
    where: { active: true, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] },
    orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }],
  });
  return rows
    .map((r) => ({ id: r.id, text: localize(r.text, lang), href: r.link }))
    .filter((r) => r.text);
}
