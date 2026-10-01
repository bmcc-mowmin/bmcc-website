import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { findByUnsubscribeToken } from "@/lib/mailing-list";
import styles from "@/components/mailing-list/mailing-list.module.css";
import { unsubscribeAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.unsub_title, robots: { index: false } };
}

// The unsubscribe link in every mailing-list email. Mail apps' one-click "Unsubscribe" button
// goes to /api/unsubscribe instead.
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { t } = await getI18n();
  const { token, status } = await searchParams;
  const row = typeof token === "string" ? await findByUnsubscribeToken(token) : null;

  let body: React.ReactNode;
  if (status === "done" || row?.status === "UNSUBSCRIBED") {
    body = (
      <>
        <h1 className={styles.cardTitle}>{t.unsub_done_title}</h1>
        <p className={styles.cardText}>{t.unsub_done_text}</p>
        <Link href="/" className="btn btn-primary">
          {t.back_home}
        </Link>
      </>
    );
  } else if (row) {
    const [before, after] = t.unsub_text.split("{email}");
    body = (
      <>
        <h1 className={styles.cardTitle}>{t.unsub_title}</h1>
        <p className={styles.cardText}>
          {before}
          <strong>{row.email}</strong>
          {after}
        </p>
        <form action={unsubscribeAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary">
            {t.unsub_button}
          </button>
        </form>
      </>
    );
  } else {
    body = (
      <>
        <h1 className={styles.cardTitle}>{t.unsub_title}</h1>
        <p className={styles.cardText}>{t.unsub_invalid}</p>
        <Link href="/about#contact" className="btn btn-primary">
          {t.contact_bmcc}
        </Link>
      </>
    );
  }
  return (
    <section className={`container section-y ${styles.page}`}>
      <div className={styles.card}>{body}</div>
    </section>
  );
}
