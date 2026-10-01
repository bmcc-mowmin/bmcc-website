import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { contactHref, routes } from "@/lib/routes";
import { ExpandableCards, type ExpandableCard } from "@/components/cards/ExpandableCards";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav_assistance };
}

export default async function AssistancePage() {
  const { t } = await getI18n();
  const cards: ExpandableCard[] = [
    { id: "zakat", icon: "✦", title: t.a_zakat_title, description: t.a_zakat_desc, detail: t.a_zakat_detail, cta: t.a_zakat_cta, href: routes.donate },
    { id: "pantry", icon: "◈", title: t.a_pantry_title, description: t.a_pantry_desc, detail: t.a_pantry_detail, cta: t.a_pantry_cta, href: contactHref("pantry") },
    { id: "refugee", icon: "◇", title: t.a_refugee_title, description: t.a_refugee_desc, detail: t.a_refugee_detail, cta: t.a_refugee_cta, href: contactHref("refugee") },
    { id: "funeral", icon: "❖", title: t.a_funeral_title, description: t.a_funeral_desc, detail: t.a_funeral_detail, cta: t.a_funeral_cta, href: routes.funeral },
    { id: "clothing", icon: "⌂", title: t.a_clothing_title, description: t.a_clothing_desc, detail: t.a_clothing_detail, cta: t.a_clothing_cta, href: contactHref("clothing") },
    { id: "furniture", icon: "◐", title: t.a_furniture_title, description: t.a_furniture_desc, detail: t.a_furniture_detail, cta: t.a_furniture_cta, href: contactHref("furniture") },
    { id: "vehicle", icon: "✎", title: t.a_vehicle_title, description: t.a_vehicle_desc, detail: t.a_vehicle_detail, cta: t.a_vehicle_cta, href: contactHref("vehicle") },
  ];
  return (
    <section className="container section-y">
      <div className="page-intro">
        <div className="eyebrow">{t.assist_eyebrow}</div>
        <h1 className="page-h1">{t.assist_heading}</h1>
        <p className="lead">{t.assist_paragraph}</p>
      </div>
      <ExpandableCards cards={cards} moreLabel={t.more_label} lessLabel={t.less_label} />
    </section>
  );
}
