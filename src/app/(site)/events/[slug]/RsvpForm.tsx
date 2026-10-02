"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { rsvpAction, type RsvpState } from "./actions";
import styles from "../events.module.css";

type DateOption = { iso: string; label: string; left: number | null; mine: number | null };

export function RsvpForm({ slug, dates, maxParty }: { slug: string; dates: DateOption[]; maxParty: number }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<RsvpState, FormData>(rsvpAction, { status: "idle" });
  // A full date can still be chosen by someone already going (to change their number).
  const choosable = dates.filter((d) => d.left === null || d.left > 0 || d.mine);
  if (choosable.length === 0) return <p className={styles.rsvpNote}>{t.rsvp_full}</p>;
  const first = choosable.find((d) => !d.mine) ?? choosable[0];
  return (
    <form action={action} className={styles.rsvpForm}>
      <input type="hidden" name="slug" value={slug} />
      {choosable.length > 1 ? (
        <>
          <label htmlFor="rsvp-date" className={styles.rsvpLabel}>
            {t.rsvp_date}
          </label>
          <select id="rsvp-date" name="date" defaultValue={first.iso} className={styles.rsvpSelect}>
            {choosable.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.label}
                {d.left !== null ? ` — ${t.rsvp_spots_left.replace("{n}", String(d.left))}` : ""}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <input type="hidden" name="date" value={first.iso} />
          {first.left !== null && <p className={styles.rsvpNote}>{t.rsvp_spots_left.replace("{n}", String(first.left))}</p>}
        </>
      )}
      <label htmlFor="rsvp-party" className={styles.rsvpLabel}>
        {t.rsvp_party}
      </label>
      <select id="rsvp-party" name="party" defaultValue="1" className={styles.rsvpSelect}>
        {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? t.f_sending : t.rsvp_button}
      </button>
      {state.status === "saved" && (
        <p role="status" className={styles.rsvpOk}>
          {t.rsvp_saved}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className={styles.rsvpErr}>
          {t[state.error]}
        </p>
      )}
    </form>
  );
}
