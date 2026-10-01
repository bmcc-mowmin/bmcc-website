import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { ADMIN_ROLES, ROLE_INFO } from "@/lib/auth/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { inviteStaff, removeStaffAccess, resendInvite, setStaffDisabled, updateStaffRoles } from "./actions";

export const metadata: Metadata = { title: "Admin users" };

function RoleCheckboxes({ selected = [], idPrefix, compact = false }: { selected?: string[]; idPrefix: string; compact?: boolean }) {
  return (
    <fieldset
      className={styles.checkboxList}
      style={{ border: "none", padding: 0, ...(compact ? { flexDirection: "row", flexWrap: "wrap", gap: "8px 18px" } : {}) }}
    >
      <legend className={styles.label} style={{ marginBottom: 6 }}>
        Roles
      </legend>
      {ADMIN_ROLES.map((r) => (
        <label key={r} htmlFor={`${idPrefix}-${r}`}>
          <input id={`${idPrefix}-${r}`} type="checkbox" name="roles" value={r} defaultChecked={selected.includes(r)} />
          <span>
            {ROLE_INFO[r].label}
            {!compact && <small>{ROLE_INFO[r].description}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export default async function AdminUsersPage() {
  const me = await requireSection("users");
  const staff = await db.user.findMany({
    where: { NOT: { adminRoles: { isEmpty: true } } },
    orderBy: [{ disabled: "asc" }, { createdAt: "asc" }],
    select: { id: true, email: true, name: true, adminRoles: true, disabled: true, lastLoginAt: true, passwordHash: true, createdAt: true },
  });
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });

  return (
    <>
      <h1 className={styles.pageTitle}>Admin users</h1>
      <p className={styles.pageLead}>
        Invite people and choose what each can manage. Someone who leaves can be <strong>disabled</strong> (signed out,
        history kept) or have their admin access removed. Every change here is recorded in the activity log.
      </p>

      <section className={styles.card} style={{ borderColor: "var(--primary)" }}>
        <h2 className={styles.cardTitle}>Invite an admin</h2>
        <p className={styles.cardLead}>They get an email with a one-time link (valid 72 hours) to set their password.</p>
        <ActionForm action={inviteStaff} submitLabel="Send invite" resetOnSuccess>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="invite-name">
                Name
              </label>
              <input id="invite-name" name="name" className={styles.input} style={{ width: 220 }} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="invite-email">
                Email
              </label>
              <input id="invite-email" name="email" type="email" required className={styles.input} style={{ width: 280 }} />
            </div>
          </div>
          <RoleCheckboxes idPrefix="invite" />
        </ActionForm>
      </section>

      <h2 className={styles.cardTitle} style={{ margin: "8px 0 12px" }}>
        Current admins ({staff.length})
      </h2>
      {staff.map((u) => {
        const isMe = u.id === me.id;
        const pending = !u.passwordHash;
        return (
          <section key={u.id} className={styles.card} aria-label={u.email}>
            <div className={styles.monthNav} style={{ marginBottom: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 16 }}>{u.name ?? u.email}</strong>
              <span className={styles.muted}>{u.email}</span>
              {isMe && <span className={styles.badge}>You</span>}
              {u.disabled && <span className={`${styles.badge} ${styles.badgeWarn}`}>Disabled</span>}
              {pending && !u.disabled && <span className={`${styles.badge} ${styles.badgeWarn}`}>Invite pending</span>}
              <span className={styles.muted} style={{ marginInlineStart: "auto", fontSize: 13 }}>
                {u.lastLoginAt ? `Last sign-in ${date.format(u.lastLoginAt)}` : "Never signed in"}
              </span>
            </div>
            <ActionForm action={updateStaffRoles} submitLabel="Save roles">
              <input type="hidden" name="id" value={u.id} />
              <RoleCheckboxes selected={u.adminRoles} idPrefix={u.id} compact />
            </ActionForm>
            <div className={styles.row} style={{ marginTop: 10, gap: 16 }}>
              {pending && !u.disabled && (
                <ActionForm action={resendInvite} submitLabel="Resend invite" variant="secondary">
                  <input type="hidden" name="id" value={u.id} />
                </ActionForm>
              )}
              {!isMe && (
                <ActionForm
                  action={setStaffDisabled}
                  submitLabel={u.disabled ? "Enable" : "Disable"}
                  variant={u.disabled ? "secondary" : "danger"}
                  confirm={u.disabled ? undefined : `Disable ${u.email}? They will be signed out immediately.`}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="disable" value={u.disabled ? "0" : "1"} />
                </ActionForm>
              )}
              {!isMe && (
                <ActionForm action={removeStaffAccess} submitLabel="Remove admin access" variant="danger" confirm={`Remove all admin roles from ${u.email}?`}>
                  <input type="hidden" name="id" value={u.id} />
                </ActionForm>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
