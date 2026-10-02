import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { builtIn, groupOf, isKey, LANG_LIST, placeholders } from "@/lib/content/site-text";
import styles from "@/components/admin/admin.module.css";
import { resetSiteText, saveSiteText } from "../actions";

export const metadata: Metadata = { title: "Edit site text" };

export default async function EditSiteText({ params, searchParams }: PageProps<"/admin/content/[key]">) {
  await requireSection("content");
  const [{ key }, { status }] = await Promise.all([params, searchParams]);
  if (!isKey(key)) notFound();
  const rows = await db.messageOverride.findMany({ where: { key } });
  const current = (lang: string) => rows.find((r) => r.lang === lang)?.value;
  const marks = placeholders(builtIn(key, "en"));
  const long = builtIn(key, "en").length > 80;

  return (
    <>
      <Link href="/admin/content">← Site text</Link>
      <h1 className={styles.pageTitle} style={{ marginTop: 10 }}>
        Edit text
      </h1>
      <p className={styles.pageLead}>
        {groupOf(key)} · <code>{key}</code>
      </p>
      {status === "reset" && (
        <p role="status" className={styles.ok}>
          Back to the built-in text in every language.
        </p>
      )}
      {marks.length > 0 && (
        <p className={styles.notice}>
          Keep {marks.map((m, i) => (
            <span key={m}>
              {i > 0 && ", "}
              <code>{m}</code>
            </span>
          ))}{" "}
          in every language — the site fills {marks.length === 1 ? "it" : "them"} in (for example, a name or a date).
        </p>
      )}
      <section className={styles.card}>
        <ActionForm key={status === "reset" ? "reset" : "edit"} action={saveSiteText} submitLabel="Save">
          <input type="hidden" name="key" value={key} />
          {LANG_LIST.map((l) => {
            const original = builtIn(key, l.code);
            const edited = current(l.code);
            return (
              <div key={l.code} className={styles.field} style={{ marginBottom: 16 }}>
                <label className={styles.label} htmlFor={`value-${l.code}`}>
                  {l.label} {edited !== undefined && <span className={styles.badge}>edited</span>}
                </label>
                <textarea
                  id={`value-${l.code}`}
                  name={`value.${l.code}`}
                  defaultValue={edited ?? original}
                  rows={long ? 4 : 2}
                  lang={l.html}
                  dir={l.rtl ? "rtl" : "ltr"}
                  className={styles.input}
                  style={{ width: "100%" }}
                />
                {edited !== undefined && (
                  <span className={styles.hint} dir={l.rtl ? "rtl" : "ltr"}>
                    Built-in: {original}
                  </span>
                )}
              </div>
            );
          })}
          <p className={styles.hint}>
            Changing the English text doesn&apos;t change the other languages — update them too. Clearing a box brings back the built-in text.
          </p>
        </ActionForm>
      </section>
      {rows.length > 0 && (
        <form action={resetSiteText} style={{ marginTop: 14 }}>
          <input type="hidden" name="key" value={key} />
          <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
            Reset to the built-in text (all languages)
          </button>
        </form>
      )}
    </>
  );
}
