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
  funeral: "/funeral-services",
  about: "/about",
  contact: "/about#contact",
  memberLogin: "/#member-access", // becomes the Clerk sign-in in phase 7
  search: "/search",
  hikmahSchool: "https://hikmahschool.com/",
} as const;

// Contact form link that tells the form which service the visitor came from.
export function contactHref(topic?: string) {
  return topic ? `/about?topic=${encodeURIComponent(topic)}#contact` : routes.contact;
}
