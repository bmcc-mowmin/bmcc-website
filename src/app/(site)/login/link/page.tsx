import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { signInLinkValid } from "@/lib/auth/sign-in-link";
import { signInFromLink } from "../actions";
import styles from "../login.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.login_title, robots: { index: false } };
}

// The emailed sign-in link lands here. Signing in takes a button press, because mail scanners
// open links on their own.
export default async function SignInLinkPage({ searchParams }: PageProps<"/login/link">) {
  const { t } = await getI18n();
  const { token, next } = await searchParams;
  const valid = typeof token === "string" && (await signInLinkValid(token));
  return (
    <section className={`container section-y ${styles.wrap}`}>
      <div className={styles.card}>
        {valid ? (
          <form action={signInFromLink}>
            <h1 className={styles.title}>{t.signin_link_landing_title}</h1>
            <p className={styles.note}>{t.signin_link_landing_text}</p>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
            <button type="submit" className={styles.button} style={{ width: "100%" }}>
              {t.signin_link_landing_button}
            </button>
          </form>
        ) : (
          <>
            <h1 className={styles.title}>{t.signin_link_expired_title}</h1>
            <p className={styles.note}>{t.signin_link_expired_text}</p>
            <Link href="/login" className={styles.button} style={{ textAlign: "center" }}>
              {t.login_title}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
