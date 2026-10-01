import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { getParentCategories } from "@/lib/directory";
import { SubmitListingForm } from "./SubmitListingForm";
import styles from "./submit.module.css";

export const metadata: Metadata = { title: "Submit a listing", description: "Add your business or service to the BMCC Community Directory." };

export default async function SubmitListingPage() {
  const [{ t }, parents] = await Promise.all([getI18n(), getParentCategories()]);
  return (
    <section className="container section-y">
      <div className={styles.wrap}>
        <Link href="/community" className={styles.back}>
          {t.back_to_directory}
        </Link>
        <div className="eyebrow">{t.submit_eyebrow}</div>
        <h1 className="page-h1">{t.submit_heading}</h1>
        <p className="lead">{t.submit_paragraph}</p>
        <SubmitListingForm parents={parents} />
      </div>
    </section>
  );
}
