// Who may open which admin section. Pure data + functions (no database) so it can be unit tested.
// SUPER_ADMIN can do everything. Every page AND every server action checks its section.

export const ADMIN_ROLES = ["SUPER_ADMIN", "CONTENT_EDITOR", "PRAYER_MANAGER", "MEMBERSHIP_COORDINATOR", "TREASURER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_INFO: Record<AdminRole, { label: string; description: string }> = {
  SUPER_ADMIN: { label: "Super admin", description: "Everything, including admin users, settings and the activity log." },
  CONTENT_EDITOR: { label: "Content editor", description: "Events, announcements, site text, media, subscribers and messages." },
  PRAYER_MANAGER: { label: "Prayer times manager", description: "Prayer times, Iqamah rules, Jumu'ah and the monthly timetable." },
  MEMBERSHIP_COORDINATOR: { label: "Membership coordinator", description: "Members and households, the directory approval queue, messages." },
  TREASURER: { label: "Treasurer", description: "Donations and dues (read-only)." },
};

export type Section =
  | "dashboard"
  | "prayer"
  | "events"
  | "announcements"
  | "directory"
  | "memberships"
  | "donations"
  | "subscribers"
  | "messages"
  | "content"
  | "media"
  | "settings"
  | "users"
  | "activity";

// Roles (besides SUPER_ADMIN) allowed in each section. [] = super admins only.
const ACCESS: Record<Section, AdminRole[]> = {
  dashboard: ["CONTENT_EDITOR", "PRAYER_MANAGER", "MEMBERSHIP_COORDINATOR", "TREASURER"],
  prayer: ["PRAYER_MANAGER"],
  events: ["CONTENT_EDITOR"],
  announcements: ["CONTENT_EDITOR"],
  directory: ["MEMBERSHIP_COORDINATOR", "CONTENT_EDITOR"],
  memberships: ["MEMBERSHIP_COORDINATOR"],
  donations: ["TREASURER"],
  subscribers: ["CONTENT_EDITOR"],
  messages: ["CONTENT_EDITOR", "MEMBERSHIP_COORDINATOR"],
  content: ["CONTENT_EDITOR"],
  media: ["CONTENT_EDITOR"],
  settings: [],
  users: [],
  activity: [],
};

export function isStaff(roles: readonly string[]) {
  return roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));
}

export function can(roles: readonly string[], section: Section) {
  if (roles.includes("SUPER_ADMIN")) return true;
  return ACCESS[section].some((r) => roles.includes(r));
}

// Sidebar entries, in order. `built: false` items are shown greyed until their phase lands.
export const NAV: { section: Section; href: string; label: string; built: boolean }[] = [
  { section: "dashboard", href: "/admin", label: "Dashboard", built: true },
  { section: "prayer", href: "/admin/prayer-times", label: "Prayer times", built: true },
  { section: "events", href: "/admin/events", label: "Events", built: true },
  { section: "announcements", href: "/admin/announcements", label: "Announcements", built: true },
  { section: "directory", href: "/admin/directory", label: "Directory", built: true },
  { section: "memberships", href: "/admin/memberships", label: "Memberships", built: true },
  { section: "donations", href: "/admin/donations", label: "Donations", built: true },
  { section: "subscribers", href: "/admin/subscribers", label: "Subscribers", built: true },
  { section: "messages", href: "/admin/messages", label: "Messages", built: true },
  { section: "content", href: "/admin/content", label: "Site text", built: false },
  { section: "media", href: "/admin/media", label: "Media library", built: false },
  { section: "settings", href: "/admin/settings", label: "Settings", built: false },
  { section: "users", href: "/admin/users", label: "Admin users", built: true },
  { section: "activity", href: "/admin/activity", label: "Activity log", built: true },
];

export function navFor(roles: readonly string[]) {
  return NAV.filter((n) => can(roles, n.section));
}
