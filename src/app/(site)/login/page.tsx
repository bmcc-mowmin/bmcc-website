import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.login_title, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <section className={`container section-y ${styles.wrap}`}>
      <LoginForm next={typeof next === "string" ? next : undefined} forbidden={error === "forbidden"} />
    </section>
  );
}
