import type { Metadata } from "next";
import Link from "next/link";
import { peekToken } from "@/lib/auth/tokens";
import { SetPasswordForm } from "./SetPasswordForm";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };

export default async function SetPasswordPage({ searchParams }: PageProps<"/admin/set-password">) {
  const { token } = await searchParams;
  const row = typeof token === "string" ? await peekToken(token, "set_password") : null;
  return (
    <main className={styles.page} dir="ltr" lang="en">
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small logo */}
        <img src="/brand/bmcc-logo.jpeg" alt="Brentwood Muslim Community Center" className={styles.logo} />
        <h1 className={styles.title}>Set your password</h1>
        {row ? (
          <>
            <p className={styles.note}>
              For <strong>{row.user.email}</strong> — BMCC admin portal.
            </p>
            <SetPasswordForm token={token as string} email={row.user.email} />
          </>
        ) : (
          <>
            <p className={styles.error}>This link has expired or was already used. Ask a Super admin to resend your invite.</p>
            <Link href="/admin/login">Go to sign in</Link>
          </>
        )}
      </div>
    </main>
  );
}
