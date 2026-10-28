import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { ReportForm } from "./ReportForm";
import styles from "./report.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.bug_heading, description: t.bug_paragraph, robots: { index: false } };
}

// Only same-site paths are accepted as "the page with the problem".
const safePath = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v.slice(0, 500) : "");

export default async function ReportProblemPage({ searchParams }: PageProps<"/report-a-problem">) {
  const [{ t }, user, params] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  return (
    <section className="container section-y">
      <div className={styles.wrap}>
        <div className="eyebrow">{t.bug_eyebrow}</div>
        <h1 className="page-h1">{t.bug_heading}</h1>
        <p className="lead">{t.bug_paragraph}</p>
        <ReportForm from={safePath(params.from)} signedIn={user ? { name: user.name ?? "", email: user.email } : null} />
      </div>
    </section>
  );
}
