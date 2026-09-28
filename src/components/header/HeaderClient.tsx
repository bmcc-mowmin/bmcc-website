"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n, setLangPreference } from "@/components/i18n/I18nProvider";
import { LANGS, type Lang } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { TickerItem } from "@/lib/content/announcements";
import { routes } from "@/lib/routes";
import { NextPrayer, type PrayerFeed } from "./NextPrayer";
import { Ticker } from "./Ticker";
import styles from "./Header.module.css";

type MenuItem = { id: string; label: string; href: string; description: string; external?: boolean };
type Menu = { id: string; label: string; href?: string; items?: MenuItem[]; childIds: string[] };

function buildMenus(t: Dictionary): Menu[] {
  return [
    { id: "home", label: t.nav_home, href: routes.home, childIds: [] },
    { id: "prayer", label: t.nav_prayer, href: routes.prayerTimes, childIds: [] },
    {
      id: "programs",
      label: t.nav_programs,
      childIds: ["hikmah", "events"],
      items: [
        { id: "hikmah", label: t.nav_hikmah, href: routes.hikmahSchool, external: true, description: t.nav_hikmah_desc },
        { id: "events", label: t.nav_events, href: routes.events, description: t.nav_events_desc },
      ],
    },
    { id: "community", label: t.nav_community, href: routes.community, childIds: [] },
    {
      id: "services-assistance",
      label: t.nav_services_assistance,
      childIds: ["services", "assistance"],
      items: [
        { id: "services", label: t.nav_services, href: routes.services, description: t.nav_services_desc },
        { id: "assistance", label: t.nav_assistance, href: routes.assistance, description: t.nav_assistance_desc },
      ],
    },
    {
      id: "give",
      label: t.nav_give,
      childIds: ["donate", "membership"],
      items: [
        { id: "donate", label: t.nav_donate, href: routes.donate, description: t.nav_donate_desc },
        { id: "membership", label: t.nav_membership, href: routes.membership, description: t.nav_membership_desc },
      ],
    },
    { id: "funeral", label: t.nav_funeral_short, href: routes.funeral, childIds: [] },
    {
      id: "about",
      label: t.nav_about,
      childIds: ["about", "contact"],
      items: [
        { id: "about", label: t.nav_about_us, href: routes.about, description: t.nav_about_us_desc },
        { id: "contact", label: t.nav_contact, href: routes.contact, description: t.nav_contact_desc },
      ],
    },
  ];
}

// Which top-level tab gets the 2px underline.
function currentId(pathname: string) {
  const map: Record<string, string> = {
    [routes.home]: "home",
    [routes.prayerTimes]: "prayer",
    [routes.events]: "events",
    [routes.community]: "community",
    [routes.services]: "services",
    [routes.assistance]: "assistance",
    [routes.donate]: "donate",
    [routes.membership]: "membership",
    [routes.funeral]: "funeral",
    [routes.about]: "about",
  };
  const base = "/" + (pathname.split("/")[1] ?? "");
  return map[base] ?? "";
}

function linkProps(item: { href: string; external?: boolean }) {
  return item.external ? { target: "_blank", rel: "noopener" } : {};
}

export function HeaderClient({ announcements, prayer }: { announcements: TickerItem[]; prayer: PrayerFeed }) {
  const { t, lang, dir } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const current = currentId(pathname);
  const menus = buildMenus(t);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navListRef = useRef<HTMLDivElement>(null);
  // True when the menu labels don't fit (longer languages such as Spanish), so the header
  // switches to the menu button even above the 1140px breakpoint.
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    const list = navListRef.current;
    if (!nav || !list) return;
    const observer = new ResizeObserver(() => {
      setNavCollapsed(nav.clientWidth > 0 && list.scrollWidth > nav.clientWidth + 1);
    });
    observer.observe(nav);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const uid = useId();

  // Close menus when clicking outside the header, or on Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenMenuId(null);
      setLangOpen(false);
      setMobileNavOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Navigating closes everything (state adjusted during render, not in an effect).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpenMenuId(null);
    setMobileNavOpen(false);
  }

  const selectLang = (code: Lang) => {
    setLangOpen(false);
    if (code === lang) return;
    setLangPreference(code);
    window.location.reload();
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`${routes.search}?q=${encodeURIComponent(q)}`);
  };

  const langLabel = (LANGS.find((l) => l.code === lang) ?? LANGS[0]).label;

  return (
    <div ref={rootRef} dir={dir}>
      {/* UTILITY BAR */}
      <div className={styles.utility}>
        <div className={styles.utilityInner}>
          <NextPrayer feed={prayer} />

          {announcements.length > 0 && <Ticker items={announcements} label={t.announcements_label} />}

          <div className={styles.utilityRight}>
            <div className={styles.langWrap}>
              <button
                type="button"
                className={styles.langButton}
                aria-haspopup="true"
                aria-expanded={langOpen}
                aria-controls={`${uid}-lang`}
                onClick={() => setLangOpen((o) => !o)}
              >
                {langLabel}
                <span className={styles.caret} aria-hidden>
                  ▾
                </span>
              </button>
              {langOpen && (
                <div id={`${uid}-lang`} className={styles.langMenu} role="group" aria-label="Language">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      lang={l.html}
                      aria-current={l.code === lang ? "true" : undefined}
                      className={styles.langItem}
                      onClick={() => selectLang(l.code)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href={routes.memberLogin} className={styles.memberLogin}>
              {t.member_login}
            </Link>
            <Link href={routes.donate} className={styles.donateButton}>
              {t.header_donate}
            </Link>
          </div>
        </div>
      </div>

      {/* HEADER / MEGA NAV */}
      <header className={`${styles.header} ${navCollapsed ? styles.navCollapsed : ""}`}>
        <div className={styles.headerInner}>
          <Link href={routes.home} className={styles.logoLink}>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size logo */}
            <img src="/brand/bmcc-logo.jpeg" alt="Brentwood Muslim Community Center" className={styles.logo} />
          </Link>

          <nav ref={navRef} className={styles.desktopNav} aria-label="Main" aria-hidden={navCollapsed || undefined}>
            <div ref={navListRef} className={styles.navList}>
              {menus.map((m) => {
                const active = current === m.id || m.childIds.includes(current);
                const cls = `${styles.navTab} ${active ? styles.navTabActive : ""}`;
                return (
                  <div key={m.id} className={styles.navItem}>
                    {m.items ? (
                      <>
                        <button
                          type="button"
                          className={cls}
                          aria-expanded={openMenuId === m.id}
                          aria-controls={`${uid}-${m.id}`}
                          onClick={() => setOpenMenuId((id) => (id === m.id ? null : m.id))}
                        >
                          {m.label}{" "}
                          <span className={styles.caret} aria-hidden>
                            ▾
                          </span>
                        </button>
                        {openMenuId === m.id && (
                          <div id={`${uid}-${m.id}`} className={styles.dropdown}>
                            {m.items.map((it) => (
                              <Link key={it.id} href={it.href} className={styles.dropdownItem} {...linkProps(it)}>
                                <div className={styles.dropdownLabel}>{it.label}</div>
                                <div className={styles.dropdownDesc}>{it.description}</div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link href={m.href!} className={cls} aria-current={active ? "page" : undefined}>
                        {m.label}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          <div className={styles.headerTools}>
            <form role="search" className={styles.searchWrap} onSubmit={submitSearch}>
              {searchOpen && (
                <input
                  type="search"
                  aria-label={t.search_placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search_placeholder}
                  autoFocus
                  className={styles.searchInput}
                />
              )}
              <button
                type={searchOpen && searchQuery.trim() ? "submit" : "button"}
                aria-label="Search"
                aria-expanded={searchOpen}
                className={styles.searchButton}
                onClick={(e) => {
                  if (!(searchOpen && searchQuery.trim())) {
                    e.preventDefault();
                    setSearchOpen((o) => !o);
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.4" y2="16.4" />
                </svg>
              </button>
            </form>
            <button
              type="button"
              className={styles.mobileToggle}
              aria-label="Menu"
              aria-expanded={mobileNavOpen}
              aria-controls={`${uid}-mobile`}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              ≡
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav id={`${uid}-mobile`} className={styles.mobileNav} aria-label="Main">
            {menus.map((m) => (
              <div key={m.id}>
                {m.items ? (
                  <>
                    <div className={styles.mobileGroupLabel}>{m.label}</div>
                    <div className={styles.mobileGroupItems}>
                      {m.items.map((it) => (
                        <Link key={it.id} href={it.href} className={styles.mobileSubLink} {...linkProps(it)}>
                          {it.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link href={m.href!} className={styles.mobileLink}>
                    {m.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        )}
      </header>
    </div>
  );
}
