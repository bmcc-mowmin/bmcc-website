import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { masjidClock } from "@/lib/prayer/schedule";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  AREAS,
  areaLabel,
  ASSIGNEE_STATUSES,
  bugRef,
  CATEGORY_LABEL,
  CLOSED_STATUSES,
  IMPACT_LABEL,
  isOverdue,
  PRIORITIES,
  priorityLabel,
  STATUSES,
  statusLabel,
  suggestPriority,
  type Category,
  type Impact,
} from "@/lib/bugs/rules";
import styles from "@/components/admin/admin.module.css";
import { addBugComment, deleteBug, markDuplicate, setBugStatus, triageBug } from "../actions";

export async function generateMetadata({ params }: PageProps<"/admin/bugs/[number]">): Promise<Metadata> {
  return { title: bugRef(Number((await params).number) || 0) };
}

const block = { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.6, padding: "12px 14px", background: "var(--page)", borderRadius: 10, margin: "4px 0 14px" } as const;
const EVENT_LABEL: Record<string, string> = { created: "Reported", note: "Note", reply: "To reporter", status: "Status", priority: "Priority", area: "Area", assignee: "Owner", duplicate: "Duplicate" };

export default async function BugDetail({ params }: PageProps<"/admin/bugs/[number]">) {
  const user = await requireSection("bugs");
  const number = Number((await params).number);
  if (!Number.isInteger(number) || number < 1) notFound();
  const [bug, staff, owners, { timeZone }] = await Promise.all([
    db.bugReport.findUnique({
      where: { number },
      include: {
        attachments: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, email: true } } } },
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true } },
        duplicateOf: { select: { number: true, title: true } },
        duplicates: { select: { number: true, title: true } },
      },
    }),
    db.user.findMany({ where: { disabled: false, NOT: { adminRoles: { isEmpty: true } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    db.bugAreaOwner.findMany({ include: { owner: { select: { id: true, name: true, email: true } } } }),
    masjidClock(),
  ]);
  if (!bug) notFound();

  const triager = can(user.adminRoles, "bugs_triage");
  const isOwner = bug.assigneeId === user.id;
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });
  const dueDay = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone });
  const closed = (CLOSED_STATUSES as readonly string[]).includes(bug.status);
  const late = isOverdue(bug);
  const areaOwner = owners.find((o) => o.area === bug.area)?.owner ?? null;
  const suggested = suggestPriority(bug.impact as Impact, bug.category as Category);
  const statusChoices = STATUSES.filter((s) => s.id !== "DUPLICATE" && (triager || s.id === bug.status || ASSIGNEE_STATUSES.includes(s.id)));
  const ref = bugRef(bug.number);

  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link href="/admin/bugs">← Bugs</Link>
      </p>
      <h1 className={styles.pageTitle}>
        <span className={styles.muted}>{ref}</span> <bdi>{bug.title}</bdi>
      </h1>
      <p className={styles.row} style={{ gap: 8, flexWrap: "wrap", margin: "0 0 18px" }}>
        <span className={`${styles.badge} ${bug.status === "NEW" ? styles.badgeWarn : ""}`}>{statusLabel(bug.status)}</span>
        <span className={`${styles.badge} ${bug.priority === "P1" || bug.priority === "P2" ? styles.badgeWarn : ""}`}>{priorityLabel(bug.priority)}</span>
        <span className={styles.badge}>{areaLabel(bug.area)}</span>
        <span className={styles.badge}>Owner: {bug.assignee ? (bug.assignee.name ?? bug.assignee.email) : "unassigned"}</span>
        {bug.dueAt && <span className={late ? styles.err : styles.muted}>{late ? "Overdue — was due" : "Due"} {dueDay.format(bug.dueAt)}</span>}
      </p>
      {bug.duplicateOf && (
        <p className={styles.notice}>
          Duplicate of <Link href={`/admin/bugs/${bug.duplicateOf.number}`}>{bugRef(bug.duplicateOf.number)}: {bug.duplicateOf.title}</Link>
        </p>
      )}

      <div className={styles.grid} style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)", alignItems: "start" }}>
        <div>
          <section className={styles.card} aria-labelledby="report-title">
            <h2 id="report-title" className={styles.cardTitle}>
              Report
            </h2>
            <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "6px 14px", fontSize: 14, margin: "0 0 14px" }}>
              <dt className={styles.muted}>Type</dt>
              <dd style={{ margin: 0 }}>{CATEGORY_LABEL[bug.category as Category] ?? bug.category}</dd>
              <dt className={styles.muted}>Impact</dt>
              <dd style={{ margin: 0 }}>{IMPACT_LABEL[bug.impact as Impact] ?? bug.impact}</dd>
              <dt className={styles.muted}>Page</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{bug.pageUrl ? bug.pageUrl.startsWith("/") ? <a href={bug.pageUrl} target="_blank" rel="noopener">{bug.pageUrl}</a> : <bdi>{bug.pageUrl}</bdi> : "—"}</dd>
              <dt className={styles.muted}>Reported by</dt>
              <dd style={{ margin: 0 }}>
                {bug.reporterName ?? "Anonymous"}
                {bug.reporterEmail && (
                  <>
                    {" · "}
                    <a href={`mailto:${bug.reporterEmail}?subject=${encodeURIComponent(`Your report ${ref}`)}`}>{bug.reporterEmail}</a>
                  </>
                )}
                {bug.reporter && <span className={styles.muted}> · signed in</span>}
              </dd>
              <dt className={styles.muted}>Received</dt>
              <dd style={{ margin: 0 }}>{when.format(bug.createdAt)}</dd>
              <dt className={styles.muted}>Device</dt>
              <dd style={{ margin: 0, fontSize: 13 }} className={styles.muted}>
                {[bug.viewport && `Screen ${bug.viewport}`, bug.language && `Site language: ${bug.language}`].filter(Boolean).join(" · ") || "—"}
                {bug.userAgent && <div style={{ overflowWrap: "anywhere" }}>{bug.userAgent}</div>}
              </dd>
            </dl>
            <h3 className={styles.label}>What happened</h3>
            <div dir="auto" style={block}>
              {bug.description}
            </div>
            {bug.steps && (
              <>
                <h3 className={styles.label}>Steps to see it</h3>
                <div dir="auto" style={block}>
                  {bug.steps}
                </div>
              </>
            )}
            {bug.expected && (
              <>
                <h3 className={styles.label}>Expected</h3>
                <div dir="auto" style={block}>
                  {bug.expected}
                </div>
              </>
            )}
            {bug.attachments.length > 0 && (
              <>
                <h3 className={styles.label}>Attachments</h3>
                <div className={styles.mediaGrid}>
                  {bug.attachments.map((a) => (
                    <a key={a.id} href={`/admin/bugs/files/${a.id}`} target="_blank" rel="noopener" className={styles.mediaCard}>
                      {a.contentType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private file served to staff only
                        <img src={`/admin/bugs/files/${a.id}`} alt={`Attachment ${a.filename}`} className={styles.mediaThumb} />
                      ) : (
                        <span className={styles.mediaThumb} style={{ display: "grid", placeItems: "center", fontWeight: 700 }}>
                          PDF
                        </span>
                      )}
                      <span style={{ overflowWrap: "anywhere", fontSize: 13 }}>
                        <bdi>{a.filename}</bdi> · {Math.ceil(a.sizeBytes / 1024)} KB
                      </span>
                    </a>
                  ))}
                </div>
              </>
            )}
            {bug.duplicates.length > 0 && (
              <p className={styles.muted} style={{ marginTop: 14 }}>
                Duplicates of this bug:{" "}
                {bug.duplicates.map((d, i) => (
                  <span key={d.number}>
                    {i > 0 && ", "}
                    <Link href={`/admin/bugs/${d.number}`}>{bugRef(d.number)}</Link>
                  </span>
                ))}
              </p>
            )}
          </section>

          <section className={styles.card} aria-labelledby="timeline-title">
            <h2 id="timeline-title" className={styles.cardTitle}>
              Timeline
            </h2>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {bug.events.map((e) => (
                <li key={e.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                  <div className={styles.row} style={{ gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                    <span className={`${styles.badge} ${e.kind === "reply" ? styles.badgeWarn : ""}`}>{EVENT_LABEL[e.kind] ?? e.kind}</span>
                    <strong>{e.actor ? (e.actor.name ?? e.actor.email) : e.kind === "created" ? (bug.reporterName ?? "Reporter") : "System"}</strong>
                    <span className={styles.muted}>{when.format(e.createdAt)}</span>
                  </div>
                  {e.body && (
                    <p dir="auto" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {e.body}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <h3 className={styles.label} style={{ marginTop: 16 }}>
              Add a comment
            </h3>
            <ActionForm action={addBugComment} submitLabel="Add comment" resetOnSuccess>
              <input type="hidden" name="id" value={bug.id} />
              <label className="visually-hidden" htmlFor="bug-comment">
                Comment
              </label>
              <textarea id="bug-comment" name="body" rows={3} maxLength={5000} className={styles.input} placeholder="Notes are only seen by admins." />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, marginTop: 8 }}>
                <input type="checkbox" name="toReporter" value="1" disabled={!bug.reporterEmail} />
                {bug.reporterEmail ? "Email this to the reporter (they will see it)" : "The reporter left no email address"}
              </label>
            </ActionForm>
          </section>
        </div>

        <div>
          {triager && (
            <section className={styles.card} aria-labelledby="triage-title">
              <h2 id="triage-title" className={styles.cardTitle}>
                Triage
              </h2>
              <ActionForm action={triageBug} submitLabel="Save triage">
                <input type="hidden" name="id" value={bug.id} />
                <label className={styles.field}>
                  <span className={styles.label}>Area</span>
                  <select name="area" defaultValue={bug.area ?? ""} className={styles.select}>
                    <option value="">Not set</option>
                    {AREAS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Priority</span>
                  <select name="priority" defaultValue={bug.priority ?? ""} className={styles.select}>
                    <option value="">Not set</option>
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <span className={styles.hint}>
                    From the reporter’s answers: {priorityLabel(suggested)}. {PRIORITIES.map((p) => `${p.id}: ${p.hint}${p.dueDays ? ` (fix within ${p.dueDays} day${p.dueDays > 1 ? "s" : ""})` : ""}`).join(". ")}.
                  </span>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Owner</span>
                  <select name="assigneeId" defaultValue={bug.assigneeId ?? areaOwner?.id ?? ""} className={styles.select}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? s.email}
                        {s.id === areaOwner?.id ? " (area owner)" : ""}
                      </option>
                    ))}
                  </select>
                  {!bug.assigneeId && areaOwner && <span className={styles.hint}>Suggested: {areaOwner.name ?? areaOwner.email}, owner of {areaLabel(bug.area)}.</span>}
                </label>
                {bug.status === "NEW" && <p className={styles.hint}>Setting a priority and an owner moves the bug to Triaged and emails the owner.</p>}
              </ActionForm>
            </section>
          )}

          <section className={styles.card} aria-labelledby="status-title">
            <h2 id="status-title" className={styles.cardTitle}>
              Status
            </h2>
            {triager || isOwner ? (
              <ActionForm action={setBugStatus} submitLabel="Update status">
                <input type="hidden" name="id" value={bug.id} />
                <label className={styles.field}>
                  <span className={styles.label}>Status</span>
                  <select name="status" defaultValue={bug.status} className={styles.select}>
                    {statusChoices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Note (optional)</span>
                  <input name="note" maxLength={500} className={styles.input} placeholder="e.g. what was changed" />
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input type="checkbox" name="notify" value="1" defaultChecked={!!bug.reporterEmail} disabled={!bug.reporterEmail} />
                  Email the reporter when it’s fixed, closed or needs their input
                </label>
              </ActionForm>
            ) : (
              <p className={styles.muted}>Only the bug’s owner or a super admin can change its status. You can still add comments.</p>
            )}
          </section>

          {triager && !closed && (
            <section className={styles.card} aria-labelledby="dup-title">
              <h2 id="dup-title" className={styles.cardTitle}>
                Duplicate
              </h2>
              <ActionForm action={markDuplicate} submitLabel="Mark as duplicate" variant="secondary">
                <input type="hidden" name="id" value={bug.id} />
                <label className={styles.field}>
                  <span className={styles.label}>Same problem as</span>
                  <input name="of" placeholder="BUG-0003" className={styles.input} required />
                </label>
              </ActionForm>
            </section>
          )}

          {triager && (
            <section className={styles.card} aria-labelledby="delete-title">
              <h2 id="delete-title" className={styles.cardTitle}>
                Delete
              </h2>
              <p className={styles.hint}>For spam or reports sent by mistake. Deletes the report and its files for good.</p>
              <ActionForm action={deleteBug} submitLabel="Delete report" variant="danger" confirm={`Delete ${ref} and its files permanently?`}>
                <input type="hidden" name="id" value={bug.id} />
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
