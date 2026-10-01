import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LANGS, ltrIsolate } from "../../src/lib/i18n/config";

// Every language has every English key, so no English slips into a translated page
// (a missing key silently falls back to English).
const load = (code: string) => JSON.parse(readFileSync(new URL(`../../messages/${code}.json`, import.meta.url), "utf8")) as Record<string, string>;
const en = load("en");

for (const { code } of LANGS.filter((l) => l.code !== "en")) {
  test(`${code} translates every key`, () => {
    const messages = load(code);
    assert.deepEqual(Object.keys(en).filter((k) => !(k in messages)), []);
  });
}

test("times keep their order inside right-to-left text", () => {
  assert.equal(ltrIsolate("6:09 AM", "ur-PK"), "⁦6:09 AM⁩");
  assert.equal(ltrIsolate("6:09 AM", "en-US"), "6:09 AM");
  assert.equal(ltrIsolate("6:09 a. m.", "es-US"), "6:09 a. m.");
});
