// Directory listings for the local seed.
//
// The vetted Google Sheet is only the INITIAL feed. After that, the website's database is the source
// of truth: new listings come from the public "Submit a Listing" form and are managed in
// Admin → Directory. Nothing syncs back from the sheet.
//
// If prisma/seed-data/private/directory.csv exists (git-ignored), its rows are loaded as APPROVED
// listings; otherwise fake sample listings are used, so a fresh clone never contains real details.
//   replace: true  → full local reset (npm run db:seed): delete all listings, then load
//   replace: false → add-only (npm run db:seed:directory): load rows not already present
//                    (same name + phone) and never delete anything
import { existsSync, readFileSync } from "node:fs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { csvToObjects } from "../src/lib/directory/csv";
import { rowToListing } from "../src/lib/directory/import";
import { listingSchema } from "../src/lib/directory/listing";

export const PRIVATE_DIRECTORY_CSV = "prisma/seed-data/private/directory.csv";

export async function seedDirectory(db: PrismaClient, reviewerId: string, { replace }: { replace: boolean }) {
  if (replace) await db.directoryListing.deleteMany();
  const approved = { status: "APPROVED" as const, reviewedById: reviewerId, reviewedAt: new Date() };

  let summary: string;
  if (existsSync(PRIVATE_DIRECTORY_CSV)) {
    const rows = csvToObjects(readFileSync(PRIVATE_DIRECTORY_CSV, "utf8"));
    let loaded = 0;
    let kept = 0;
    for (const [i, row] of rows.entries()) {
      const { candidate, googleMapUrl } = rowToListing(row);
      const parsed = listingSchema.safeParse(candidate);
      if (!parsed.success) {
        console.warn(`  directory.csv row ${i + 2} (${candidate.name || "no name"}) skipped: ${parsed.error.issues.map((x) => `${String(x.path[0])} ${x.message}`).join(", ")}`);
        continue;
      }
      if (!replace && (await db.directoryListing.findFirst({ where: { name: parsed.data.name, phone: parsed.data.phone } }))) {
        kept++;
        continue;
      }
      await db.directoryListing.create({ data: { ...parsed.data, googleMapUrl, ...approved } });
      loaded++;
    }
    summary = `${loaded} REAL directory listings added from ${PRIVATE_DIRECTORY_CSV}${kept ? ` (${kept} already present, left as they are)` : ""}`;
  } else if (!replace) {
    return "no private CSV found — nothing added";
  } else {
    // FAKE sample listings (same shape as the vetted CSV).
      const masjidAddress = { address: "7701 Lone Tree Way", city: "Brentwood", state: "CA", zip: "94513" };
      const listings = [
        { name: "Sample Halal Grill", listingType: "BUSINESS", parentCategory: "Restaurant", category: "Halal Restaurant", tags: ["Halal", "Mediterranean"], description: "Sample listing — Mediterranean grill with falafel, skewers and fresh bread.", phone: "(925) 555-0110", website: "https://example.com/halal-grill", ...masjidAddress },
        { name: "Sample HVAC Services", listingType: "INDIVIDUAL", parentCategory: "Home Services / Repair", category: "HVACR Repair", tags: ["HVACR"], description: "Sample listing — heating, ventilation and air-conditioning repair.", phone: "(925) 555-0111" },
        { name: "Brother Sample A.", listingType: "INDIVIDUAL", parentCategory: "Home Services / Repair", category: "HVACR Repair", tags: ["HVACR"], description: "Sample listing — no additional description provided.", phone: "(925) 555-0112" },
        { name: "Sample Pest Control", listingType: "BUSINESS", parentCategory: "Home Services / Repair", category: "Pest Control", tags: ["Pest Control"], description: "Sample listing — residential pest control.", phone: "(925) 555-0113" },
        { name: "Example Pest Solutions", listingType: "BUSINESS", parentCategory: "Home Services / Repair", category: "Pest Control", tags: ["Pest Control"], description: "Sample listing — no additional description provided." },
        { name: "Test Exterminators", listingType: "BUSINESS", parentCategory: "Home Services / Repair", category: "Pest Control", tags: ["Pest Control"], description: "Sample listing — no additional description provided.", phone: "(925) 555-0114" },
        { name: "Sample Cabinet Repair", listingType: "INDIVIDUAL", parentCategory: "Home Services / Repair", category: "Kitchen Countertop/Cabinet Repair", tags: ["Countertop & Cabinet"], description: "Sample listing — kitchen countertop and cabinet repair.", phone: "(925) 555-0115" },
        { name: "Sample Computer Help", listingType: "INDIVIDUAL", parentCategory: "Computer Repair", category: "Computer Services", tags: ["Computer Services"], description: "Sample listing — computer setup and repair.", email: "computers@example.com" },
        { name: "Sample Acupuncture Clinic", listingType: "BUSINESS", parentCategory: "Alternate Medicine", category: "Acupuncture", tags: ["Acupuncture"], description: "Sample listing — acupuncture and wellness.", phone: "(925) 555-0116", website: "https://example.com/acupuncture", ...masjidAddress },
        { name: "Sample Limo Service", listingType: "BUSINESS", parentCategory: "Transportation and Warehousing", category: "Limo Service", tags: ["Limo Rental"], description: "Sample listing — limousine rental for weddings and events.", phone: "(925) 555-0117" },
      ] as const;
    for (const l of listings) {
      await db.directoryListing.create({ data: { ...l, tags: [...l.tags], author: l.name, ...approved } });
    }
    summary = `${listings.length} FAKE sample directory listings`;
  }

  if (!replace) return summary;

  // Two submissions waiting in the admin approval queue (never public).
  await db.directoryListing.createMany({
    data: [
        { name: "Pending Sample Tutoring", listingType: "INDIVIDUAL", parentCategory: "Education", category: "Tutoring", tags: ["Tutoring", "Math"], description: "Sample pending submission — math tutoring.", author: "Pending Sample", phone: "(925) 555-0120", submitterEmail: "tutor@example.com", status: "PENDING" },
        { name: "Pending Sample Bakery", listingType: "BUSINESS", parentCategory: "Restaurant", category: "Bakery", tags: ["Halal", "Bakery"], description: "Sample pending submission — halal bakery.", author: "Pending Bakery", submitterEmail: "bakery@example.com", status: "PENDING" },
      ],
  });
  return `${summary} + 2 pending submissions`;
}
