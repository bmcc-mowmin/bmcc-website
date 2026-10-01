// Directory listings for the local seed.
//
// The directory's real data lives in the database: the initial listings were imported once from
// BMCC's vetted sheet, and every new listing comes from the public "Submit a Listing" form and is
// approved in Admin → Directory. So the seed NEVER deletes or changes existing listings. Only when
// the directory is completely empty (a fresh clone) does it add fake sample listings to try things.
import type { PrismaClient } from "../src/generated/prisma/client";

export async function seedDirectory(db: PrismaClient, reviewerId: string) {
  const existing = await db.directoryListing.count();
  if (existing > 0) return `${existing} directory listings kept as they are`;

  const approved = { status: "APPROVED" as const, reviewedById: reviewerId, reviewedAt: new Date() };
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

  // Two submissions waiting in the admin approval queue (never public).
  await db.directoryListing.createMany({
    data: [
      { name: "Pending Sample Tutoring", listingType: "INDIVIDUAL", parentCategory: "Education", category: "Tutoring", tags: ["Tutoring", "Math"], description: "Sample pending submission — math tutoring.", author: "Pending Sample", phone: "(925) 555-0120", submitterEmail: "tutor@example.com", status: "PENDING" },
      { name: "Pending Sample Bakery", listingType: "BUSINESS", parentCategory: "Restaurant", category: "Bakery", tags: ["Halal", "Bakery"], description: "Sample pending submission — halal bakery.", author: "Pending Bakery", submitterEmail: "bakery@example.com", status: "PENDING" },
    ],
  });
  return `${listings.length} FAKE sample directory listings + 2 pending submissions (empty directory)`;
}
