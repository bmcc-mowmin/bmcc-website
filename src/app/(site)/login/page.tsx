import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <section className={`container section-y ${styles.wrap}`}>
      <LoginForm next={typeof next === "string" ? next : undefined} forbidden={error === "forbidden"} />
    </section>
  );
}
