import "server-only";
import { db } from "@/lib/db";

export type PublicListing = {
  id: string;
  name: string;
  listingType: "BUSINESS" | "INDIVIDUAL";
  parentCategory: string;
  category: string;
  tags: string[];
  description: string;
  author: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  googleMapUrl: string | null;
};

// Approved listings only — pending and rejected submissions never leave the server.
// Listings with a phone number first (as in the design), then by name.
export async function getApprovedListings(): Promise<PublicListing[]> {
  const rows = await db.directoryListing.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      name: true,
      listingType: true,
      parentCategory: true,
      category: true,
      tags: true,
      description: true,
      author: true,
      phone: true,
      email: true,
      website: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      googleMapUrl: true,
    },
  });
  return rows.sort((a, b) => Number(!!b.phone) - Number(!!a.phone) || a.name.localeCompare(b.name));
}

// Existing main categories, for the submission form's dropdown.
export async function getParentCategories() {
  const rows = await db.directoryListing.findMany({ where: { status: "APPROVED" }, distinct: ["parentCategory"], select: { parentCategory: true } });
  return rows.map((r) => r.parentCategory).sort((a, b) => a.localeCompare(b));
}
