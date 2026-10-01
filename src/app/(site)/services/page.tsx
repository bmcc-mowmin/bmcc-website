import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { contactHref, routes } from "@/lib/routes";
import { ExpandableCards, type ExpandableCard } from "@/components/cards/ExpandableCards";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav_services };
}

export default async function ServicesPage() {
  const { t } = await getI18n();
  const cards: ExpandableCard[] = [
    { id: "dua", icon: "🤲", title: t.svc_dua_title, description: t.svc_dua_desc, detail: t.svc_dua_detail, cta: t.svc_dua_cta, href: contactHref("dua") },
    { id: "counseling", icon: "◐", title: t.svc_counseling_title, description: t.svc_counseling_desc, detail: t.svc_counseling_detail, cta: t.svc_counseling_cta, href: contactHref("counseling") },
    { id: "imam", icon: "✎", title: t.svc_imam_title, description: t.svc_imam_desc, detail: t.svc_imam_detail, cta: t.svc_imam_cta, href: contactHref("imam") },
    { id: "immigration", icon: "◈", title: t.svc_immigration_title, description: t.svc_immigration_desc, detail: t.svc_immigration_detail, cta: t.svc_immigration_cta, href: contactHref("immigration") },
    { id: "nikah", icon: "❖", title: t.svc_nikah_title, description: t.svc_nikah_desc, detail: t.svc_nikah_detail, cta: t.svc_nikah_cta, href: contactHref("nikah") },
    { id: "divorce", icon: "◇", title: t.svc_divorce_title, description: t.svc_divorce_desc, detail: t.svc_divorce_detail, cta: t.svc_divorce_cta, href: contactHref("divorce") },
    { id: "facility", icon: "⌂", title: t.svc_facility_title, description: t.svc_facility_desc, detail: t.svc_facility_detail, cta: t.svc_facility_cta, href: contactHref("facility") },
    { id: "funeral", icon: "✦", title: t.svc_funeral_title, description: t.svc_funeral_desc, detail: t.svc_funeral_detail, cta: t.svc_funeral_cta, href: routes.funeral },
  ];
  return (
    <section className="container section-y">
      <div className="page-intro">
        <div className="eyebrow">{t.services_eyebrow}</div>
        <h1 className="page-h1">{t.services_heading}</h1>
        <p className="lead">{t.services_paragraph}</p>
      </div>
      <ExpandableCards cards={cards} moreLabel={t.more_label} lessLabel={t.less_label} />
    </section>
  );
}
