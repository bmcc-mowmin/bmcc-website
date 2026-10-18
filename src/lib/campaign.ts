import "server-only";
import { db } from "@/lib/db";
import { localize, type L10n } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";

// The New BMCC project (School and Masjid Expansion Project). Money raised = online gifts to the
// "new-bmcc" fund (counted from payments) + an offline amount the treasurer keeps up to date
// (cheques, paid pledges, gifts received before this website).

export const CAMPAIGN_FUND = "new-bmcc";

export async function getCampaign() {
  const [settings, online] = await Promise.all([
    db.campaignSettings.findUnique({ where: { id: 1 } }),
    db.payment.aggregate({ _sum: { amountCents: true }, _count: true, where: { kind: "DONATION", fund: CAMPAIGN_FUND, status: "SUCCEEDED" } }),
  ]);
  const onlineCents = online._sum.amountCents ?? 0;
  const offlineCents = settings?.offlineRaisedCents ?? 0;
  return {
    goalCents: settings?.goalCents ?? null,
    offlineCents,
    onlineCents,
    onlineGifts: online._count,
    raisedCents: onlineCents + offlineCents,
    raisedAsOf: settings?.raisedAsOf ?? null,
    showProgress: !!settings?.showProgress && !!settings?.goalCents,
  };
}

export async function getCampaignUpdates(lang: Lang, { includeDrafts = false } = {}) {
  const rows = await db.campaignUpdate.findMany({ where: includeDrafts ? {} : { published: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return rows.map((r) => ({ ...r, titleText: localize(r.title as L10n, lang), bodyText: localize(r.body as L10n, lang) }));
}
