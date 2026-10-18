import "server-only";
import { db } from "@/lib/db";
import { getDictionary, localize, type Dictionary, type MessageKey } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";
import { getUpcomingEvents } from "@/lib/events";
import { matches, normalize, queryTerms } from "./normalize";

// Site search across pages, services, events and the Community Directory. Each item is matched in
// the visitor's language AND in English (so "nikah" or "zakat" finds the page on a Dari site too),
// and shown in the visitor's language. The site is small, so everything is searched in memory.

export type SearchHit = { href: string; title: string; snippet: string; meta?: string };
export type SearchResults = { pages: SearchHit[]; events: SearchHit[]; directory: SearchHit[]; total: number };

// Pages and the message keys that make up their text (by key prefix).
const PAGES: { href: string; title: MessageKey; keys: RegExp }[] = [
  { href: "/prayer-times", title: "nav_prayer", keys: /^(prayer_|jumuah_|timetable_|tile_prayer)/ },
  { href: "/events", title: "nav_events", keys: /^(events_|evc_)/ },
  { href: "/community", title: "nav_community", keys: /^(community_|dir_|tile_directory)/ },
  { href: "/community/submit", title: "submit_heading", keys: /^(submit_|involved_listing)/ },
  { href: "/services", title: "nav_services", keys: /^(services_|nav_services_desc)/ },
  { href: "/assistance", title: "nav_assistance", keys: /^(assist_|nav_assistance_desc)/ },
  { href: "/new-bmcc", title: "nb_title", keys: /^nb_/ },
  { href: "/funeral-services", title: "nav_funeral", keys: /^(funeral_|ps_|disclaimer_|checklist_|stat_|not_member_|nav_funeral)/ },
  { href: "/donate", title: "nav_donate", keys: /^(donate_|fund_|benefit\d|nav_donate_desc|tile_give)/ },
  { href: "/membership", title: "nav_membership", keys: /^(membership_|m[1-5]_(title|sub)|m4_|nav_membership_desc|involved_member)/ },
  { href: "/about", title: "nav_about_us", keys: /^(about_|tab_)/ },
  { href: "/about#contact", title: "nav_contact", keys: /^(contact_(eyebrow|heading|paragraph)|nav_contact)/ },
  { href: "/login", title: "login_title", keys: /^(member_|login_title)/ },
];

// Services and Assistance cards are results of their own: svc_<id>_title / a_<id>_title.
function cards(t: Dictionary) {
  return Object.keys(t).flatMap((k) => {
    const m = k.match(/^(svc|a)_([a-z]+)_title$/);
    if (!m) return [];
    const base = `${m[1]}_${m[2]}`;
    return [{ href: m[1] === "svc" ? "/services" : "/assistance", base, parent: (m[1] === "svc" ? "nav_services" : "nav_assistance") as MessageKey }];
  });
}

const textOf = (t: Dictionary, keys: RegExp) =>
  (Object.keys(t) as MessageKey[])
    .filter((k) => keys.test(k))
    .map((k) => t[k])
    .join(" · ");

// ~160 characters around the first matching word.
function snippet(text: string, terms: string[]) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  const words = clean.split(" ");
  const i = Math.max(0, words.findIndex((w) => terms.some((t) => normalize(w).startsWith(t))));
  let out = words.slice(Math.max(0, i - 8)).join(" ");
  if (out.length > 160) out = `${out.slice(0, 160).replace(/\s+\S*$/, "")}…`;
  return (i > 8 ? "…" : "") + out;
}

export async function search(q: string, lang: Lang): Promise<SearchResults> {
  const terms = queryTerms(q);
  if (terms.length === 0) return { pages: [], events: [], directory: [], total: 0 };
  const t = getDictionary(lang);
  const en = getDictionary("en");
  // Title matches first.
  const rank = <T extends { title: string }>(hits: T[]) => [...hits].sort((a, b) => Number(matches(b.title, terms)) - Number(matches(a.title, terms)));

  const pages: SearchHit[] = [];
  for (const p of PAGES) {
    const local = `${t[p.title]} · ${textOf(t, p.keys)}`;
    if (matches(local, terms) || matches(`${en[p.title]} ${textOf(en, p.keys)}`, terms)) {
      pages.push({ href: p.href, title: t[p.title], snippet: snippet(textOf(t, p.keys), terms) });
    }
  }
  for (const c of cards(t)) {
    const keys = new RegExp(`^${c.base}_(title|desc|detail)$`);
    const title = t[`${c.base}_title` as MessageKey];
    if (matches(textOf(t, keys), terms) || matches(textOf(en, keys), terms)) {
      pages.push({ href: c.href, title, snippet: t[`${c.base}_desc` as MessageKey] ?? "", meta: t[c.parent] });
    }
  }

  const [eventsLocal, listings] = await Promise.all([
    getUpcomingEvents(lang),
    db.directoryListing.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } }),
  ]);
  const eventRows = await db.event.findMany({ where: { id: { in: eventsLocal.map((e) => e.id) } } });
  const events: SearchHit[] = eventsLocal
    .filter((e) => {
      const row = eventRows.find((r) => r.id === e.id);
      const english = row ? [row.title, row.description, row.tag, row.location].map((v) => localize(v, "en")).join(" ") : "";
      return matches(`${e.title} ${e.description} ${e.tag} ${e.location}`, terms) || matches(english, terms);
    })
    .map((e) => ({ href: `/events/${e.slug}`, title: e.title, snippet: e.description, meta: e.tag }));

  const directory: SearchHit[] = listings
    .filter((l) => matches([l.name, l.category, l.parentCategory, l.description, l.city ?? "", l.tags.join(" ")].join(" "), terms))
    .map((l) => ({ href: `/community?listing=${l.id}`, title: l.name, snippet: snippet(l.description, terms), meta: [l.category, l.city].filter(Boolean).join(" · ") }));

  const result = { pages: rank(pages), events: rank(events), directory: rank(directory) };
  return { ...result, total: result.pages.length + result.events.length + result.directory.length };
}
