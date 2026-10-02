import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMyHousehold } from "@/lib/account";
import { routes } from "@/lib/routes";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { formatDate } from "../format";
import { ContactForm, CoverageRequestForm } from "./forms";
import styles from "../account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.acct_tab_household, robots: { index: false } };
}

const REL_KEY: Record<string, MessageKey> = {
  SELF: "rel_self",
  SPOUSE: "m2_rel_spouse",
  CHILD: "m2_rel_child",
  PARENT: "m2_rel_parent",
  SIBLING: "m2_rel_sibling",
  OTHER: "m2_rel_other",
};

export default async function HouseholdPage() {
  const user = await requireMember("/account/household");
  const { t, lang } = await getI18n();
  const mine = await getMyHousehold(user);
  if (!mine) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t.acct_no_membership_title}</h2>
        <p className={styles.text}>{t.acct_no_membership_text}</p>
        <Link href={routes.membership} className="btn btn-primary">
          {t.nav_membership}
        </Link>
      </div>
    );
  }
  const h = mine.household;
  // dateOfBirth is a calendar date (stored at UTC midnight).
  const dob = (d: Date) => formatDate(d, lang, "UTC");

  return (
    <>
      <section className={styles.card} aria-labelledby="covered-title">
        <h2 id="covered-title" className={styles.cardTitle}>
          {t.acct_covered_title}
        </h2>
        <ul className={styles.people}>
          {h.members.map((p) => (
            <li key={p.id}>
              <span className={styles.personName}>
                <bdi>{p.fullName}</bdi>
              </span>
              <span className={styles.muted}>
                {t[REL_KEY[p.relationship]]}
                {p.dateOfBirth ? ` · ${dob(p.dateOfBirth)}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <h3 className={styles.subTitle}>{t.acct_change_people_title}</h3>
        <p className={styles.text}>{t.acct_change_people_text}</p>
        <CoverageRequestForm />
      </section>

      <section className={styles.card} aria-labelledby="contact-title">
        <h2 id="contact-title" className={styles.cardTitle}>
          {t.acct_contact_title}
        </h2>
        <ContactForm
          initial={{
            addressLine1: h.addressLine1,
            addressLine2: h.addressLine2 ?? "",
            city: h.city,
            state: h.state,
            zip: h.zip,
            phone: h.phone,
            emergencyName: h.emergencyName,
            emergencyPhone: h.emergencyPhone,
          }}
        />
      </section>
    </>
  );
}
