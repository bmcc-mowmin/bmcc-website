import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { getCampaign, getCampaignUpdates } from "@/lib/campaign";
import { usd } from "@/lib/payments/catalog";
import { masjidClock } from "@/lib/prayer/schedule";
import type { L10n } from "@/lib/i18n/dictionary";
import { ActionForm } from "@/components/admin/ActionForm";
import { L10nField } from "@/components/admin/L10nField";
import styles from "@/components/admin/admin.module.css";
import { addUpdate, deleteUpdate, editUpdate, saveCampaign } from "./actions";

export const metadata: Metadata = { title: "New BMCC project" };

const money = (cents: number | null) => (cents == null ? "" : (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }));
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function CampaignAdmin() {
  await requireSection("campaign");
  const [c, updates, { date: today }] = await Promise.all([getCampaign(), getCampaignUpdates("en", { includeDrafts: true }), masjidClock()]);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
  const pct = c.goalCents ? Math.min(100, Math.round((c.raisedCents / c.goalCents) * 100)) : null;

  return (
    <>
      <div className={styles.monthNav}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          New BMCC project
        </h1>
        <Link href="/new-bmcc" target="_blank" style={{ marginInlineStart: "auto", fontSize: 14 }}>
          View the project page ↗
        </Link>
      </div>
      <p className={styles.pageLead}>
        The School and Masjid Expansion Project on the 8.16-acre land. This page sets the figures and posts updates; the page&apos;s
        wording is in <Link href="/admin/content?q=nb_">Site text</Link> and its photos are the{" "}
        <Link href="/admin/media?show=new-bmcc#library-title">New BMCC project</Link> collection in the Media library.
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{usd(c.raisedCents)}</div>
          <div className={styles.statLabel}>Raised in total{pct != null ? ` · ${pct}% of ${usd(c.goalCents!)}` : ""}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{usd(c.onlineCents)}</div>
          <div className={styles.statLabel}>Online gifts to the fund ({c.onlineGifts}) — counted automatically</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{usd(c.offlineCents)}</div>
          <div className={styles.statLabel}>Received other ways (entered below)</div>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="figures-title">
        <h2 id="figures-title" className={styles.cardTitle}>
          Goal and progress
        </h2>
        <ActionForm action={saveCampaign} submitLabel="Save">
          <div className={styles.grid2} style={{ gap: "14px 20px" }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="c-goal">
                Goal ($)
              </label>
              <input id="c-goal" name="goal" inputMode="decimal" defaultValue={money(c.goalCents)} placeholder="e.g. 2,500,000" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="c-offline">
                Raised other ways ($)
              </label>
              <input id="c-offline" name="offline" inputMode="decimal" defaultValue={money(c.offlineCents)} placeholder="0" className={styles.input} />
              <span className={styles.hint}>Cheques, cash, paid pledges and gifts made before this website. Online gifts are added on their own.</span>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="c-asof">
                Figures as of
              </label>
              <input id="c-asof" name="asOf" type="date" defaultValue={dateInput(c.raisedAsOf)} max={today} className={styles.input} />
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14.5, marginTop: 12 }}>
            <input type="checkbox" name="showProgress" defaultChecked={c.showProgress} /> Show the progress bar on the project page
          </label>
        </ActionForm>
      </section>

      <section className={styles.card} aria-labelledby="add-update-title">
        <h2 id="add-update-title" className={styles.cardTitle}>
          Post an update
        </h2>
        <ActionForm action={addUpdate} submitLabel="Add update" resetOnSuccess>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-date">
              Date
            </label>
            <input id="new-date" name="date" type="date" defaultValue={today} required className={styles.input} style={{ width: 200 }} />
          </div>
          <L10nField name="title" label="Title" idPrefix="new" />
          <L10nField name="body" label="Text" multiline idPrefix="new" />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14.5 }}>
            <input type="checkbox" name="published" defaultChecked /> Published
          </label>
        </ActionForm>
      </section>

      <section className={styles.card} aria-labelledby="updates-title">
        <h2 id="updates-title" className={styles.cardTitle}>
          Updates ({updates.length})
        </h2>
        {updates.length === 0 && <p className={styles.muted}>No updates yet. The page says updates will appear there.</p>}
        {updates.map((u) => (
          <article key={u.id} aria-label={u.titleText} style={{ borderTop: "1px solid var(--border)", padding: "14px 0" }}>
            <div className={styles.monthNav} style={{ flexWrap: "wrap" }}>
              <strong>{u.titleText}</strong>
              <span className={styles.muted}>{day.format(u.date)}</span>
              {!u.published && <span className={`${styles.badge} ${styles.badgeWarn}`}>Draft</span>}
            </div>
            <p style={{ margin: "6px 0", whiteSpace: "pre-line" }}>{u.bodyText}</p>
            <details>
              <summary className={styles.label} style={{ cursor: "pointer" }}>
                Edit
              </summary>
              <ActionForm action={editUpdate} submitLabel="Save update">
                <input type="hidden" name="id" value={u.id} />
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`d-${u.id}`}>
                    Date
                  </label>
                  <input id={`d-${u.id}`} name="date" type="date" defaultValue={dateInput(u.date)} required className={styles.input} style={{ width: 200 }} />
                </div>
                <L10nField name="title" label="Title" value={u.title as L10n} idPrefix={`t-${u.id}`} />
                <L10nField name="body" label="Text" value={u.body as L10n} multiline idPrefix={`b-${u.id}`} />
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14.5 }}>
                  <input type="checkbox" name="published" defaultChecked={u.published} /> Published
                </label>
              </ActionForm>
            </details>
            <ActionForm action={deleteUpdate} submitLabel="Delete" variant="danger" confirm="Delete this update?">
              <input type="hidden" name="id" value={u.id} />
            </ActionForm>
          </article>
        ))}
      </section>
    </>
  );
}
