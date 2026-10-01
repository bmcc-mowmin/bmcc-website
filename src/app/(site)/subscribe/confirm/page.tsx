import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { peekConfirmation } from "@/lib/mailing-list";
import styles from "@/components/mailing-list/mailing-list.module.css";
import { confirmAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.sub_confirm_title, robots: { index: false } };
}

// The link in the confirmation email lands here. Confirming takes a button press, because mail
// security scanners open links automatically and must not confirm on someone's behalf.
export default async function ConfirmSubscriptionPage({ searchParams }: PageProps<"/subscribe/confirm">) {
  const { t } = await getI18n();
  const { token, status } = await searchParams;
  const pending = typeof token === "string" ? await peekConfirmation(token) : null;

  let body: React.ReactNode;
  if (status === "done") {
    body = (
      <>
        <h1 className={styles.cardTitle}>{t.sub_confirmed_title}</h1>
        <p className={styles.cardText}>{t.sub_confirmed_text}</p>
        <Link href="/" className="btn btn-primary">
          {t.back_home}
        </Link>
      </>
    );
  } else if (pending) {
    const [before, after] = t.sub_confirm_text.split("{email}");
    body = (
      <>
        <h1 className={styles.cardTitle}>{t.sub_confirm_title}</h1>
        <p className={styles.cardText}>
          {before}
          <strong>{pending.email}</strong>
          {after}
        </p>
        <form action={confirmAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary">
            {t.sub_confirm_button}
          </button>
        </form>
      </>
    );
  } else {
    body = (
      <>
        <h1 className={styles.cardTitle}>{t.sub_invalid_title}</h1>
        <p className={styles.cardText}>{t.sub_invalid_text}</p>
        <Link href="/" className="btn btn-primary">
          {t.back_home}
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
