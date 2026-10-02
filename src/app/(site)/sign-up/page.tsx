import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/auth/password-login";
import { env } from "@/lib/env";
import { ClerkSignUp } from "@/components/auth/ClerkScreens";
import styles from "../login/login.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.create_account, robots: { index: false } };
}

// Create an account (Clerk). Using the email given to BMCC brings the person's membership,
// receipts and RSVPs into the new account.
export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  // The local dev login has no sign-up (test accounts come from the seed).
  if (env.AUTH_PROVIDER !== "clerk") redirect("/login");
  const { t } = await getI18n();
  const { next } = await searchParams;
  const redirectTo = safeNext(typeof next === "string" ? next : undefined, "/account");
  if (await getCurrentUser()) redirect(redirectTo);
  return (
    <section className={`container section-y ${styles.wrap}`}>
      <div className={styles.stack} style={{ alignItems: "center", maxWidth: 480 }}>
        <p className={styles.new}>{t.signup_note}</p>
        <ClerkSignUp redirectTo={redirectTo} signInUrl="/login" />
      </div>
    </section>
  );
}
