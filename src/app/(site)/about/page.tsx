import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { org } from "@/lib/org";
import { routes } from "@/lib/routes";
import { AboutTabs, type AboutTab } from "./AboutTabs";
import { ContactForm } from "./ContactForm";
import styles from "./about.module.css";

export const metadata: Metadata = { title: "About Us" };

export default async function AboutPage({ searchParams }: PageProps<"/about">) {
  const { t } = await getI18n();
  const { topic } = await searchParams;

  const tabs: AboutTab[] = [
    {
      id: "about",
      label: t.tab_about,
      title: t.tab_about_title,
      body: [t.tab_about_p1, t.tab_about_p2],
      list: [t.tab_about_l1, t.tab_about_l2, t.tab_about_l3, t.tab_about_l4],
      imageLabel: "Photo — masjid community gathering",
    },
    {
      id: "resources",
      label: t.tab_resources,
      title: t.tab_resources_title,
      body: [t.tab_resources_p1],
      list: [t.tab_resources_l1, t.tab_resources_l2, t.tab_resources_l3, t.tab_resources_l4],
      imageLabel: "Photo — resource library / reading room",
    },
    {
      id: "schedule",
      label: t.tab_schedule,
      title: t.tab_schedule_title,
      body: [t.tab_schedule_p1],
      list: [t.tab_schedule_l1, t.tab_schedule_l2, t.tab_schedule_l3, t.tab_schedule_l4],
      imageLabel: "Photo — masjid exterior / entrance",
    },
    {
      id: "services",
      label: t.tab_services,
      title: t.tab_services_title,
      body: [t.tab_services_p1],
      list: [t.tab_services_l1, t.tab_services_l2, t.tab_services_l3, t.tab_services_l4],
      cta: { label: t.view_funeral_benefit, href: routes.funeral },
      imageLabel: "Photo — imam / community counseling",
    },
  ];

  return (
    <>
      <section className={`container ${styles.aboutSection}`}>
        <div className="page-intro">
          <div className="eyebrow">{t.about_eyebrow}</div>
          <h1 className="page-h1">{t.about_heading}</h1>
        </div>
        <AboutTabs tabs={tabs} />
      </section>

      <section id="contact" className={styles.contactBand}>
        <div className={`container section-y ${styles.contactGrid}`}>
          <div>
            <div className="eyebrow">{t.contact_eyebrow}</div>
            <h2 className={styles.contactH2}>{t.contact_heading}</h2>
            <p className={styles.contactP}>{t.contact_paragraph}</p>
            <dl className={styles.contactDetails}>
              <div>
                <dt>{t.contact_address}</dt>
                <dd>{org.address}</dd>
              </div>
              <div>
                <dt>{t.contact_phone}</dt>
                <dd>
                  <a href={org.phoneHref}>{org.phone}</a>
                </dd>
              </div>
              <div>
                <dt>{t.contact_email}</dt>
                <dd>
                  <a href={`mailto:${org.email}`}>{org.email}</a>
                </dd>
              </div>
            </dl>
            <iframe
              className={styles.map}
              title={t.map_label}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(`${org.legalName}, ${org.address}`)}&z=15&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <ContactForm topic={typeof topic === "string" ? topic : undefined} />
        </div>
      </section>
    </>
  );
}
