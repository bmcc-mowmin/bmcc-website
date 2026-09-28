import "server-only";
import { env } from "@/lib/env";

// Organization contact details, shown in the footer and on About/Contact.
export const org = {
  legalName: env.ORG_LEGAL_NAME,
  address: env.ORG_ADDRESS,
  // The footer shows the street address without the ZIP, as in the design.
  addressShort: env.ORG_ADDRESS.replace(/\s+\d{5}(-\d{4})?$/, ""),
  phone: env.ORG_PHONE,
  phoneHref: `tel:${env.ORG_PHONE_TEL}`,
  email: env.ORG_EMAIL,
};
