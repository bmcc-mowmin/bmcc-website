"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

// Only the sections the signed-in person's roles allow (computed on the server).
export function AdminNav({ items }: { items: { href: string; label: string; built: boolean }[] }) {
  const pathname = usePathname();
  const built = items.filter((i) => i.built);
  const coming = items.filter((i) => !i.built);
  return (
    <nav aria-label="Admin">
      {built.map((s) => {
        const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} aria-current={active ? "page" : undefined}>
            {s.label}
          </Link>
        );
      })}
      {coming.length > 0 && (
        <>
          <div className={styles.navGroup}>Coming in later phases</div>
          {coming.map((c) => (
            <span key={c.href} className={styles.navSoon}>
              {c.label}
            </span>
          ))}
        </>
      )}
    </nav>
  );
}
