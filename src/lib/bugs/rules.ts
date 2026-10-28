// Bug-report rules: pure data and functions (no database), so they can be unit tested.

// What the reporter picks on the public form → translation key of its label.
export const CATEGORIES = {
  broken: "bug_cat_broken",
  wrong_info: "bug_cat_wrong_info",
  display: "bug_cat_display",
  translation: "bug_cat_translation",
  accessibility: "bug_cat_accessibility",
  payment: "bug_cat_payment",
  other: "bug_cat_other",
} as const;
export type Category = keyof typeof CATEGORIES;
export const isCategory = (v: unknown): v is Category => typeof v === "string" && v in CATEGORIES;

// How much it gets in the reporter's way.
export const IMPACTS = {
  blocked: "bug_impact_blocked",
  annoying: "bug_impact_annoying",
  minor: "bug_impact_minor",
} as const;
export type Impact = keyof typeof IMPACTS;
export const isImpact = (v: unknown): v is Impact => typeof v === "string" && v in IMPACTS;

// English labels for admin (the portal is English-only).
export const CATEGORY_LABEL: Record<Category, string> = {
  broken: "Something doesn't work",
  wrong_info: "Wrong or outdated information",
  display: "Looks wrong on screen",
  translation: "Translation problem",
  accessibility: "Hard to use / accessibility",
  payment: "Payment or donation problem",
  other: "Something else",
};
export const IMPACT_LABEL: Record<Impact, string> = {
  blocked: "Blocked — couldn't do what they came to do",
  annoying: "Annoying — found a way around it",
  minor: "Minor / cosmetic",
};

// Which part of the site a bug belongs to; each area can have a default owner (Admin → Bugs → Owners).
export const AREAS = [
  { id: "prayer", label: "Prayer times" },
  { id: "events", label: "Events and announcements" },
  { id: "giving", label: "Donations and payments" },
  { id: "membership", label: "Membership" },
  { id: "directory", label: "Community Directory" },
  { id: "account", label: "Sign-in and member account" },
  { id: "content", label: "Text, translations and photos" },
  { id: "admin", label: "Admin portal" },
  { id: "other", label: "Other / whole site" },
] as const;
export type Area = (typeof AREAS)[number]["id"];
export const isArea = (v: unknown): v is Area => AREAS.some((a) => a.id === v);
export const areaLabel = (id: string | null) => AREAS.find((a) => a.id === id)?.label ?? "Not set";

// Priority → what it means and how quickly it should be fixed (due date counted from triage).
export const PRIORITIES = [
  { id: "P1", label: "P1 · Critical", hint: "Site down, payments failing, wrong prayer times, data exposed", dueDays: 1 },
  { id: "P2", label: "P2 · High", hint: "A main task is blocked for many people", dueDays: 3 },
  { id: "P3", label: "P3 · Normal", hint: "Something is wrong but there is a way around it", dueDays: 14 },
  { id: "P4", label: "P4 · Low", hint: "Cosmetic or nice to have", dueDays: null },
] as const;
export type Priority = (typeof PRIORITIES)[number]["id"];
export const isPriority = (v: unknown): v is Priority => PRIORITIES.some((p) => p.id === v);
export const priorityLabel = (id: string | null) => PRIORITIES.find((p) => p.id === id)?.label ?? "Not set";

export const STATUSES = [
  { id: "NEW", label: "Needs triage", open: true },
  { id: "TRIAGED", label: "Triaged", open: true },
  { id: "IN_PROGRESS", label: "In progress", open: true },
  { id: "NEED_INFO", label: "Waiting for reporter", open: true },
  { id: "FIXED", label: "Fixed — check it", open: true },
  { id: "CLOSED", label: "Closed", open: false },
  { id: "WONT_FIX", label: "Won't fix", open: false },
  { id: "DUPLICATE", label: "Duplicate", open: false },
  { id: "CANNOT_REPRODUCE", label: "Can't reproduce", open: false },
] as const;
export type Status = (typeof STATUSES)[number]["id"];
export const isStatus = (v: unknown): v is Status => STATUSES.some((s) => s.id === v);
export const statusLabel = (id: string) => STATUSES.find((s) => s.id === id)?.label ?? id;
export const OPEN_STATUSES = STATUSES.filter((s) => s.open).map((s) => s.id);
export const CLOSED_STATUSES = STATUSES.filter((s) => !s.open).map((s) => s.id);
// Statuses an owner without triage rights may set on their own bugs.
export const ASSIGNEE_STATUSES: Status[] = ["IN_PROGRESS", "NEED_INFO", "FIXED", "CANNOT_REPRODUCE"];

// Past its due date and still waiting for a fix (fixed-and-checking and closed bugs aren't late).
export function isOverdue(bug: { dueAt: Date | null; status: string }, now = Date.now()) {
  return !!bug.dueAt && bug.dueAt.getTime() < now && bug.status !== "FIXED" && !(CLOSED_STATUSES as readonly string[]).includes(bug.status);
}

export const bugRef = (n: number) => `BUG-${String(n).padStart(4, "0")}`;
// "BUG-0012", "bug12", "#12" or "12" → 12.
export function parseBugRef(v: string): number | null {
  const m = v.trim().match(/^(?:bug-?|#)?0*(\d{1,7})$/i);
  return m ? Number(m[1]) : null;
}

// A first guess at the area from the page the report came from (the triager confirms it).
export function guessArea(pageUrl: string | null, category: Category): Area | null {
  if (category === "payment") return "giving";
  if (category === "translation") return "content";
  let path = "";
  try {
    path = pageUrl ? new URL(pageUrl, "https://x.invalid").pathname : "";
  } catch {
    path = "";
  }
  const rules: [RegExp, Area][] = [
    [/^\/admin/, "admin"],
    [/^\/prayer-times/, "prayer"],
    [/^\/events/, "events"],
    [/^\/(donate|new-bmcc|checkout)/, "giving"],
    [/^\/(membership|funeral-services)/, "membership"],
    [/^\/community/, "directory"],
    [/^\/(account|login|sign-up)/, "account"],
  ];
  for (const [re, area] of rules) if (re.test(path)) return area;
  if (category === "wrong_info") return "content";
  return null;
}

// A suggested priority from what the reporter said (the triager decides).
export function suggestPriority(impact: Impact, category: Category): Priority {
  if (impact === "blocked") return category === "payment" ? "P1" : "P2";
  if (impact === "annoying") return "P3";
  return "P4";
}

export function dueDate(priority: Priority, from: Date): Date | null {
  const days = PRIORITIES.find((p) => p.id === priority)?.dueDays;
  return days == null ? null : new Date(from.getTime() + days * 86_400_000);
}

// Attachments: screenshots (JPEG/PNG/WebP) or a PDF, checked by their first bytes.
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export function detectAttachment(bytes: Uint8Array): { ext: string; type: string } | null {
  const b = bytes;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", type: "image/webp" };
  if (b.length > 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return { ext: "pdf", type: "application/pdf" };
  return null;
}
