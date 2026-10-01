import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { getParentCategories } from "@/lib/directory";
import styles from "@/components/admin/admin.module.css";
import { ListingForm } from "../ListingForm";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListing() {
  await requireSection("directory");
  const parents = await getParentCategories();
  return (
    <>
      <Link href="/admin/directory?status=APPROVED">← Directory</Link>
      <h1 className={styles.pageTitle} style={{ marginTop: 10 }}>
        New listing
      </h1>
      <p className={styles.pageLead}>Listings added here skip the review queue unless you set the status to Pending.</p>
      <ListingForm parents={parents} />
    </>
  );
}
