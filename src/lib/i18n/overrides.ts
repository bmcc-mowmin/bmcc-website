import "server-only";
import { db } from "@/lib/db";
import { cached, invalidate } from "@/lib/content/cache";
import { isLang, type Lang } from "./config";
import { setMessageOverrides, type Dictionary, type MessageKey } from "./dictionary";
import en from "../../../messages/en.json";

// Loads Admin → Site text edits into the dictionary. Called by getLang(), so every server
// component and action sees current text without anything else changing.
const NAME = "message-overrides";
let applied: unknown = null;

export async function ensureMessageOverrides() {
  const rows = await cached(NAME, 15_000, () => db.messageOverride.findMany());
  if (rows === applied) return;
  applied = rows;
  const next: Partial<Record<Lang, Partial<Dictionary>>> = {};
  for (const r of rows) {
    // Keys that no longer exist in the files are ignored.
    if (!isLang(r.lang) || !(r.key in en)) continue;
    (next[r.lang] ??= {})[r.key as MessageKey] = r.value;
  }
  setMessageOverrides(next);
}

export function invalidateMessageOverrides() {
  invalidate(NAME);
}
