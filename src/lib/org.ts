import "server-only";
import { getSettings } from "@/lib/settings";

// Organization contact details (Admin → Settings), shown in the footer, About/Contact, receipts
// and calendar files.
export type Org = Awaited<ReturnType<typeof getOrg>>;

export async function getOrg() {
  const s = await getSettings();
  return {
    legalName: s.orgLegalName,
    address: s.orgAddress,
    // The footer shows the street address without the ZIP, as in the design.
    addressShort: s.orgAddress.replace(/\s+\d{5}(-\d{4})?$/, ""),
    phone: s.orgPhone,
    phoneHref: `tel:${s.orgPhoneTel}`,
    email: s.orgEmail,
    ein: s.orgEin,
  };
}
