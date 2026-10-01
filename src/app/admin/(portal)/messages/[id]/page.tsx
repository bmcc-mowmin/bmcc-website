import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { masjidClock } from "@/lib/prayer/schedule";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { deleteMessage, setMessageHandled } from "../actions";
import { topicLabel } from "../topic";

export const metadata: Metadata = { title: "Message" };

export default async function MessageDetail({ params }: PageProps<"/admin/messages/[id]">) {
  await requireSection("messages");
  const { id } = await params;
  const [m, { timeZone }] = await Promise.all([db.contactMessage.findUnique({ where: { id } }), masjidClock()]);
  if (!m) notFound();
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone });
  const about = topicLabel(m.topic);
  const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: your message to BMCC (${about})`)}`;

  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link href={`/admin/messages?status=${m.status}`}>← Messages</Link>
      </p>
      <h1 className={styles.pageTitle}>Message from {m.name}</h1>
      <section className={styles.card} aria-label="Message">
        <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 14px", fontSize: 14, margin: "0 0 16px" }}>
          <dt className={styles.muted}>From</dt>
          <dd style={{ margin: 0 }}>
            {m.name} · <a href={`mailto:${m.email}`}>{m.email}</a>
          </dd>
          <dt className={styles.muted}>About</dt>
          <dd style={{ margin: 0 }}>{about}</dd>
          <dt className={styles.muted}>Received</dt>
          <dd style={{ margin: 0 }}>{when.format(m.createdAt)}</dd>
          <dt className={styles.muted}>Status</dt>
          <dd style={{ margin: 0 }}>
            {m.status === "HANDLED" ? (
              <span className={styles.badge}>Handled{m.handledAt ? ` · ${when.format(m.handledAt)}` : ""}</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgeWarn}`}>New</span>
            )}
          </dd>
        </dl>
        <div dir="auto" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.6, padding: "14px 16px", background: "var(--page)", borderRadius: 10 }}>
          {m.message}
        </div>
        <div className={styles.row} style={{ gap: 12, marginTop: 16, alignItems: "flex-start" }}>
          <a href={reply} className={`${styles.btn} ${styles.primary}`} style={{ marginTop: 6 }}>
            Reply by email
          </a>
          <ActionForm action={setMessageHandled} submitLabel={m.status === "HANDLED" ? "Move back to New" : "Mark handled"} variant="secondary">
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="handled" value={m.status === "HANDLED" ? "0" : "1"} />
          </ActionForm>
          <ActionForm action={deleteMessage} submitLabel="Delete" variant="danger" confirm="Delete this message permanently?">
            <input type="hidden" name="id" value={m.id} />
          </ActionForm>
        </div>
      </section>
    </>
  );
}
