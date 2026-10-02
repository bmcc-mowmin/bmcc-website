import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionary";
import { ensureMessageOverrides, invalidateMessageOverrides } from "@/lib/i18n/overrides";
import { ALL_KEYS, builtIn, GROUPS, groupOf, LANG_LIST, overridesByKey } from "@/lib/content/site-text";
import { normalize, queryTerms } from "@/lib/search/normalize";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Site text" };
const PAGE = 60;

export default async function SiteTextAdmin({ searchParams }: PageProps<"/admin/content">) {
  await requireSection("content");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const group = typeof params.group === "string" ? params.group : "";
  const edited = params.edited === "1";
  const page = Math.max(1, Number(params.page) || 1);
  // Admins always see what's saved now (the public site may lag up to 15 s on other servers).
  invalidateMessageOverrides();
  await ensureMessageOverrides();
  const overrides = await overridesByKey();
  const t = getDictionary("en");
  const terms = queryTerms(q);
  // Search the key and the text in every language, as shown now and as built in.
  const dicts = LANG_LIST.map((l) => getDictionary(l.code));

  const rows = ALL_KEYS.filter((k) => {
    if (group && !GROUPS.find((g) => g.id === group)?.keys.test(k)) return false;
    if (edited && !overrides.has(k)) return false;
    if (!terms.length) return true;
    const hay = ` ${normalize([k.replace(/_/g, " "), ...dicts.map((d) => d[k]), ...LANG_LIST.map((l) => builtIn(k, l.code))].join(" "))}`;
    return terms.every((term) => hay.includes(term));
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const link = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(group ? { group } : {}), ...(edited ? { edited: "1" } : {}), page: String(p) })}`;

  return (
    <>
      <h1 className={styles.pageTitle}>Site text</h1>
      <p className={styles.pageLead}>
        Every piece of built-in text on the website, in all five languages: headings, buttons, page paragraphs, form messages and
        emails. Find it by searching for words you see on the page (in any language). Events, announcements and other
        content are edited in their own sections.
      </p>
      <form className={styles.row} style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <input name="q" defaultValue={q} placeholder="Words on the page, e.g. “Donate Now”" aria-label="Search site text" className={styles.input} style={{ width: 320 }} />
        <select name="group" defaultValue={group} aria-label="Page or area" className={styles.select}>
          <option value="">All pages</option>
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input type="checkbox" name="edited" value="1" defaultChecked={edited} /> Edited only
        </label>
        <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
          Search
        </button>
      </form>
      <section className={styles.card}>
        <p className={styles.muted} style={{ marginTop: 0 }}>
          {rows.length} {rows.length === 1 ? "text" : "texts"}
          {overrides.size > 0 && ` · ${overrides.size} edited`}
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>English text</th>
                <th>Where</th>
                <th>Edited</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((k) => {
                const langs = [...(overrides.get(k)?.keys() ?? [])];
                return (
                  <tr key={k}>
                    <td style={{ whiteSpace: "normal", maxWidth: 560 }}>
                      <Link href={`/admin/content/${k}`} style={{ fontWeight: 600 }}>
                        {t[k].length > 140 ? `${t[k].slice(0, 140)}…` : t[k]}
                      </Link>
                      <div className={styles.muted} style={{ fontSize: 12 }}>
                        {k}
                      </div>
                    </td>
                    <td className={styles.muted}>{groupOf(k)}</td>
                    <td>{langs.length ? <span className={styles.badge}>{LANG_LIST.filter((l) => langs.includes(l.code)).map((l) => l.label).join(", ")}</span> : <span className={styles.muted}>—</span>}</td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={3} className={styles.muted}>
                    No text matches. Try fewer words.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className={styles.pager}>
            {page > 1 && <Link href={link(page - 1)}>← Previous</Link>}
            <span className={styles.muted}>
              Page {page} of {pages}
            </span>
            {page < pages && <Link href={link(page + 1)}>Next →</Link>}
          </div>
        )}
      </section>
    </>
  );
}
