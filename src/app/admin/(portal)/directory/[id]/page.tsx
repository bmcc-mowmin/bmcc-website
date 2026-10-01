import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { getParentCategories } from "@/lib/directory";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { ListingForm } from "../ListingForm";
import { deleteListing } from "../actions";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListing({ params, searchParams }: PageProps<"/admin/directory/[id]">) {
  await requireSection("directory");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [listing, parents] = await Promise.all([db.directoryListing.findUnique({ where: { id } }), getParentCategories()]);
  if (!listing) notFound();
  return (
    <>
      <Link href={`/admin/directory?status=${listing.status}`}>← Directory</Link>
      <div className={styles.monthNav} style={{ marginTop: 10 }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          {listing.name}
        </h1>
        {listing.status === "APPROVED" && (
          <Link href={`/community?listing=${listing.id}`} target="_blank" style={{ marginInlineStart: "auto", fontSize: 14 }}>
            View on site ↗
          </Link>
        )}
      </div>
      {listing.submitterEmail && <p className={styles.pageLead}>Submitted by {listing.submitterEmail}.</p>}
      {saved && (
        <p role="status" className={styles.ok}>
          Saved.
        </p>
      )}
      <ListingForm key={listing.updatedAt.toISOString()} listing={listing} parents={parents} />
      <section className={styles.card} style={{ marginTop: 20 }}>
        <h2 className={styles.cardTitle}>Delete</h2>
        <p className={styles.cardLead}>Permanently removes the listing. To hide it but keep it, set the status to Rejected instead.</p>
        <ActionForm action={deleteListing} submitLabel="Delete listing" variant="danger" confirm="Delete this listing permanently?">
          <input type="hidden" name="id" value={listing.id} />
        </ActionForm>
      </section>
    </>
  );
}
