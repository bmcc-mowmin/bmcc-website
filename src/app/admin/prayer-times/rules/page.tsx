import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCalcSettings, masjidClock } from "@/lib/prayer/schedule";
import { CALC_METHODS, HIGH_LAT_RULES } from "@/lib/prayer/calculate";
import type { L10n } from "@/lib/i18n/dictionary";
import { ActionForm } from "@/components/admin/ActionForm";
import { L10nField } from "@/components/admin/L10nField";
import styles from "@/components/admin/admin.module.css";
import { PrayerTabs } from "../Tabs";
import { addIqamahRule, deleteIqamahRule, deleteJumuahService, saveCalcSettings, saveJumuahService } from "../actions";

export const metadata: Metadata = { title: "Prayer rules" };

const PRAYERS = ["FAJR", "DHUHR", "ASR", "MAGHRIB", "ISHA"] as const;
const title = (p: string) => p.charAt(0) + p.slice(1).toLowerCase();
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function PrayerRulesAdmin() {
  const [rules, services, settings, { date: today }] = await Promise.all([
    db.iqamahRule.findMany({ orderBy: [{ prayer: "asc" }, { effectiveFrom: "desc" }] }),
    db.jumuahService.findMany({ orderBy: { sortOrder: "asc" } }),
    getCalcSettings(),
    masjidClock(),
  ]);

  return (
    <>
      <h1 className={styles.pageTitle}>Prayer times</h1>
      <p className={styles.pageLead}>Rules that apply to every day. For a single day, use the month view.</p>
      <PrayerTabs active="rules" />

      {/* ── Iqamah rules ── */}
      <section className={styles.card} aria-labelledby="rules-title">
        <h2 id="rules-title" className={styles.cardTitle}>
          Iqamah rules
        </h2>
        <p className={styles.cardLead}>
          Iqamah is either <strong>minutes after the Adhan</strong> or a <strong>fixed time</strong>. When several rules cover
          a date, the one with the latest start date wins — so add a dated rule for Ramadan or for the daylight-saving
          season instead of editing the everyday rule. A fixed time earlier than that day&apos;s Adhan uses the Adhan time.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Prayer</th>
                <th>Iqamah</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const from = iso(r.effectiveFrom);
                const to = r.effectiveTo ? iso(r.effectiveTo) : null;
                const current = from <= today && (!to || to >= today);
                const ended = !!to && to < today;
                return (
                  <tr key={r.id}>
                    <td>{title(r.prayer)}</td>
                    <td>{r.mode === "OFFSET" ? `${r.offsetMinutes} min after Adhan` : `Fixed ${r.fixedTime}`}</td>
                    <td>{from}</td>
                    <td>{to ?? <span className={styles.muted}>open-ended</span>}</td>
                    <td>{ended ? <span className={styles.muted}>ended</span> : current ? <span className={styles.badge}>in effect</span> : <span className={styles.badge}>upcoming</span>}</td>
                    <td>
                      <ActionForm action={deleteIqamahRule} submitLabel="Delete" variant="danger" confirm="Delete this rule?">
                        <input type="hidden" name="id" value={r.id} />
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className={styles.label} style={{ marginTop: 18 }}>
          Add a rule
        </h3>
        <ActionForm action={addIqamahRule} submitLabel="Add rule" resetOnSuccess>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rule-prayer">
                Prayer
              </label>
              <select id="rule-prayer" name="prayer" className={styles.select}>
                {PRAYERS.map((p) => (
                  <option key={p} value={p}>
                    {title(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rule-mode">
                Type
              </label>
              <select id="rule-mode" name="mode" className={styles.select}>
                <option value="OFFSET">Minutes after Adhan</option>
                <option value="FIXED">Fixed time</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rule-offset">
                Minutes (if “after Adhan”)
              </label>
              <input id="rule-offset" name="offsetMinutes" type="number" min={0} max={120} defaultValue={15} className={styles.input} style={{ width: 110 }} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rule-fixed">
                Time (if “fixed”)
              </label>
              <input id="rule-fixed" name="fixedTime" type="time" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rule-from">
                From
              </label>
              <input id="rule-from" name="effectiveFrom" type="date" required defaultValue={today} className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rule-to">
                To (optional)
              </label>
              <input id="rule-to" name="effectiveTo" type="date" className={styles.input} />
            </div>
          </div>
        </ActionForm>
      </section>

      {/* ── Jumu'ah ── */}
      <section className={styles.card} aria-labelledby="jumuah-title">
        <h2 id="jumuah-title" className={styles.cardTitle}>
          Jumu&apos;ah services
        </h2>
        <p className={styles.cardLead}>
          Shown every Friday on the site and in the PDF; the first active service replaces Dhuhr in the header&apos;s Next
          Prayer. To change a single Friday, override that date in the month view.
        </p>
        {services.map((s) => (
          <JumuahForm key={s.id} service={s} />
        ))}
        <details>
          <summary className={styles.label} style={{ cursor: "pointer" }}>
            + Add a Jumu&apos;ah service
          </summary>
          <JumuahForm />
        </details>
      </section>

      {/* ── Calculation ── */}
      <section className={styles.card} aria-labelledby="calc-title">
        <h2 id="calc-title" className={styles.cardTitle}>
          Calculation settings
        </h2>
        <p className={styles.cardLead}>
          Asr always uses the <strong>Hanafi</strong> method (shadow twice the object&apos;s length). Times are in{" "}
          <strong>{settings.timezone}</strong>. Confirm the calculation method with the Imam before launch.
        </p>
        <ActionForm action={saveCalcSettings} submitLabel="Save settings">
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="calc-lat">
                Latitude
              </label>
              <input id="calc-lat" name="latitude" type="number" step="0.0001" defaultValue={settings.latitude} required className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="calc-lng">
                Longitude
              </label>
              <input id="calc-lng" name="longitude" type="number" step="0.0001" defaultValue={settings.longitude} required className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="calc-method">
                Fajr/Isha method
              </label>
              <select id="calc-method" name="calcMethod" defaultValue={settings.calcMethod} className={styles.select}>
                {CALC_METHODS.filter((m) => m !== "Other").map((m) => (
                  <option key={m} value={m}>
                    {m === "NorthAmerica" ? "ISNA (North America)" : m.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="calc-hlr">
                High-latitude rule
              </label>
              <select id="calc-hlr" name="highLatRule" defaultValue={settings.highLatRule} className={styles.select}>
                {HIGH_LAT_RULES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="calc-madhab">
                Asr
              </label>
              <input id="calc-madhab" value="Hanafi" readOnly className={styles.input} />
            </div>
          </div>
        </ActionForm>
      </section>
    </>
  );
}

type Service = Awaited<ReturnType<typeof db.jumuahService.findMany>>[number];

function JumuahForm({ service }: { service?: Service }) {
  const key = service?.id ?? "new";
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
      <ActionForm action={saveJumuahService} submitLabel={service ? "Save" : "Add service"} resetOnSuccess={!service}>
        <input type="hidden" name="id" value={service?.id ?? ""} />
        <div className={styles.grid2}>
          <L10nField name="label" label="Name (e.g. First Jumu'ah)" value={service?.label as L10n | undefined} />
          <L10nField name="location" label="Location" value={service?.location as L10n | undefined} />
          <L10nField name="note" label="Note (optional)" value={service?.note as L10n | undefined} required={false} />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${key}-khutbah`}>
              Khutbah
            </label>
            <input id={`${key}-khutbah`} name="khutbahTime" type="time" defaultValue={service?.khutbahTime ?? "13:00"} required className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${key}-iqamah`}>
              Iqamah
            </label>
            <input id={`${key}-iqamah`} name="iqamahTime" type="time" defaultValue={service?.iqamahTime ?? "13:20"} required className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${key}-sort`}>
              Order
            </label>
            <input id={`${key}-sort`} name="sortOrder" type="number" defaultValue={service?.sortOrder ?? 1} className={styles.input} style={{ width: 80 }} />
          </div>
          <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="active" defaultChecked={service?.active ?? true} /> Active
          </label>
        </div>
      </ActionForm>
      {service && (
        <div style={{ marginTop: 8 }}>
          <ActionForm action={deleteJumuahService} submitLabel="Delete service" variant="danger" confirm="Delete this Jumu'ah service?">
            <input type="hidden" name="id" value={service.id} />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
