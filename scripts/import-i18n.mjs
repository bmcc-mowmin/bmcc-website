// One-time import of the design handoff's translations into messages/*.json.
//
//   node scripts/import-i18n.mjs
//
// Sources:
//   docs/design-handoff/design/i18n.js           — the shared dictionary (en, dari, urdu, pashto)
//   docs/design-handoff/design/*.dc.html         — each page's inline English defaults
//                                                  (some newer strings exist only there)
// Output: messages/<lang>.json with ONLY the keys that language actually translates.
// After the first import, messages/*.json are the source of truth and are edited directly;
// re-running requires --force and overwrites any keys added since.
// English fallback per key happens at runtime (src/lib/i18n/dictionary.ts), like t(lang) did.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DESIGN = "docs/design-handoff/design";
if (!process.argv.includes("--force")) {
  const { existsSync } = await import("node:fs");
  if (existsSync("messages/en.json")) {
    console.error("messages/ already exists. Re-run with --force to overwrite it.");
    process.exit(1);
  }
}
const i18n = await import(pathToFileURL(path.resolve(DESIGN, "i18n.js")).href);

// Pull `{ ... }` following a marker out of a page script and evaluate it as an object literal.
function extractObject(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const start = src.indexOf("{", at + marker.length - 1);
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return Function(`return (${src.slice(start, i + 1)});`)();
  }
  return null;
}

const en = i18n.t("en");
const pageOnly = {};
const conflicts = [];
for (const file of readdirSync(DESIGN).filter((f) => f.endsWith(".dc.html"))) {
  const src = readFileSync(path.join(DESIGN, file), "utf8");
  const obj = extractObject(src, "const EN_DEFAULT") ?? extractObject(src, "i18n: {");
  if (!obj) continue;
  for (const [k, v] of Object.entries(obj)) {
    if (!(k in en)) pageOnly[k] = v;
    else if (en[k] !== v) conflicts.push(`${file}: ${k}\n    i18n.js: ${en[k]}\n    page:    ${v}`);
  }
}

mkdirSync("messages", { recursive: true });
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync("messages/en.json", JSON.stringify(sortKeys({ ...en, ...pageOnly }), null, 2) + "\n");
console.log(`en: ${Object.keys(en).length} keys + ${Object.keys(pageOnly).length} page-only keys`);

for (const { code } of i18n.LANGS.filter((l) => l.code !== "en")) {
  const full = i18n.t(code);
  const own = Object.fromEntries(Object.entries(full).filter(([k, v]) => en[k] !== v));
  writeFileSync(`messages/${code}.json`, JSON.stringify(sortKeys(own), null, 2) + "\n");
  console.log(`${code}: ${Object.keys(own).length} translated keys`);
}

if (conflicts.length) {
  console.log(`\n${conflicts.length} keys differ between i18n.js and a page (i18n.js wins):`);
  console.log(conflicts.join("\n"));
}
