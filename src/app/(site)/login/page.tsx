import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/auth/password-login";
import { routes } from "@/lib/routes";
import { env } from "@/lib/env";
import { ClerkSignIn } from "@/components/auth/ClerkScreens";
import { LoginForm } from "./LoginForm";
import { SignInLinkForm } from "./SignInLinkForm";
import styles from "./login.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.login_title, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { t } = await getI18n();
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  // Already signed in (and not sent here for lacking admin access): go straight on.
  if (error !== "forbidden" && (await getCurrentUser())) redirect(safeNext(nextPath, "/account"));
  if (env.AUTH_PROVIDER === "clerk") {
    return (
      <section className={`container section-y ${styles.wrap}`}>
        <ClerkSignIn redirectTo={safeNext(nextPath, "/account")} signUpUrl="/sign-up" />
      </section>
    );
  }
  return (
    <section className={`container section-y ${styles.wrap}`}>
      <div className={styles.stack}>
        <LoginForm next={nextPath} forbidden={error === "forbidden"} />
        <SignInLinkForm next={nextPath} />
        <p className={styles.new}>
          {t.login_new} <Link href={routes.membership}>{t.login_register}</Link>
        </p>
      </div>
    </section>
  );
}
