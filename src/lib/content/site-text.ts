import "server-only";
import { db } from "@/lib/db";
import { LANGS, type Lang } from "@/lib/i18n/config";
import { builtInText, type MessageKey } from "@/lib/i18n/dictionary";
import en from "../../../messages/en.json";

// Admin → Site text: every built-in piece of text, grouped by where it appears.

export const GROUPS: { id: string; label: string; keys: RegExp }[] = [
  { id: "header", label: "Header, menu & footer", keys: /^(nav_|header_|footer_|member_login|skip_|aria_|search_placeholder|lang|ann_|announcement)/ },
  { id: "home", label: "Home", keys: /^(home_|tile_|explore_|evc_|involved_|member_|btn_|resub_|newsletter_)/ },
  { id: "prayer", label: "Prayer times", keys: /^(prayer_|jumuah_|timetable_|asr_|next_prayer|tomorrow)/ },
  { id: "events", label: "Events & RSVP", keys: /^(events?_|ev\d_|every_|rsvp_|add_to_calendar)/ },
  { id: "directory", label: "Community Directory", keys: /^(community_|dir_|submit_|f_|listing|call|visit_|get_directions|open_in_maps|no_location|city_label|state_label|zip_label|posted_by)/ },
  { id: "donate", label: "Donate", keys: /^(donate_|fund_|benefit\d|received)/ },
  { id: "membership", label: "Membership", keys: /^(membership_|m\d?_|reference_id|receipt_)/ },
  { id: "funeral", label: "Funeral Services Benefit", keys: /^(funeral_|ps_|disclaimer_|checklist_|stat_|not_member_)/ },
  { id: "services", label: "Services & Assistance", keys: /^(services_|svc_|assist_|a_)/ },
  { id: "about", label: "About Us & contact form", keys: /^(about_|tab_|contact_|send_|map_label|view_funeral)/ },
  { id: "account", label: "Sign-in & My account", keys: /^(login_|signin_|acct_|cov_|rel_|home_welcome|home_go)/ },
  { id: "mailing", label: "Mailing list emails & pages", keys: /^(sub_|unsub_)/ },
  { id: "search", label: "Search", keys: /^search_/ },
  { id: "forms", label: "Form messages", keys: /^form_/ },
];

export const ALL_KEYS = Object.keys(en) as MessageKey[];
export const isKey = (k: string): k is MessageKey => k in en;
export const groupOf = (key: string) => GROUPS.find((g) => g.keys.test(key))?.label ?? "Other";

export const placeholders = (text: string) => [...new Set(text.match(/\{[a-z]+\}/g) ?? [])].sort();

export async function overridesByKey() {
  const rows = await db.messageOverride.findMany();
  const map = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (!map.has(r.key)) map.set(r.key, new Map());
    map.get(r.key)!.set(r.lang, r.value);
  }
  return map;
}

export function builtIn(key: MessageKey, lang: Lang) {
  return builtInText(lang)[key] ?? "";
}

export const LANG_LIST = LANGS.map((l) => ({ code: l.code as Lang, label: l.label, html: l.html, rtl: ["dari", "urdu", "pashto"].includes(l.code) }));
