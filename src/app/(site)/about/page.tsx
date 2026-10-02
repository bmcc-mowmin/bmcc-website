import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { getOrg } from "@/lib/org";
import { slotImage } from "@/lib/media";
import { routes } from "@/lib/routes";
import { AboutTabs, type AboutTab } from "./AboutTabs";
import { ContactForm } from "./ContactForm";
import styles from "./about.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav_about_us };
}

export default async function AboutPage({ searchParams }: PageProps<"/about">) {
  const org = await getOrg();
  const { t, lang } = await getI18n();
  const { topic } = await searchParams;
  const [img1, img2, img3, img4] = await Promise.all((["about_about", "about_resources", "about_schedule", "about_services"] as const).map((s) => slotImage(s, lang)));

  const tabs: AboutTab[] = [
    {
      id: "about",
      label: t.tab_about,
      title: t.tab_about_title,
      body: [t.tab_about_p1, t.tab_about_p2],
      list: [t.tab_about_l1, t.tab_about_l2, t.tab_about_l3, t.tab_about_l4],
      imageLabel: t.about_photo_story,
      image: img1,
    },
    {
      id: "resources",
      label: t.tab_resources,
      title: t.tab_resources_title,
      body: [t.tab_resources_p1],
      list: [t.tab_resources_l1, t.tab_resources_l2, t.tab_resources_l3, t.tab_resources_l4],
      imageLabel: t.about_photo_resources,
      image: img2,
    },
    {
      id: "schedule",
      label: t.tab_schedule,
      title: t.tab_schedule_title,
      body: [t.tab_schedule_p1],
      list: [t.tab_schedule_l1, t.tab_schedule_l2, t.tab_schedule_l3, t.tab_schedule_l4],
      imageLabel: t.about_photo_exterior,
      image: img3,
    },
    {
      id: "services",
      label: t.tab_services,
      title: t.tab_services_title,
      body: [t.tab_services_p1],
      list: [t.tab_services_l1, t.tab_services_l2, t.tab_services_l3, t.tab_services_l4],
      cta: { label: t.view_funeral_benefit, href: routes.funeral },
      imageLabel: t.about_photo_counseling,
      image: img4,
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
                <dd>
                  <bdi dir="ltr">{org.address}</bdi>
                </dd>
              </div>
              <div>
                <dt>{t.contact_phone}</dt>
                <dd>
                  <a href={org.phoneHref}>
              <bdi dir="ltr">{org.phone}</bdi>
            </a>
                </dd>
              </div>
              <div>
                <dt>{t.contact_email}</dt>
                <dd>
                  <a href={`mailto:${org.email}`}>
              <bdi dir="ltr">{org.email}</bdi>
            </a>
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
