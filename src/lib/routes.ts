// Every internal URL in one place (the prototypes linked to "*.dc.html" files).
export const routes = {
  home: "/",
  prayerTimes: "/prayer-times",
  events: "/events",
  community: "/community",
  services: "/services",
  assistance: "/assistance",
  donate: "/donate",
  membership: "/membership",
  newBmcc: "/new-bmcc",
  funeral: "/funeral-services",
  about: "/about",
  contact: "/about#contact",
  memberLogin: "/login", // Clerk's sign-in in production (same address)
  account: "/account",
  search: "/search",
  hikmahSchool: "https://hikmahschool.com/",
} as const;

// Contact form link that tells the form which service the visitor came from.
export function contactHref(topic?: string) {
  return topic ? `/about?topic=${encodeURIComponent(topic)}#contact` : routes.contact;
}
