// Turns one CSV row (headers already normalized by csvToObjects) into listing input.
// Shared by Admin → Directory → Import and the local seed, so both read a sheet the same way.
// Header names are matched loosely: e.g. "Business Name" or "name", "Sub-Category" or "category".

export const DEFAULT_DESCRIPTION = "No additional description provided — contact the BMCC office for details.";

const pick = (row: Record<string, string>, ...keys: string[]) => keys.map((k) => row[k]).find((v) => v) ?? "";

export function rowToListing(row: Record<string, string>) {
  const name = pick(row, "name", "businessname");
  const type = pick(row, "listingtype", "type").toLowerCase();
  return {
    candidate: {
      listingType: type.startsWith("ind") ? "INDIVIDUAL" : "BUSINESS",
      name,
      parentCategory: pick(row, "maincategory", "parentcategory", "businesscategory"),
      category: pick(row, "category", "sub-category", "subcategory"),
      tags: pick(row, "tags"),
      description: pick(row, "description") || DEFAULT_DESCRIPTION,
      author: pick(row, "author", "contactname", "owner/contactname", "postedby") || name,
      phone: pick(row, "phone", "phonenumber", "contact"),
      email: pick(row, "email", "emailaddress"),
      website: pick(row, "website", "websiteurl", "url"),
      address: pick(row, "address", "streetaddress"),
      city: pick(row, "city", "location"),
      state: pick(row, "state"),
      zip: pick(row, "zip", "zipcode", "postalcode"),
    },
    googleMapUrl: /^https:\/\//.test(pick(row, "googlemapurl", "googlemapslink", "mapurl")) ? pick(row, "googlemapurl", "googlemapslink", "mapurl") : null,
  };
}
