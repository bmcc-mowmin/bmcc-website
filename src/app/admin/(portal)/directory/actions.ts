"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, text } from "@/lib/admin/forms";
import { fieldErrors, listingSchema } from "@/lib/directory/listing";
import { csvToObjects } from "@/lib/directory/csv";
import { rowToListing } from "@/lib/directory/import";
import { escapeHtml, layoutHtml, sendMail } from "@/lib/mail";
import type { ActionResult } from "@/components/admin/ActionForm";

function refresh() {
  revalidatePath("/community");
  revalidatePath("/admin", "layout");
}

async function notifySubmitter(listing: { name: string; submitterEmail: string | null }, approved: boolean, reason?: string | null) {
  if (!listing.submitterEmail) return;
  const name = escapeHtml(listing.name);
  try {
    if (approved) {
      await sendMail({
        to: listing.submitterEmail,
        subject: `Your listing "${listing.name}" is now live`,
        text: `Good news — "${listing.name}" has been approved and now appears in the BMCC Community Directory:\n${env.APP_URL}/community\n\nBrentwood Muslim Community Center`,
        html: layoutHtml("Your listing is live", `<p>Good news — <strong>${name}</strong> has been approved and now appears in the <a href="${env.APP_URL}/community">BMCC Community Directory</a>.</p>`),
      });
    } else {
      const why = reason ? `\n\nReason: ${reason}` : "";
      await sendMail({
        to: listing.submitterEmail,
        subject: `About your listing "${listing.name}"`,
        text: `Thank you for submitting "${listing.name}" to the BMCC Community Directory. After review, we're unable to publish it at this time.${why}\n\nIf you have questions, reply to this email.\n\nBrentwood Muslim Community Center`,
        html: layoutHtml(
          "About your directory listing",
          `<p>Thank you for submitting <strong>${name}</strong> to the BMCC Community Directory. After review, we're unable to publish it at this time.</p>${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}<p>If you have questions, reply to this email.</p>`,
        ),
      });
    }
  } catch (e) {
    console.error("directory notification failed", e);
  }
}

export async function approveListing(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("directory");
  const id = text(form, "id");
  const listing = await db.directoryListing.update({
    where: { id },
    data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date(), rejectionReason: null },
  });
  await audit(admin.id, "approve", "DirectoryListing", id, { name: listing.name });
  await notifySubmitter(listing, true);
  refresh();
  return done(`Approved — “${listing.name}” is now in the public directory.`);
}

export async function rejectListing(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("directory");
  const id = text(form, "id");
  const reason = text(form, "reason").slice(0, 500) || null;
  const listing = await db.directoryListing.update({
    where: { id },
    data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date(), rejectionReason: reason },
  });
  await audit(admin.id, "reject", "DirectoryListing", id, { name: listing.name, reason });
  if (form.get("notify") === "on") await notifySubmitter(listing, false, reason);
  refresh();
  return done(`Rejected “${listing.name}”.`);
}

// Create or edit from admin. Admin-created listings can be published straight away.
export async function saveListing(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("directory");
  const id = text(form, "id") || undefined;
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = listingSchema.safeParse(values);
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    const [field, key] = Object.entries(errs)[0];
    const reasons: Record<string, string> = {
      form_error_url: "is not a valid web address",
      form_error_phone: "is not a valid phone number",
      form_error_email: "is not a valid email",
      form_error_required: "is required (descriptions need at least 10 characters)",
    };
    return fail(`Check “${field}”: it ${reasons[key] ?? "is invalid"}.`);
  }
  const status = (["PENDING", "APPROVED", "REJECTED"] as const).find((s) => s === values.status) ?? "APPROVED";
  const review = status === "PENDING" ? { reviewedById: null, reviewedAt: null } : { reviewedById: admin.id, reviewedAt: new Date() };
  const googleMapUrl = /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(values.googleMapUrl ?? "") ? values.googleMapUrl : null;
  const data = { ...parsed.data, status, googleMapUrl, ...review };

  const listing = id ? await db.directoryListing.update({ where: { id }, data }) : await db.directoryListing.create({ data });
  await audit(admin.id, id ? "update" : "create", "DirectoryListing", listing.id, { name: listing.name, status });
  refresh();
  redirect(`/admin/directory/${listing.id}?saved=1`);
}

export async function deleteListing(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("directory");
  const id = text(form, "id");
  const listing = await db.directoryListing.delete({ where: { id } });
  await audit(admin.id, "delete", "DirectoryListing", id, { name: listing.name });
  refresh();
  redirect("/admin/directory?status=APPROVED&deleted=1");
}

// CSV import, e.g. restoring the vetted Google Sheet at go-live. Header names are matched loosely
// (name, listing type, main category / parent category, category, tags, description, author /
// contact name, phone, email, website, address, city, state, zip, google map url).
const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function importListings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("directory");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file.");
  if (file.size > MAX_CSV_BYTES) return fail("The CSV must be 2 MB or smaller.");
  const status = form.get("asPending") === "on" ? "PENDING" : "APPROVED";
  const rows = csvToObjects(await file.text());
  if (!rows.length) return fail("No rows found. The first line must be the column headers.");

  const problems: string[] = [];
  let created = 0;
  let skipped = 0;
  for (const [i, row] of rows.entries()) {
    const { candidate, googleMapUrl } = rowToListing(row);
    const parsed = listingSchema.safeParse(candidate);
    if (!parsed.success) {
      problems.push(`Row ${i + 2} (${candidate.name || "no name"}): ${Object.keys(fieldErrors(parsed.error)).join(", ")}`);
      continue;
    }
    // Skip exact duplicates (same name and phone) so an import can be re-run safely.
    const exists = await db.directoryListing.findFirst({ where: { name: parsed.data.name, phone: parsed.data.phone } });
    if (exists) {
      skipped++;
      continue;
    }
    await db.directoryListing.create({
      data: {
        ...parsed.data,
        googleMapUrl,
        status,
        ...(status === "APPROVED" ? { reviewedById: admin.id, reviewedAt: new Date() } : {}),
      },
    });
    created++;
  }
  await audit(admin.id, "import", "DirectoryListing", "csv", { created, skipped, failed: problems.length, status });
  refresh();
  const summary = `Imported ${created} listing${created === 1 ? "" : "s"} as ${status.toLowerCase()}; skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`;
  return problems.length
    ? { ok: created > 0, message: `${summary} ${problems.length} row(s) need fixing: ${problems.slice(0, 8).join("; ")}${problems.length > 8 ? "; …" : ""}` }
    : done(summary);
}
