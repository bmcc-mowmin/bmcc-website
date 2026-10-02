import type { L10n } from "@/lib/i18n/dictionary";
import { wallClock } from "@/lib/events/recurrence";
import { ActionForm } from "@/components/admin/ActionForm";
import { L10nField } from "@/components/admin/L10nField";
import styles from "@/components/admin/admin.module.css";
import { deleteEvent, saveEvent } from "./actions";

type EventRow = {
  id: string;
  slug: string;
  title: unknown;
  description: unknown;
  tag: unknown;
  location: unknown;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  rrule: string | null;
  rruleUntil: Date | null;
  imageKey: string | null;
  published: boolean;
  rsvpEnabled: boolean;
  rsvpCapacity: number | null;
};

export function EventForm({ event, timeZone, defaultDate }: { event?: EventRow; timeZone: string; defaultDate: string }) {
  const start = event ? wallClock(event.startAt, timeZone) : { date: defaultDate, time: "18:00" };
  const end = event ? wallClock(event.endAt, timeZone) : { date: defaultDate, time: "20:00" };
  const until = event?.rruleUntil ? wallClock(event.rruleUntil, timeZone).date : "";
  return (
    <>
      <ActionForm action={saveEvent} submitLabel={event ? "Save event" : "Create event"}>
        <input type="hidden" name="id" value={event?.id ?? ""} />
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Details</h2>
          <p className={styles.cardLead}>English is required; other languages fall back to English when left blank.</p>
          <div className={styles.grid2}>
            <L10nField name="title" label="Title" value={event?.title as L10n} />
            <L10nField name="tag" label="Tag (e.g. Weekly, Youth, Community)" value={event?.tag as L10n} />
            <L10nField name="location" label="Location (e.g. Main Prayer Hall)" value={event?.location as L10n} />
          </div>
          <L10nField name="description" label="Description" value={event?.description as L10n} multiline />
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>When</h2>
          <p className={styles.cardLead}>Times are masjid time ({timeZone}). For a weekly event, enter the first date.</p>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-date">
                Date
              </label>
              <input id="ev-date" name="date" type="date" required defaultValue={start.date} className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-start">
                Starts
              </label>
              <input id="ev-start" name="startTime" type="time" defaultValue={start.time} className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-end">
                Ends
              </label>
              <input id="ev-end" name="endTime" type="time" defaultValue={end.time} className={styles.input} />
            </div>
            <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <input type="checkbox" name="allDay" defaultChecked={event?.allDay} /> All day
            </label>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-repeat">
                Repeats
              </label>
              <select id="ev-repeat" name="repeat" defaultValue={event?.rrule ? "weekly" : "none"} className={styles.select}>
                <option value="none">Does not repeat</option>
                <option value="weekly">Every week on the same day</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-until">
                Repeat until (optional)
              </label>
              <input id="ev-until" name="until" type="date" defaultValue={until} className={styles.input} />
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Photo &amp; publishing</h2>
          <div className={styles.row} style={{ alignItems: "flex-start", gap: 24 }}>
            {event?.imageKey && (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview
              <img src={`/media/${event.imageKey}`} alt="Current photo" style={{ width: 200, height: 120, objectFit: "cover", borderRadius: 8 }} />
            )}
            <div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ev-image">
                  {event?.imageKey ? "Replace photo" : "Photo"} (JPEG, PNG or WebP, up to 5 MB)
                </label>
                <input id="ev-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              </div>
              {event?.imageKey && (
                <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" name="removeImage" /> Remove the current photo
                </label>
              )}
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-slug">
                Web address
              </label>
              <span className={styles.hint}>/events/</span>
              <input id="ev-slug" name="slug" defaultValue={event?.slug ?? ""} placeholder="made from the title if blank" className={styles.input} style={{ width: 300 }} />
            </div>
            <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <input type="checkbox" name="published" defaultChecked={event?.published ?? true} /> Published (visible on the site)
            </label>
            <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <input type="checkbox" name="rsvpEnabled" defaultChecked={event?.rsvpEnabled ?? false} /> Members can RSVP
            </label>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ev-capacity">
                RSVP limit (people per date)
              </label>
              <input id="ev-capacity" name="rsvpCapacity" type="number" min={1} max={10000} defaultValue={event?.rsvpCapacity ?? ""} placeholder="No limit" className={styles.input} style={{ width: 140 }} />
            </div>
          </div>
        </section>
      </ActionForm>

      {event && (
        <section className={styles.card} style={{ marginTop: 20 }}>
          <h2 className={styles.cardTitle}>Delete</h2>
          <p className={styles.cardLead}>Removes the event and its photo. To hide it temporarily, untick “Published” instead.</p>
          <ActionForm action={deleteEvent} submitLabel="Delete event" variant="danger" confirm="Delete this event permanently?">
            <input type="hidden" name="id" value={event.id} />
          </ActionForm>
        </section>
      )}
    </>
  );
}
