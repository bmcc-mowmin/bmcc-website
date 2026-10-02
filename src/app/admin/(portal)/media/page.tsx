import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { localize, type L10n } from "@/lib/i18n/dictionary";
import { mediaUrl } from "@/lib/events";
import { DEFAULT_LOGO, SLOTS } from "@/lib/media";
import { masjidClock } from "@/lib/prayer/schedule";
import { ActionForm } from "@/components/admin/ActionForm";
import { L10nField } from "@/components/admin/L10nField";
import styles from "@/components/admin/admin.module.css";
import { deleteMedia, setSlot, updateMediaAlt, uploadMedia } from "./actions";

export const metadata: Metadata = { title: "Media library" };

const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

export default async function MediaAdmin() {
  await requireSection("media");
  const [assets, slots, { timeZone }] = await Promise.all([
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, include: { slots: true } }),
    db.imageSlot.findMany(),
    masjidClock(),
  ]);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone });
  const chosen = (slot: string) => slots.find((s) => s.slot === slot)?.mediaId ?? "";

  return (
    <>
      <h1 className={styles.pageTitle}>Media library</h1>
      <p className={styles.pageLead}>
        Upload photos once and use them on the site. JPEG, PNG or WebP, up to 5 MB. Event photos are added on each event.
      </p>

      <section className={styles.card} aria-labelledby="slots-title">
        <h2 id="slots-title" className={styles.cardTitle}>
          Photos on the site
        </h2>
        <div className={styles.slotGrid}>
          {SLOTS.map((s) => {
            const current = assets.find((a) => a.id === chosen(s.slot));
            return (
              <div key={s.slot} className={styles.slot} aria-label={s.label} role="group">
                <div className={styles.slotPreview}>
                  {current ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin preview
                    <img src={mediaUrl(current.storageKey)!} alt="" />
                  ) : s.slot === "logo" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- current built-in logo
                    <img src={DEFAULT_LOGO} alt="" />
                  ) : (
                    <span className={styles.muted}>Placeholder</span>
                  )}
                </div>
                <strong>{s.label}</strong>
                <span className={styles.hint}>{s.hint}</span>
                <ActionForm action={setSlot} submitLabel="Use this photo" variant="secondary">
                  <input type="hidden" name="slot" value={s.slot} />
                  <label className="visually-hidden" htmlFor={`slot-${s.slot}`}>
                    Photo for {s.label}
                  </label>
                  <select id={`slot-${s.slot}`} name="mediaId" defaultValue={chosen(s.slot)} className={styles.select} style={{ width: "100%" }}>
                    <option value="">{s.slot === "logo" ? "Built-in logo" : "No photo (placeholder)"}</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.filename} — {localize(a.alt as L10n, "en").slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="upload-title">
        <h2 id="upload-title" className={styles.cardTitle}>
          Upload a photo
        </h2>
        <ActionForm action={uploadMedia} submitLabel="Upload" resetOnSuccess>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="media-file">
              Photo
            </label>
            <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
          </div>
          <L10nField name="alt" label="Describe the photo (read aloud to people who can't see it)" idPrefix="upload" />
        </ActionForm>
      </section>

      <section className={styles.card} aria-labelledby="library-title">
        <h2 id="library-title" className={styles.cardTitle}>
          Library ({assets.length})
        </h2>
        {assets.length === 0 && <p className={styles.muted}>No photos yet.</p>}
        <div className={styles.mediaGrid}>
          {assets.map((a) => (
            <article key={a.id} className={styles.mediaCard} aria-label={a.filename}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
              <img src={mediaUrl(a.storageKey)!} alt={localize(a.alt as L10n, "en")} className={styles.mediaThumb} />
              <strong style={{ overflowWrap: "anywhere" }}>{a.filename}</strong>
              <span className={styles.hint}>
                {size(a.sizeBytes)} · {day.format(a.createdAt)}
              </span>
              <span className={styles.hint}>
                {a.slots.length ? `Used: ${a.slots.map((s) => SLOTS.find((x) => x.slot === s.slot)?.label ?? s.slot).join(", ")}` : "Not used on the site"}
              </span>
              <details>
                <summary className={styles.label} style={{ cursor: "pointer" }}>
                  Description
                </summary>
                <ActionForm action={updateMediaAlt} submitLabel="Save" variant="secondary">
                  <input type="hidden" name="id" value={a.id} />
                  <L10nField name="alt" label="Description" value={a.alt as L10n} idPrefix={`alt-${a.id}`} />
                </ActionForm>
              </details>
              <ActionForm action={deleteMedia} submitLabel="Delete" variant="danger" confirm={`Delete “${a.filename}”?`}>
                <input type="hidden" name="id" value={a.id} />
              </ActionForm>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
