import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { AREAS } from "@/lib/bugs/rules";
import styles from "@/components/admin/admin.module.css";
import { saveAreaOwners } from "../actions";

export const metadata: Metadata = { title: "Bug area owners" };

export default async function BugAreaOwners() {
  await requireSection("bugs_triage");
  const [owners, staff] = await Promise.all([
    db.bugAreaOwner.findMany(),
    db.user.findMany({ where: { disabled: false, NOT: { adminRoles: { isEmpty: true } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const ownerOf = (area: string) => owners.find((o) => o.area === area)?.ownerId ?? "";
  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link href="/admin/bugs">← Bugs</Link>
      </p>
      <h1 className={styles.pageTitle}>Area owners</h1>
      <p className={styles.pageLead}>
        Who usually fixes problems in each part of the site. When a new report comes in, its area is guessed from the page
        it was sent from, and that area’s owner is suggested at triage. You can always pick someone else.
      </p>
      <section className={styles.card}>
        <ActionForm action={saveAreaOwners} submitLabel="Save owners">
          {AREAS.map((a) => (
            <label key={a.id} className={styles.field}>
              <span className={styles.label}>{a.label}</span>
              <select name={`owner.${a.id}`} defaultValue={ownerOf(a.id)} className={styles.select}>
                <option value="">No default owner</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.email}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </ActionForm>
      </section>
    </>
  );
}
