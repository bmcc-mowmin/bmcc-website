import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/directory/csv";

// CSV export of every listing (all statuses), in the same columns the import accepts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.adminRoles, "directory")) return new Response("Forbidden", { status: 403 });
  const rows = await db.directoryListing.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  const header = ["name", "listing type", "main category", "category", "tags", "description", "author", "phone", "email", "website", "address", "city", "state", "zip", "google map url", "status", "submitter email", "created"];
  const csv = toCsv(
    header,
    rows.map((r) => [r.name, r.listingType.toLowerCase(), r.parentCategory, r.category, r.tags.join("; "), r.description, r.author, r.phone, r.email, r.website, r.address, r.city, r.state, r.zip, r.googleMapUrl, r.status.toLowerCase(), r.submitterEmail, r.createdAt.toISOString().slice(0, 10)]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bmcc-directory-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
