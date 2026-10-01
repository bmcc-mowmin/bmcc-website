"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

// Sections appear here as each build phase lands.
const SECTIONS = [
  { href: "/admin/prayer-times", label: "Prayer times" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/announcements", label: "Announcements" },
];
const COMING = ["Directory queue", "Memberships", "Donations", "Subscribers", "Messages"];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <div className="visually-hidden">Admin sections</div>
      {SECTIONS.map((s) => {
        const active = pathname.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} aria-current={active ? "page" : undefined}>
            {s.label}
          </Link>
        );
      })}
      <div className={styles.navGroup}>Coming in later phases</div>
      {COMING.map((c) => (
        <span key={c} className={styles.navSoon}>
          {c}
        </span>
      ))}
    </nav>
  );
}
